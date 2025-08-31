export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
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
}