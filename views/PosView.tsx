import React, { useState, useMemo, useEffect } from 'react';
import type { Product, CartItem, SaleItem, Sale, Category } from '../types';
import { PaymentMethod } from '../types';
import Modal from '../components/Modal';
import { XIcon, ReceiptIcon, SearchIcon, NotesIcon } from '../components/icons/Icons';
import useLocalStorage from '../hooks/useLocalStorage';
import { useToasts } from '../components/ToastProvider';

interface PosViewProps {
  products: Product[];
  categories: Category[];
  onAddSale: (sale: { items: SaleItem[], total: number, paymentMethod: string, userNotes?: string }) => Promise<Sale | undefined>;
}

const ProductCard: React.FC<{ product: Product; onAddToCart: (product: Product) => void }> = ({ product, onAddToCart }) => {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  return (
    <button
      onClick={() => onAddToCart(product)}
      disabled={isOutOfStock}
      className={`relative rounded-lg shadow-lg overflow-hidden transform transition-all duration-300 group animate-fade-in ${
        isOutOfStock
          ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-60'
          : 'bg-white dark:bg-slate-800 hover:-translate-y-1 hover:shadow-indigo-500/30'
      }`}
    >
      {isOutOfStock && (
        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
          <span className="text-white font-bold text-lg rotate-12 border-2 border-red-500 px-4 py-1 rounded">OUT OF STOCK</span>
        </div>
      )}
      {isLowStock && (
        <div className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full z-10">
          LOW STOCK
        </div>
       )}
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white text-center">{product.name}</h3>
        <p className="text-indigo-500 dark:text-indigo-400 font-semibold mt-2 text-xl">₹{product.price.toFixed(2)}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Stock: {product.stock}</p>
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
  onAddNotes: () => void;
  userNotes: string;
}> = ({ cartItems, onUpdateQuantity, onRemoveItem, onCheckout, onManualSale, onAddNotes, userNotes }) => {
  const total = useMemo(() => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [cartItems]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl h-full flex flex-col p-4">
      <div className="flex justify-between items-baseline border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
        <h2 className="text-2xl font-bold">Current Order</h2>
        <button onClick={onAddNotes} className={`p-2 rounded-full transition-colors ${userNotes ? 'text-indigo-500 bg-indigo-100 dark:bg-slate-700' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
          <NotesIcon />
        </button>
      </div>
      {cartItems.length === 0 ? (
        <div className="flex-grow flex items-center justify-center">
          <p className="text-slate-500 dark:text-slate-400">Click an item to add it to the order.</p>
        </div>
      ) : (
        <div className="flex-grow overflow-y-auto pr-2">
          {cartItems.map(item => (
            <div key={item.id} className="flex items-center justify-between mb-4 bg-slate-100 dark:bg-slate-700 p-3 rounded-lg animate-fade-in-right">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-indigo-500 dark:text-indigo-400">₹{item.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={item.stock}
                  value={item.quantity}
                  onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value, 10))}
                  className="w-16 bg-white dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-600 text-center"
                />
                <button onClick={() => onRemoveItem(item.id)} className="text-red-500 hover:text-red-400 p-1">
                  <XIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
        <div className="flex justify-between items-center text-2xl font-bold mb-4">
          <span>Total:</span>
          <span>₹{total.toFixed(2)}</span>
        </div>
        <div className="space-y-2">
          <button
            onClick={onCheckout}
            disabled={cartItems.length === 0}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-indigo-500 transition-colors duration-200 disabled:bg-slate-500 disabled:cursor-not-allowed"
          >
            Proceed to Payment
          </button>
          <button
            onClick={onManualSale}
            className="w-full flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold py-2 rounded-lg shadow-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200"
          >
            <ReceiptIcon />
            Manual Receipt Entry
          </button>
        </div>
      </div>
    </div>
  );
};

const ManualSaleModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: (amount: number, paymentMethod: PaymentMethod) => void; }> = ({ isOpen, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const { addToast } = useToasts();

  const handleConfirm = (paymentMethod: PaymentMethod) => {
    const numericAmount = parseFloat(amount);
    if (!isNaN(numericAmount) && numericAmount > 0) {
      onConfirm(numericAmount, paymentMethod);
      setAmount('');
    } else {
      addToast("Please enter a valid amount.", 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-2xl font-bold mb-6 text-center">Manual Receipt Entry</h2>
      <div className="space-y-4">
        <label htmlFor="manual-amount" className="block text-sm font-medium text-slate-500 dark:text-slate-300">Total Amount (₹)</label>
        <input type="number" id="manual-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01" required
          className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-2xl text-center"
        />
      </div>
      <div className="mt-6">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-300 text-center mb-3">Select Payment Method</p>
        <div className="flex justify-center gap-4">
          <button onClick={() => handleConfirm(PaymentMethod.CASH)} className="flex-1 bg-green-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-green-500 transition-colors duration-200 disabled:opacity-50" disabled={!amount}>Cash</button>
          <button onClick={() => handleConfirm(PaymentMethod.UPI)} className="flex-1 bg-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-blue-500 transition-colors duration-200 disabled:opacity-50" disabled={!amount}>UPI</button>
        </div>
      </div>
    </Modal>
  );
};

const NotesModal: React.FC<{ isOpen: boolean; initialNotes: string; onClose: () => void; onSave: (notes: string) => void; }> = ({ isOpen, initialNotes, onClose, onSave }) => {
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => { setNotes(initialNotes) }, [initialNotes, isOpen]);
  
  const handleSave = () => {
    onSave(notes);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <h2 className="text-2xl font-bold mb-4">Order Notes</h2>
        <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Add any special instructions or notes for this order..."
            autoFocus
        />
        <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">Cancel</button>
            <button onClick={handleSave} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-500 transition-colors">Save Notes</button>
        </div>
    </Modal>
  );
};


const PosView: React.FC<PosViewProps> = ({ products, categories, onAddSale }) => {
  const [cartItems, setCartItems] = useLocalStorage<CartItem[]>('posCartItems', []);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isManualSaleModalOpen, setManualSaleModalOpen] = useState(false);
  const [isNotesModalOpen, setNotesModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useLocalStorage<string>('posUserNotes', '');
  const { addToast } = useToasts();

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !activeCategoryId || product.category_id === activeCategoryId;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategoryId]);

  const handleAddToCart = (product: Product) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity < product.stock) {
          return prevItems.map(item =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          addToast(`${product.name} is out of stock`, 'warning');
        }
        return prevItems;
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
    setCompletedSale(null);
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (paymentMethod: PaymentMethod) => {
    setIsProcessingPayment(true);
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const saleData = {
      items: cartItems.map(({ stock, categories, category_id, ...item }) => item),
      total,
      paymentMethod,
      userNotes,
    };
    
    try {
      const newSale = await onAddSale(saleData);
      if (newSale) {
        setCompletedSale(newSale);
        setCartItems([]);
        setUserNotes('');
      } else {
        setPaymentModalOpen(false);
      }
    } catch (error) {
        console.error("Error confirming payment:", error);
        setPaymentModalOpen(false);
    } finally {
        setIsProcessingPayment(false);
    }
  };
  
  const handleConfirmManualSale = (amount: number, paymentMethod: PaymentMethod) => {
    if (amount <= 0) return;
    const saleData = {
      items: [{
        id: `manual-${Date.now()}`, name: 'Manual Sale', price: amount, quantity: 1,
      }],
      total: amount,
      paymentMethod,
    };
    onAddSale(saleData);
    setManualSaleModalOpen(false);
  };

  const handleNewOrder = () => {
    setCompletedSale(null);
    setPaymentModalOpen(false);
  };
  
  const handleSaveNotes = (notes: string) => {
    setUserNotes(notes);
    addToast('Notes saved for this order.', 'success');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: 'calc(100vh - 100px)' }}>
      <div className="lg:col-span-2 flex flex-col h-full">
        {/* Product Filters */}
        <div className="flex-shrink-0 mb-4">
            <div className="relative mb-4">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <SearchIcon/>
                </span>
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-full bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveCategoryId(null)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${!activeCategoryId ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>All</button>
                {categories.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCategoryId(cat.id)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${activeCategoryId === cat.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>{cat.name}</button>
                ))}
            </div>
        </div>

        {/* Product Grid */}
        <div className="flex-grow overflow-y-auto pr-2 -mr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
            ))}
             {filteredProducts.length === 0 && <p className="col-span-full text-center text-slate-500 py-8">No products match your search.</p>}
          </div>
        </div>
      </div>
      <div className="lg:col-span-1 h-full">
        <Cart
          cartItems={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onCheckout={handleCheckout}
          onManualSale={() => setManualSaleModalOpen(true)}
          onAddNotes={() => setNotesModalOpen(true)}
          userNotes={userNotes}
        />
      </div>
      
      <Modal isOpen={isPaymentModalOpen} onClose={handleNewOrder}>
        {completedSale ? (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-center text-green-500 dark:text-green-400">Payment Successful!</h2>
            <p className="text-center text-slate-500 dark:text-slate-300 mt-4">Order Number:</p>
            <p className="text-center text-7xl font-bold text-indigo-500 dark:text-indigo-400 my-4 tracking-tight">#{completedSale.order_number}</p>
            <button
              onClick={handleNewOrder}
              className="w-full mt-6 bg-indigo-600 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-indigo-500 transition-colors duration-200"
            >
              Start New Order
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center">Select Payment Method</h2>
            <div className="flex justify-center gap-4">
              <button onClick={() => handleConfirmPayment(PaymentMethod.CASH)} disabled={isProcessingPayment} className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-green-500 transition-colors duration-200 disabled:bg-slate-500 disabled:cursor-wait">
                {isProcessingPayment ? 'Processing...' : 'Cash'}
              </button>
              <button onClick={() => handleConfirmPayment(PaymentMethod.UPI)} disabled={isProcessingPayment} className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-blue-500 transition-colors duration-200 disabled:bg-slate-500 disabled:cursor-wait">
                {isProcessingPayment ? 'Processing...' : 'UPI'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ManualSaleModal isOpen={isManualSaleModalOpen} onClose={() => setManualSaleModalOpen(false)} onConfirm={handleConfirmManualSale} />
      <NotesModal isOpen={isNotesModalOpen} initialNotes={userNotes} onClose={() => setNotesModalOpen(false)} onSave={handleSaveNotes} />
    </div>
  );
};

export default PosView;