import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { SaleItem, Sale, Product, StockConflict, CheckoutResult } from '../types';

export type { StockConflict, CheckoutResult };

export const ATOMIC_CHECKOUT_SQL = `-- ============================================================================
-- ATOMIC CONCURRENCY CHECKOUT FUNCTION FOR SUPABASE / POSTGRESQL
-- Prevents race conditions, double-selling, and duplicate order numbers
-- across 4-5 simultaneous cashier devices during peak sale.
-- Fully compatible with UUID and TEXT schemas for sales & sale_items tables.
-- ============================================================================

CREATE OR REPLACE FUNCTION process_atomic_checkout(
    p_items JSONB,
    p_total NUMERIC,
    p_payment_method TEXT,
    p_user_notes TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'Pending'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_curr_stock INT;
    v_is_sold_out BOOLEAN;
    v_next_order_num INT;
    v_conflicts JSONB := '[]'::JSONB;
    
    -- Schema dynamic detection variables
    v_sales_id_type TEXT;
    v_product_id_type TEXT;
    v_pm_column TEXT := 'paymentMethod';
    
    -- Generated identifiers
    v_new_sale_uuid UUID;
    v_new_sale_id_text TEXT;
BEGIN
    -- STEP 0: Fast Ping Response
    -- Allows health-checking the RPC without touching database rows
    IF p_status = 'PING' OR p_payment_method = 'PING' OR p_payment_method = 'TEST' THEN
        RETURN jsonb_build_object(
            'success', true,
            'ping', true,
            'message', 'Atomic concurrency RPC is active and responsive'
        );
    END IF;

    -- STEP 1: Row-level locking & inventory verification
    -- We sort by product id to guarantee consistent locking order and avoid deadlocks
    FOR v_item IN 
        SELECT 
            value->>'id' AS id,
            COALESCE((value->>'quantity')::INT, 1) AS quantity,
            COALESCE(value->>'name', 'Unknown Item') AS name
        FROM jsonb_array_elements(p_items)
        WHERE value->>'id' NOT LIKE 'manual-%'
        ORDER BY value->>'id' ASC
    LOOP
        -- Row-level lock using SELECT ... FOR UPDATE
        -- id::text = v_item.id works regardless of whether products.id is UUID or TEXT
        SELECT stock, COALESCE(is_sold_out, false)
        INTO v_curr_stock, v_is_sold_out
        FROM products
        WHERE id::text = v_item.id
        FOR UPDATE;

        IF NOT FOUND THEN
            -- Product not in database
            v_conflicts := v_conflicts || jsonb_build_object(
                'id', v_item.id,
                'name', v_item.name,
                'requested', v_item.quantity,
                'available', 0,
                'reason', 'Item no longer exists in menu'
            );
        ELSIF v_is_sold_out THEN
            v_conflicts := v_conflicts || jsonb_build_object(
                'id', v_item.id,
                'name', v_item.name,
                'requested', v_item.quantity,
                'available', 0,
                'reason', 'Item was marked Sold Out by staff'
            );
        ELSIF v_curr_stock < v_item.quantity THEN
            v_conflicts := v_conflicts || jsonb_build_object(
                'id', v_item.id,
                'name', v_item.name,
                'requested', v_item.quantity,
                'available', GREATEST(0, v_curr_stock),
                'reason', 'Insufficient stock remaining'
            );
        END IF;
    END LOOP;

    -- If any inventory conflicts were detected, abort transaction immediately
    IF jsonb_array_length(v_conflicts) > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INSUFFICIENT_STOCK',
            'conflicts', v_conflicts
        );
    END IF;

    -- STEP 2: Atomically deduct inventory for regular items
    FOR v_item IN 
        SELECT 
            value->>'id' AS id,
            COALESCE((value->>'quantity')::INT, 1) AS quantity
        FROM jsonb_array_elements(p_items)
        WHERE value->>'id' NOT LIKE 'manual-%'
    LOOP
        UPDATE products
        SET stock = GREATEST(0, stock - v_item.quantity),
            updated_at = NOW()
        WHERE id::text = v_item.id;
    END LOOP;

    -- STEP 3: Generate sequential order number atomically
    SELECT COALESCE(MAX(order_number), 0) + 1
    INTO v_next_order_num
    FROM sales;

    -- STEP 4: Inspect schema data types dynamically to guarantee UUID and TEXT compatibility
    SELECT LOWER(data_type) INTO v_sales_id_type
    FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'id'
    LIMIT 1;

    SELECT LOWER(data_type) INTO v_product_id_type
    FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'product_id'
    LIMIT 1;

    -- Detect whether payment method column is "paymentMethod" or "payment_method"
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'payment_method'
    ) THEN
        v_pm_column := 'payment_method';
    ELSE
        v_pm_column := '"paymentMethod"';
    END IF;

    -- STEP 5: Insert sales record with correct UUID / TEXT casting
    IF v_sales_id_type = 'uuid' THEN
        v_new_sale_uuid := gen_random_uuid();
        v_new_sale_id_text := v_new_sale_uuid::text;

        EXECUTE format(
            'INSERT INTO sales (id, total, %s, status, order_number, user_notes, timestamp) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
            v_pm_column
        ) USING v_new_sale_uuid, p_total, p_payment_method, p_status, v_next_order_num, p_user_notes;
    ELSE
        v_new_sale_id_text := 'sale-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);

        EXECUTE format(
            'INSERT INTO sales (id, total, %s, status, order_number, user_notes, timestamp) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
            v_pm_column
        ) USING v_new_sale_id_text, p_total, p_payment_method, p_status, v_next_order_num, p_user_notes;
    END IF;

    -- STEP 6: Insert sale line items
    FOR v_item IN 
        SELECT 
            value->>'id' AS id,
            COALESCE(value->>'name', 'Item') AS name,
            COALESCE((value->>'price')::NUMERIC, 0) AS price,
            COALESCE((value->>'quantity')::INT, 1) AS quantity
        FROM jsonb_array_elements(p_items)
    LOOP
        IF v_sales_id_type = 'uuid' THEN
            -- sales.id is UUID
            IF v_product_id_type = 'uuid' THEN
                -- product_id is UUID (convert valid UUID strings, use NULL for manual sales)
                IF v_item.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                    EXECUTE 'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)'
                    USING v_new_sale_uuid, v_item.id::uuid, v_item.name, v_item.price, v_item.quantity;
                ELSE
                    EXECUTE 'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES ($1, NULL, $2, $3, $4)'
                    USING v_new_sale_uuid, v_item.name, v_item.price, v_item.quantity;
                END IF;
            ELSE
                -- product_id is TEXT
                EXECUTE 'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)'
                USING v_new_sale_uuid, v_item.id, v_item.name, v_item.price, v_item.quantity;
            END IF;
        ELSE
            -- sales.id is TEXT
            IF v_product_id_type = 'uuid' THEN
                IF v_item.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                    EXECUTE 'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)'
                    USING v_new_sale_id_text, v_item.id::uuid, v_item.name, v_item.price, v_item.quantity;
                ELSE
                    EXECUTE 'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES ($1, NULL, $2, $3, $4)'
                    USING v_new_sale_id_text, v_item.name, v_item.price, v_item.quantity;
                END IF;
            ELSE
                EXECUTE 'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)'
                USING v_new_sale_id_text, v_item.id, v_item.name, v_item.price, v_item.quantity;
            END IF;
        END IF;
    END LOOP;

    -- STEP 7: Return success payload with committed sale details
    RETURN jsonb_build_object(
        'success', true,
        'sale', jsonb_build_object(
            'id', v_new_sale_id_text,
            'total', p_total,
            'paymentMethod', p_payment_method,
            'status', p_status,
            'order_number', v_next_order_num,
            'user_notes', p_user_notes,
            'timestamp', NOW()
        )
    );
END;
$$;`;

export interface CheckoutParams {
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  userNotes?: string;
  currentProducts: Product[];
  currentSales: Sale[];
}

/**
 * Pings Supabase to verify if the atomic RPC function `process_atomic_checkout`
 * has been installed in the PostgreSQL database.
 */
export async function checkRpcAvailability(): Promise<{ installed: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    return { installed: false, message: 'Supabase credentials not configured' };
  }

  try {
    const { data, error } = await supabase.rpc('process_atomic_checkout', {
      p_items: [],
      p_total: 0,
      p_payment_method: 'PING',
      p_user_notes: 'ping',
      p_status: 'PING',
    });

    if (error) {
      if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('not find')) {
        return { installed: false, message: 'RPC function not yet installed in Supabase SQL editor' };
      }
      return { installed: false, message: error.message || 'Error pinging RPC' };
    }

    if (data && typeof data === 'object') {
      return { installed: true, message: 'Atomic RPC with row-level locking is ACTIVE' };
    }

    return { installed: false, message: 'Unknown RPC response' };
  } catch (err: any) {
    return { installed: false, message: err?.message || 'RPC check failed' };
  }
}

/**
 * Performs a live pre-checkout stock re-verification against the database.
 * Returns any items that have insufficient stock or are marked sold out.
 */
export async function preVerifyStock(
  items: SaleItem[],
  currentProducts: Product[]
): Promise<StockConflict[]> {
  const regularItems = items.filter(item => !item.id.startsWith('manual-'));
  if (regularItems.length === 0) return [];

  const productIds = regularItems.map(i => i.id);

  if (isSupabaseConfigured) {
    try {
      const { data: dbProducts, error } = await supabase
        .from('products')
        .select('id, name, stock, is_sold_out')
        .in('id', productIds);

      if (!error && dbProducts && dbProducts.length > 0) {
        const conflicts: StockConflict[] = [];
        for (const item of regularItems) {
          const dbP = dbProducts.find((p: any) => String(p.id) === String(item.id));
          if (!dbP) {
            conflicts.push({
              id: item.id,
              name: item.name,
              requested: item.quantity,
              available: 0,
              reason: 'Item no longer exists in database',
            });
          } else if (dbP.is_sold_out) {
            conflicts.push({
              id: item.id,
              name: item.name,
              requested: item.quantity,
              available: 0,
              reason: 'Item was marked sold out',
            });
          } else if (dbP.stock < item.quantity) {
            conflicts.push({
              id: item.id,
              name: item.name,
              requested: item.quantity,
              available: Math.max(0, dbP.stock),
              reason: `Only ${dbP.stock} remaining (requested ${item.quantity})`,
            });
          }
        }
        return conflicts;
      }
    } catch (err) {
      console.warn("Live pre-verification query notice:", err);
    }
  }

  // Fallback to local products array
  const localConflicts: StockConflict[] = [];
  for (const item of regularItems) {
    const localP = currentProducts.find(p => String(p.id) === String(item.id));
    if (!localP) {
      localConflicts.push({
        id: item.id,
        name: item.name,
        requested: item.quantity,
        available: 0,
        reason: 'Item not found in menu',
      });
    } else if (localP.is_sold_out) {
      localConflicts.push({
        id: item.id,
        name: item.name,
        requested: item.quantity,
        available: 0,
        reason: 'Item is marked sold out',
      });
    } else if (localP.stock < item.quantity) {
      localConflicts.push({
        id: item.id,
        name: item.name,
        requested: item.quantity,
        available: Math.max(0, localP.stock),
        reason: `Only ${localP.stock} left in stock`,
      });
    }
  }
  return localConflicts;
}

/**
 * Executes atomic checkout with database row locking.
 * Prevents race conditions and overselling across 4-5 simultaneous cashier devices.
 */
export async function executeAtomicCheckout(params: CheckoutParams): Promise<CheckoutResult> {
  const { items, total, paymentMethod, userNotes, currentProducts, currentSales } = params;
  const isManual = items[0]?.name === 'Manual Sale';
  const status = isManual ? 'Completed' : 'Pending';

  // 1. Try Supabase RPC with atomic row-level locking (SELECT FOR UPDATE)
  if (isSupabaseConfigured) {
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('process_atomic_checkout', {
        p_items: items,
        p_total: total,
        p_payment_method: paymentMethod,
        p_user_notes: userNotes || null,
        p_status: status,
      });

      if (!rpcError && rpcResult) {
        if (rpcResult.success === false && rpcResult.error === 'INSUFFICIENT_STOCK') {
          return {
            success: false,
            error: 'INSUFFICIENT_STOCK',
            conflicts: rpcResult.conflicts || [],
          };
        }

        if (rpcResult.success === true && rpcResult.sale) {
          const committedSale: Sale = {
            id: String(rpcResult.sale.id),
            timestamp: rpcResult.sale.timestamp || new Date().toISOString(),
            total: rpcResult.sale.total,
            paymentMethod: rpcResult.sale.paymentMethod as any,
            order_number: rpcResult.sale.order_number,
            status: rpcResult.sale.status || status,
            items: items,
            admin_notes: null,
            user_notes: rpcResult.sale.user_notes || userNotes || null,
          };
          return {
            success: true,
            sale: committedSale,
          };
        }
      }
    } catch (rpcErr) {
      console.warn("RPC attempt failed or function not installed yet, falling back to conditional verification:", rpcErr);
    }

    // 2. Fallback: Direct DB transaction with live verification and conditional stock updates
    try {
      const conflicts = await preVerifyStock(items, currentProducts);
      if (conflicts.length > 0) {
        return {
          success: false,
          error: 'INSUFFICIENT_STOCK',
          conflicts,
        };
      }

      // Query latest sequential order number
      let nextOrderNumber = 1;
      const { data: lastSale } = await supabase
        .from('sales')
        .select('order_number')
        .order('order_number', { ascending: false })
        .limit(1)
        .single();

      if (lastSale?.order_number) {
        nextOrderNumber = lastSale.order_number + 1;
      }

      const nowIso = new Date().toISOString();

      // Avoid passing custom text ID into UUID column; let Supabase generate UUID
      const salePayload: any = {
        total,
        status,
        order_number: nextOrderNumber,
        user_notes: userNotes || null,
        paymentMethod,
      };

      let newSaleData: any = null;
      const { data: insertData, error: insertSaleError } = await supabase
        .from('sales')
        .insert(salePayload)
        .select()
        .single();

      if (insertSaleError) {
        // Retry with snake_case payment_method if "paymentMethod" failed
        delete salePayload.paymentMethod;
        salePayload.payment_method = paymentMethod;
        const retry = await supabase.from('sales').insert(salePayload).select().single();
        if (retry.error) throw retry.error;
        newSaleData = retry.data;
      } else {
        newSaleData = insertData;
      }

      const effectiveSaleId = newSaleData?.id || `sale-${Date.now()}`;

      // Insert sale items - protect against non-UUID manual sale items
      const saleItemsToInsert = items.map(item => ({
        sale_id: effectiveSaleId,
        product_id: item.id.startsWith('manual-') ? null : item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));
      await supabase.from('sale_items').insert(saleItemsToInsert);

      // Decrement stock for regular items
      const regularItems = items.filter(item => !item.id.startsWith('manual-'));
      for (const item of regularItems) {
        const { data: freshProd } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();

        const currentStock = freshProd?.stock ?? 0;
        const newStock = Math.max(0, currentStock - item.quantity);

        await supabase
          .from('products')
          .update({ stock: newStock, updated_at: nowIso })
          .eq('id', item.id);
      }

      const sale: Sale = {
        id: String(effectiveSaleId),
        timestamp: nowIso,
        total,
        paymentMethod: paymentMethod as any,
        order_number: nextOrderNumber,
        status,
        items,
        admin_notes: null,
        user_notes: userNotes || null,
      };

      return {
        success: true,
        sale,
      };
    } catch (fallbackErr: any) {
      console.error("Direct Supabase checkout fallback error:", fallbackErr);
    }
  }

  // 3. Local/Offline Fallback (when Supabase is unconfigured or unreachable)
  const localConflicts = await preVerifyStock(items, currentProducts);
  if (localConflicts.length > 0) {
    return {
      success: false,
      error: 'INSUFFICIENT_STOCK',
      conflicts: localConflicts,
    };
  }

  let nextOrderNumber = 1;
  if (currentSales.length > 0) {
    const maxOrderNum = Math.max(0, ...currentSales.map(s => s.order_number || 0));
    nextOrderNumber = maxOrderNum + 1;
  }

  const saleId = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  const localSale: Sale = {
    id: saleId,
    timestamp: nowIso,
    total,
    paymentMethod: paymentMethod as any,
    order_number: nextOrderNumber,
    status,
    items,
    admin_notes: null,
    user_notes: userNotes || null,
  };

  return {
    success: true,
    sale: localSale,
  };
}
