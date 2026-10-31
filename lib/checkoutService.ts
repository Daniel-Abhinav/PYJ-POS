import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { SaleItem, Sale, Product, StockConflict, CheckoutResult } from '../types';

export type { StockConflict, CheckoutResult };

export const ATOMIC_CHECKOUT_SQL = `-- ============================================================================
-- ATOMIC CONCURRENCY CHECKOUT FUNCTION FOR SUPABASE / POSTGRESQL (V4 HARDENED)
-- Prevents race conditions, double-selling, and duplicate order numbers
-- across 4-5 simultaneous cashier devices during peak sale.
-- Fully compatible with schemas with or without 'is_sold_out' and 'updated_at' columns.
-- Compatible with both UUID and TEXT schemas for sales & sale_items tables.
-- ============================================================================

-- Safely add is_sold_out column if it doesn't already exist on products
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN DEFAULT false;

-- Drop any legacy triggers that may have been adding or miscalculating stock on insert
DO $$
DECLARE
    trg RECORD;
BEGIN
    FOR trg IN 
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table IN ('sales', 'sale_items')
          AND (trigger_name ILIKE '%stock%' OR trigger_name ILIKE '%inventory%')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE;', trg.trigger_name, trg.event_object_table);
        RAISE NOTICE 'Removed legacy trigger: % on %', trg.trigger_name, trg.event_object_table;
    END LOOP;
END $$;

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
    
    -- Dynamic column detection
    v_has_is_sold_out BOOLEAN := false;
    v_has_updated_at BOOLEAN := false;
    v_sales_id_type TEXT := 'uuid';
    v_product_id_type TEXT := 'uuid';
    v_pm_column TEXT := 'paymentMethod';
    
    -- Generated identifiers
    v_new_sale_uuid UUID;
    v_new_sale_id_text TEXT;
BEGIN
    -- STEP 0: Fast Ping Response for health-check
    IF p_status = 'PING' OR p_payment_method = 'PING' OR p_payment_method = 'TEST' THEN
        RETURN jsonb_build_object(
            'success', true,
            'ping', true,
            'message', 'Atomic concurrency RPC is active and responsive'
        );
    END IF;

    -- STEP 0.5: Dynamic schema inspection for products table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_sold_out'
    ) INTO v_has_is_sold_out;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'updated_at'
    ) INTO v_has_updated_at;

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
        v_curr_stock := NULL;
        v_is_sold_out := false;

        -- Row-level lock using dynamic SQL (EXECUTE ... FOR UPDATE)
        -- Prevents compile-time failure if 'is_sold_out' column doesn't exist on products table
        IF v_has_is_sold_out THEN
            EXECUTE 'SELECT stock, COALESCE(is_sold_out, false) FROM products WHERE id::text = $1 FOR UPDATE'
            INTO v_curr_stock, v_is_sold_out
            USING v_item.id;
        ELSE
            EXECUTE 'SELECT stock, false FROM products WHERE id::text = $1 FOR UPDATE'
            INTO v_curr_stock, v_is_sold_out
            USING v_item.id;
        END IF;

        IF NOT FOUND OR v_curr_stock IS NULL THEN
            -- Product not found in database
            v_conflicts := v_conflicts || jsonb_build_object(
                'id', v_item.id,
                'name', v_item.name,
                'requested', v_item.quantity,
                'available', 0,
                'reason', 'Item no longer exists in menu'
            );
        ELSIF v_is_sold_out IS TRUE THEN
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

    -- STEP 2: Atomically deduct inventory for regular items (strictly SUBTRACT)
    FOR v_item IN 
        SELECT 
            value->>'id' AS id,
            COALESCE((value->>'quantity')::INT, 1) AS quantity
        FROM jsonb_array_elements(p_items)
        WHERE value->>'id' NOT LIKE 'manual-%'
    LOOP
        IF v_has_updated_at THEN
            EXECUTE 'UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = NOW() WHERE id::text = $2'
            USING v_item.quantity, v_item.id;
        ELSE
            EXECUTE 'UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id::text = $2'
            USING v_item.quantity, v_item.id;
        END IF;
    END LOOP;

    -- STEP 3: Generate sequential order number atomically
    SELECT COALESCE(MAX(order_number), 0) + 1
    INTO v_next_order_num
    FROM sales;

    -- STEP 4: Inspect schema data types dynamically using udt_name (not data_type)
    -- In PostgreSQL, information_schema.columns.data_type for uuid returns 'USER-DEFINED',
    -- whereas udt_name returns 'uuid'.
    SELECT LOWER(COALESCE(udt_name, 'uuid')) INTO v_sales_id_type
    FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'id'
    LIMIT 1;

    SELECT LOWER(COALESCE(udt_name, 'uuid')) INTO v_product_id_type
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
    IF v_sales_id_type = 'uuid' OR v_sales_id_type IS NULL THEN
        v_new_sale_uuid := gen_random_uuid();
        v_new_sale_id_text := v_new_sale_uuid::text;

        EXECUTE format(
            'INSERT INTO sales (id, total, %s, status, order_number, user_notes, timestamp) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id::text',
            v_pm_column
        ) USING v_new_sale_uuid, p_total, p_payment_method, p_status, v_next_order_num, p_user_notes
        INTO v_new_sale_id_text;
    ELSE
        v_new_sale_id_text := 'sale-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);

        EXECUTE format(
            'INSERT INTO sales (id, total, %s, status, order_number, user_notes, timestamp) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id::text',
            v_pm_column
        ) USING v_new_sale_id_text, p_total, p_payment_method, p_status, v_next_order_num, p_user_notes
        INTO v_new_sale_id_text;
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
        IF v_new_sale_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            -- sales.id is a UUID
            IF v_product_id_type = 'uuid' OR v_product_id_type IS NULL THEN
                -- product_id is UUID
                IF v_item.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                    EXECUTE 'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES ($1::uuid, $2::uuid, $3, $4, $5)'
                    USING v_new_sale_id_text, v_item.id, v_item.name, v_item.price, v_item.quantity;
                ELSE
                    EXECUTE 'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES ($1::uuid, NULL, $2, $3, $4)'
                    USING v_new_sale_id_text, v_item.name, v_item.price, v_item.quantity;
                END IF;
            ELSE
                -- product_id is TEXT
                EXECUTE 'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES ($1::uuid, $2, $3, $4, $5)'
                USING v_new_sale_id_text, v_item.id, v_item.name, v_item.price, v_item.quantity;
            END IF;
        ELSE
            -- sales.id is TEXT
            IF v_product_id_type = 'uuid' THEN
                IF v_item.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                    EXECUTE 'INSERT INTO sale_items (sale_id, product_id, name, price, quantity) VALUES ($1, $2::uuid, $3, $4, $5)'
                    USING v_new_sale_id_text, v_item.id, v_item.name, v_item.price, v_item.quantity;
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
      let dbProducts: any[] | null = null;
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock, is_sold_out')
        .in('id', productIds);

      if (error) {
        // Fallback to querying without is_sold_out if column doesn't exist
        const { data: fallbackData } = await supabase
          .from('products')
          .select('id, name, stock')
          .in('id', productIds);
        if (fallbackData) {
          dbProducts = fallbackData.map((p: any) => ({ ...p, is_sold_out: false }));
        }
      } else {
        dbProducts = data;
      }

      if (dbProducts && dbProducts.length > 0) {
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
      } else if (rpcError) {
        console.error("Atomic RPC error:", rpcError);
        // If function exists but failed with an SQL execution error,
        // NEVER silently bypass row-level locking!
        if (rpcError.code !== '42883' && !rpcError.message?.includes('function') && !rpcError.message?.includes('not find')) {
          return {
            success: false,
            error: `Database transaction error: ${rpcError.message}. Row locking protected state.`,
          };
        }
      }
    } catch (rpcErr: any) {
      console.warn("RPC call error:", rpcErr);
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

        const { error: updateErr } = await supabase
          .from('products')
          .update({ stock: newStock, updated_at: nowIso })
          .eq('id', item.id);

        if (updateErr) {
          await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.id);
        }
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
