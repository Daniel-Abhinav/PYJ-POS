
export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  cost_price?: number | null;
  is_sold_out?: boolean;
  category_id?: string | null;
  categories?: { name: string } | null; // For Supabase JOINs
}

export interface Category {
  id: string;
  name: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export enum PaymentMethod {
  CASH = 'Cash',
  UPI = 'UPI',
}

export interface SaleItem {
  id: string; // This will be the product id or manual id
  name: string;
  price: number;
  quantity: number;
}

export interface Sale {
  id: string;
  timestamp: string;
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
  order_number: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
  cancellation_reason?: string | null;
  admin_notes?: string | null;
  user_notes?: string | null;
}

export interface Session {
  role: 'user' | 'admin';
  loginTimestamp: string; // ISO string
}

export interface StockConflict {
  id: string;
  name: string;
  requested: number;
  available: number;
  reason?: string;
}

export interface CheckoutResult {
  success: boolean;
  sale?: Sale;
  error?: string;
  conflicts?: StockConflict[];
}
