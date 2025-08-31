import React, { useState, useMemo } from 'react';
import type { Product, CartItem, SaleItem } from '../types';
import { PaymentMethod } from '../types';
import Modal from '../components/Modal';
import { XIcon, ReceiptIcon } from '../components/icons/Icons';

interface PosViewProps {
  products: Product[];
  onAddSale: (sale: { items: SaleItem[], total: number, paymentMethod: string }) => void;
}

const ProductCard: React.FC<{ product: Product; onAddToCart: (product: Product) => void }> = ({ product, onAddToCart }) => {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  return (
    <button
      onClick={() => onAddToCart(product)}
      disabled={isOutOfStock}
      className={`relative rounded-lg shadow-lg overflow-hidden transform transition-transform duration-200 group ${
        isOutOfStock
          ? 'bg-slate-700 cursor-not-allowed'
          : 'bg-slate-800 hover:scale-105 hover:shadow-indigo-500/30'
      }`}
    >
      {isOutOfStock && (
        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
          <span className="text-white font-bold text-lg rotate-12 border-2 border-red-500 px-4 py-1 rounded">OUT OF STOCK</span>
        </div>
      )}
      {isLowStock && (
        <div className="absolute top-1 right-1 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full z-10">
          LOW STOCK
        </div>
       )}
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <h3 className="text-lg font-bold text-white text-center">{product.name}</h3>
        <p className="text-indigo-400 font-semibold mt-2 text-xl">₹{product.price.toFixed(2)}</p>
        <p className="text-xs text-slate-400 mt-1">Stock: {product.stock}</p>
      </div>
    </button>
  );
};

const Cart: React.FC<{
  cartItems: CartItem[];
  onUpdateQuantity: (productId: string, newQuantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
  onManualSale: () => void;
}> = ({ cartItems, onUpdateQuantity, onRemoveItem, onCheckout, onManualSale }) => {
  const total = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [cartItems]);

  return (
    <div className="bg-slate-800 rounded-lg shadow-xl h-full flex flex-col p-4">
      <h2 className="text-2xl font-bold text-white border-b border-slate-700 pb-3 mb-4">Current Order</h2>
      {cartItems.length === 0 ? (
        <div className="flex-grow flex items-center justify-center">
          <p className="text-slate-400">Click on an item to add it to the order.</p>
        </div>
      ) : (
        <div className="flex-grow overflow-y-auto pr-2">
          {cartItems.map(item => (
            <div key={item.id} className="flex items-center justify-between mb-4 bg-slate-700 p-3 rounded-lg">
              <div>
                <p className="font-semibold text-white">{item.name}</p>
                <p className="text-sm text-indigo-400">₹{item.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={item.stock}
                  value={item.quantity}
                  onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value, 10))}
                  className="w-16 bg-slate-800 text-white rounded-md border border-slate-600 text-center"
                />
                <button onClick={() => onRemoveItem(item.id)} className="text-red-500 hover:text-red-400 p-1">
                  <XIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-slate-700 pt-4 mt-4">
        <div className="flex justify-between items-center text-2xl font-bold text-white mb-4">
          <span>Total:</span>
          <span>₹{total.toFixed(2)}</span>
        </div>
        <div className="space-y-2">
          <button
            onClick={onCheckout}
            disabled={cartItems.length === 0}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-indigo-500 transition-colors duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            Proceed to Payment
          </button>
          <button
            onClick={onManualSale}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 text-slate-300 font-semibold py-2 rounded-lg shadow-lg hover:bg-slate-600 transition-colors duration-200"
          >
            <ReceiptIcon />
            Manual Receipt Entry
          </button>
        </div>
      </div>
    </div>
  );
};

const ManualSaleModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number, paymentMethod: PaymentMethod) => void;
}> = ({ isOpen, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');

  const handleConfirm = (paymentMethod: PaymentMethod) => {
    const numericAmount = parseFloat(amount);
    if (!isNaN(numericAmount) && numericAmount > 0) {
      onConfirm(numericAmount, paymentMethod);
      setAmount(''); // Reset for next time
    } else {
      alert("Please enter a valid amount.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-2xl font-bold mb-6 text-white text-center">Manual Receipt Entry</h2>
      <div className="space-y-4">
        <label htmlFor="manual-amount" className="block text-sm font-medium text-slate-300">Total Amount (₹)</label>
        <input
          type="number"
          name="manual-amount"
          id="manual-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          min="0.01"
          step="0.01"
          required
          className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-2xl text-center"
        />
      </div>
      <div className="mt-6">
        <p className="text-sm font-medium text-slate-300 text-center mb-3">Select Payment Method</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => handleConfirm(PaymentMethod.CASH)}
            className="flex-1 bg-green-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-green-500 transition-colors duration-200 disabled:opacity-50"
            disabled={!amount}
          >
            Cash
          </button>
          <button
            onClick={() => handleConfirm(PaymentMethod.UPI)}
            className="flex-1 bg-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-blue-500 transition-colors duration-200 disabled:opacity-50"
            disabled={!amount}
          >
            UPI
          </button>
        </div>
      </div>
    </Modal>
  );
};


const PosView: React.FC<PosViewProps> = ({ products, onAddSale }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isManualSaleModalOpen, setManualSaleModalOpen] = useState(false);

  const handleAddToCart = (product: Product) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity < product.stock) {
          return prevItems.map(item =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return prevItems; // Don't add more than available in stock
      }
      return [...prevItems, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity > 0 ? newQuantity : 1 } : item
      )
    );
  };
  
  const handleRemoveItem = (productId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId));
  };

  const handleCheckout = () => {
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = (paymentMethod: PaymentMethod) => {
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const saleData = {
      items: cartItems.map(({ stock, ...item }) => item),
      total,
      paymentMethod,
    };
    onAddSale(saleData);
    setCartItems([]);
    setPaymentModalOpen(false);
  };
  
  const handleConfirmManualSale = (amount: number, paymentMethod: PaymentMethod) => {
    if (amount <= 0) return;
    const saleData = {
      items: [{
        id: `manual-${Date.now()}`,
        name: 'Manual Sale',
        price: amount,
        quantity: 1,
      }],
      total: amount,
      paymentMethod,
    };
    onAddSale(saleData);
    setManualSaleModalOpen(false);
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" style={{ height: 'calc(100vh - 100px)' }}>
      <div className="lg:col-span-2 overflow-y-auto pr-2">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map(product => (
            <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
          ))}
        </div>
      </div>
      <div className="lg:col-span-1">
        <Cart
          cartItems={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onCheckout={handleCheckout}
          onManualSale={() => setManualSaleModalOpen(true)}
        />
      </div>
      
      <Modal isOpen={isPaymentModalOpen} onClose={() => setPaymentModalOpen(false)}>
        <h2 className="text-2xl font-bold mb-6 text-white text-center">Select Payment Method</h2>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => handleConfirmPayment(PaymentMethod.CASH)}
            className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-green-500 transition-colors duration-200"
          >
            Cash
          </button>
          <button
            onClick={() => handleConfirmPayment(PaymentMethod.UPI)}
            className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-blue-500 transition-colors duration-200"
          >
            UPI
          </button>
        </div>
      </Modal>

      <ManualSaleModal
        isOpen={isManualSaleModalOpen}
        onClose={() => setManualSaleModalOpen(false)}
        onConfirm={handleConfirmManualSale}
      />
    </div>
  );
};

export default PosView;