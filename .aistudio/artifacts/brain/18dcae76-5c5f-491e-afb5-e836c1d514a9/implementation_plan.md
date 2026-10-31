# Concurrency Control & Atomic Checkout Implementation Plan

Prevent overselling and race conditions when multiple cashiers simultaneously attempt to sell the last items in stock.

## Proposed Changes

### 1. Database Atomic Checkout RPC (`supabase/migrations/process_atomic_checkout.sql`)
- Create a PostgreSQL stored procedure `process_atomic_checkout`:
  - Accepts cart items, total, payment method, and optional customer/user notes.
  - Locks product rows using `SELECT ... FOR UPDATE` to serialize concurrent checkout attempts.
  - Validates that `product.stock >= item.quantity` for every item in the cart.
  - If any product has insufficient stock, raises an `INSUFFICIENT_STOCK` exception detailing product ID, name, requested quantity, and actual available stock.
  - Atomically decrements `stock = stock - item.quantity` for all purchased products.
  - Generates the next sequential `order_number` within the same transaction to prevent duplicate order numbers across devices.
  - Inserts records into `sales` and `sale_items` tables atomically.
  - Returns the newly created sale record.

### 2. POS Concurrency & Fallback Service (`/lib/checkoutService.ts`)
- Implement `executeCheckoutWithConcurrencyGuard`:
  - Attempts the `process_atomic_checkout` RPC first for database-level ACID transactions.
  - If the database returns `INSUFFICIENT_STOCK`, parses the conflicting items and available stock counts.
  - Provides a robust fallback when running without the RPC (e.g. initial setup or local storage demo):
    - Fetches fresh remote product stock in real time immediately before order execution.
    - Validates cart against live stock.
    - Applies conditional stock updates to protect against stale client state.

### 3. POS View Conflict Handling & Cart Auto-Adjustment (`/views/PosView.tsx`)
- When a stock conflict occurs during checkout:
  - Display a detailed warning modal informing the cashier which items ran out of stock or have limited availability.
  - Automatically adjust cart item quantities to match remaining stock (or remove items with 0 stock).
  - Update the displayed total and cart inputs immediately so the cashier can proceed or cancel without friction.
- Add live inventory warning indicators in the cart if an item's stock drops while an order is being prepared.

### 4. Realtime Subscription & Instant State Sync (`/App.tsx`)
- Re-architect `handleAddSale` to route through the concurrency-guarded checkout flow.
- Ensure Supabase Realtime channel reliably syncs product stock updates to all connected devices in sub-second intervals.
- Provide immediate feedback to cashiers when other devices complete an order that affects items in their current cart.

### 5. Settings View Concurrency & SQL Utility (`/views/SettingsView.tsx`)
- Add an "Atomic Transactions & Concurrency" section in Settings:
  - Displays the `process_atomic_checkout` SQL script with a 1-click "Copy SQL to Clipboard" button.
  - Provides an automated RPC health check button to verify whether the stored procedure is installed and active in Supabase.

---

## User Review Required

> [!IMPORTANT]
> The atomic transaction uses a Supabase RPC function (`process_atomic_checkout`). We provide the SQL migration and a 1-click copy feature in Settings so you can run it in your Supabase SQL editor. The application also includes an automatic client-side pre-verification fallback so orders remain protected even before the SQL function is executed.

---

## Verification Plan

### Automated / Code Validation
- Run TypeScript build check (`npm run build` / `compile_applet`) to ensure clean compilation without type errors.
- Run `lint_applet` to verify code quality.

### Manual Concurrency & Edge-Case Testing
1. **Single Item Race Condition**:
   - Set product stock to 1.
   - Add 1 quantity to cart on Device / Tab A, and 1 quantity to cart on Device / Tab B.
   - Complete checkout on Tab A -> Order succeeds, stock drops to 0.
   - Attempt checkout on Tab B -> Checkout rejected with alert: *"Product is out of stock"*, and Tab B's cart automatically updates to reflect 0 remaining.
2. **Partial Stock Available**:
   - Set product stock to 2.
   - Add 3 quantities to cart.
   - Checkout is blocked with clear prompt indicating only 2 are available, auto-adjusting cart quantity to 2.
3. **Sequential Order Number Integrity**:
   - Verify simultaneous checkout requests receive distinct, monotonically increasing order numbers without gaps or duplicates.
4. **Offline / Fallback Resilience**:
   - Test checkout flow in local mode (when Supabase credentials are not provided) to ensure standard local POS operation remains functional.
