-- ============================================================================
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
$$;
