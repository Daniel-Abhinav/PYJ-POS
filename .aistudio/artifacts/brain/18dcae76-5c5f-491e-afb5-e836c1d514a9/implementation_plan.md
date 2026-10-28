# Approved Feature Plan: Community Cafe & Quick-Service POS

A tailored implementation plan containing **only** the features and enhancements selected for this low-key, community cafe POS.

---

## 1. Scope & Approved Features

The plan includes only the specific features you approved, organized across the application:

### A. POS & Checkout (`PosView.tsx`)
1. **Cash Tender & Change Calculator**:
   - In the payment modal when **Cash** is selected:
     - Input field for Tendered Amount.
     - Quick-tap denomination chips: **Exact**, **₹50**, **₹100**, **₹200**, **₹500**.
     - Live **Change to Return** calculation displayed prominently in high-contrast emerald green.
     - Prevents accidental completion if tendered cash is less than the total.
2. **Checkout UX Polish**:
   - Streamlined, high-contrast action buttons.
   - Clean spacing and responsive layout on mobile/tablet screens for volunteers.
   - Clear feedback toast upon transaction completion.

*(Dynamic UPI QR code, Cart Parking, and Item Notes are excluded as requested).*

---

### B. Menu & Inventory Management (`SettingsView.tsx` & `types.ts`)
1. **Quick "Sold Out" Toggle**:
   - Add a 1-tap availability toggle (`is_available` / `is_sold_out`) next to each item in the product list.
   - Sold-out items are instantly greyed out or hidden from cashier selection on `PosView` with a clear "SOLD OUT" badge.
2. **Batch Restock Buttons (+5, +10)**:
   - Add quick increment buttons (`+5`, `+10`) right in the inventory table rows for rapid restocking when a fresh batch of snacks or coffee arrives.
3. **Cost Price Tracking (Net Margin & Profit)**:
   - Add an optional `cost_price` field when adding/editing a product.
   - Automatically calculate unit margin (Price - Cost) and display profit alongside revenue in summaries.

---

### C. Order Tracking & Sales History (`HistoryView.tsx` / `OrdersView.tsx`)
1. **Order Cancellation with Recorded Reason**:
   - Add a "Cancel / Void Order" action with a reason prompt modal (e.g., "Customer Changed Mind", "Duplicate Order", "Spilled / Damaged", "Other").
   - Updates order status to `Cancelled` with audit notes.
   - Automatically returns sold item quantities back into product stock so inventory remains accurate.

---

### D. Reporting & Daily Summaries (`DashboardView.tsx` & `HistoryView.tsx`)
1. **End-of-Day Cash Drawer Closing Summary**:
   - Dedicated modal / drawer breakdown for closing:
     - Total Cash collected vs. Total UPI collected.
     - Net Sales, cancelled orders tally, and estimated net profit (Revenue minus Product Costs).
     - Cash-in-drawer reconciliation for volunteers handing over the register.
2. **Best-Selling Items Leaderboard**:
   - Visual leaderboard ranking top items by volume sold and revenue generated.
3. **Shareable Daily Summary (WhatsApp / Text)**:
   - 1-tap "Share via WhatsApp" or "Copy Summary" button.
   - Generates a clean, formatted text snippet with today's totals, payment breakdown, and top items ready to paste into volunteer/committee group chats.

---

## 2. Implementation Phases

### Phase 1: Data Model & Inventory Enhancements
- Update `types.ts` with optional `cost_price`, `is_sold_out`, and `cancellation_reason`.
- Update `SettingsView.tsx` with:
  - Sold-out toggle button for instant availability switching.
  - Quick `+5` and `+10` batch stock increment buttons.
  - `cost_price` field in product create/edit form.

### Phase 2: POS Checkout Cash Calculator & UX Polish
- Update `PosView.tsx`:
  - Tendered cash input and denomination buttons (`Exact`, `₹50`, `₹100`, `₹200`, `₹500`).
  - Real-time change return indicator.
  - Sold-out item disabled state with visual indicator.
  - Polished touch-friendly layout.

### Phase 3: Order Cancellation & Restock Logic
- Update `HistoryView.tsx` and `OrdersView.tsx`:
  - Add "Cancel Order" action with modal asking for cancellation reason.
  - Mark order as cancelled and trigger stock replenishment for cancelled items.
  - Display cancellation badge and reason in the sales list.

### Phase 4: Reports, Leaderboard & WhatsApp Share
- Update `DashboardView.tsx` / `HistoryView.tsx`:
  - Add Best-Selling Leaderboard card.
  - Add End-of-Day Cash Drawer Summary modal.
  - Add formatted WhatsApp / Text clipboard share button.

---

## 3. Verification Plan

1. **Compilation Check**:
   - Run `compile_applet` to ensure TypeScript types and React components build cleanly without errors.
2. **POS Flow Verification**:
   - Add items to cart, select Cash, test quick denomination chips and change computation.
   - Complete checkout and verify cart resets cleanly.
3. **Inventory & Sold Out Check**:
   - Toggle an item as "Sold Out" in settings; verify it disables immediately on the POS grid.
   - Click `+5` or `+10` on stock; verify stock increment updates correctly.
   - Edit cost price and verify persistence.
4. **Order Cancellation Check**:
   - Cancel an existing order with a reason; verify status reflects "Cancelled" and stock is restored.
5. **Reports & Sharing Check**:
   - Verify cash drawer closing calculates correct cash and UPI splits.
   - Verify top-selling leaderboard computes correct item ranks.
   - Test WhatsApp share text generation and clipboard copy.
