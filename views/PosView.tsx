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
  const isSoldOut = Boolean(product.is_sold_out);
  const isOutOfStock = !isSoldOut && product.stock <= 0;
  const isLowStock = !isSoldOut && product.stock > 0 && product.stock <= 5;
  const isDisabled = isSoldOut || isOutOfStock;

  return (
    <button
      onClick={() => onAddToCart(product)}
      disabled={isDisabled}
      className={`relative rounded-lg shadow-lg overflow-hidden transform transition-all duration-200 group text-left ${
        isDisabled
          ? 'bg-slate-200 dark:bg-slate-800/90 cursor-not-allowed'
          : 'bg-white dark:bg-slate-800 hover:-translate-y-1 hover:shadow-indigo-500/20 active:translate-y-0'
      }`}
    >
      {/* Tilted red border Sold Out stamp overlay matching reference design for sold out or zero stock items */}
      {isDisabled && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none p-1">
          <div className="transform -rotate-12 px-2.5 py-1 sm:px-3 sm:py-1.5 border-2 border-red-500 rounded-lg bg-slate-950/70 backdrop-blur-[0.5px] shadow-lg">
            <span className="text-white font-extrabold text-xs sm:text-sm tracking-wider uppercase whitespace-nowrap drop-shadow">
              SOLD OUT
            </span>
          </div>
        </div>
      )}

      {isLowStock && (
        <div className="absolute top-1.5 right-1.5 bg-amber-400 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm">
          LOW STOCK
        </div>
      )}

      <div className={`p-3.5 sm:p-4 flex flex-col items-center justify-center h-full min-h-[110px] ${isDisabled ? 'opacity-40' : ''}`}>
        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white text-center line-clamp-2">{product.name}</h3>
        <p className="text-indigo-600 dark:text-indigo-400 font-bold mt-1.5 text-lg sm:text-xl">₹{product.price.toFixed(2)}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
          {isDisabled ? 'Sold Out' : `Stock: ${product.stock}`}
        </p>
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

const ManualSaleModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: (amount: number, paymentMethod: PaymentMethod, notes: string) => void; }> = ({ isOpen, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const { addToast } = useToasts();

  const handleConfirm = (paymentMethod: PaymentMethod) => {
    const numericAmount = parseFloat(amount);
    if (!isNaN(numericAmount) && numericAmount > 0) {
      onConfirm(numericAmount, paymentMethod, notes);
      setAmount('');
      setNotes('');
    } else {
      addToast("Please enter a valid amount.", 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-2xl font-bold mb-6 text-center">Manual Receipt Entry</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="manual-amount" className="block text-sm font-medium text-slate-500 dark:text-slate-300">Total Amount (₹)</label>
          <input type="number" id="manual-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="0.01" step="0.01" required
            className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-2xl text-center"
          />
        </div>
        <div>
          <label htmlFor="manual-notes" className="block text-sm font-medium text-slate-500 dark:text-slate-300">Notes (Optional)</label>
          <input type="text" id="manual-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter details..."
            className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
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
  const [completedPaymentDetails, setCompletedPaymentDetails] = useState<{
    method: PaymentMethod;
    tendered?: number;
    change?: number;
  } | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useLocalStorage<string>('posUserNotes', '');
  const { addToast } = useToasts();

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  const tenderedNumeric = parseFloat(tenderedAmount) || 0;
  const changeDue = Math.max(0, tenderedNumeric - cartTotal);
  const isShort = tenderedAmount !== '' && tenderedNumeric < cartTotal;

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !activeCategoryId || product.category_id === activeCategoryId;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategoryId]);

  const handleAddToCart = (product: Product) => {
    if (product.is_sold_out) {
      addToast(`${product.name} is currently sold out`, 'warning');
      return;
    }
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity < product.stock) {
          return prevItems.map(item =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          addToast(`${product.name} is sold out (stock limit reached)`, 'warning');
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
    setCompletedPaymentDetails(null);
    setSelectedMethod(PaymentMethod.CASH);
    setTenderedAmount(cartTotal > 0 ? cartTotal.toString() : '');
    setPaymentModalOpen(true);
  };

  const handleDenominationClick = (amount: number) => {
    setTenderedAmount(amount.toString());
  };

  const handleConfirmPayment = async () => {
    if (selectedMethod === PaymentMethod.CASH) {
      if (tenderedNumeric < cartTotal) {
        addToast(`Tendered amount (₹${tenderedNumeric}) is less than total (₹${cartTotal.toFixed(2)})`, 'error');
        return;
      }
    }

    setIsProcessingPayment(true);
    const saleData = {
      items: cartItems.map(({ stock, categories, category_id, cost_price, is_sold_out, ...item }) => item),
      total: cartTotal,
      paymentMethod: selectedMethod,
      userNotes,
    };
    
    try {
      const newSale = await onAddSale(saleData);
      if (newSale) {
        setCompletedSale(newSale);
        setCompletedPaymentDetails({
          method: selectedMethod,
          tendered: selectedMethod === PaymentMethod.CASH ? tenderedNumeric : undefined,
          change: selectedMethod === PaymentMethod.CASH ? changeDue : undefined,
        });
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
  
  const handleConfirmManualSale = (amount: number, paymentMethod: PaymentMethod, notes: string) => {
    if (amount <= 0) return;
    const saleData = {
      items: [{
        id: `manual-${Date.now()}`, name: 'Manual Sale', price: amount, quantity: 1,
      }],
      total: amount,
      paymentMethod,
      userNotes: notes,
    };
    onAddSale(saleData);
    setManualSaleModalOpen(false);
  };

  const handleNewOrder = () => {
    setCompletedSale(null);
    setCompletedPaymentDetails(null);
    setTenderedAmount('');
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
          <div className="animate-fade-in text-center p-2">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-green-600 dark:text-green-400">Payment Successful!</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm uppercase tracking-wider font-semibold">Order Token</p>
            <p className="text-6xl sm:text-7xl font-black text-indigo-600 dark:text-indigo-400 my-2 tracking-tight">#{completedSale.order_number}</p>
            
            <div className="my-5 p-4 bg-slate-100 dark:bg-slate-700/60 rounded-xl space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Paid:</span>
                <span className="font-bold">₹{completedSale.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Payment Method:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{completedSale.paymentMethod}</span>
              </div>
              {completedPaymentDetails?.method === PaymentMethod.CASH && completedPaymentDetails.tendered !== undefined && (
                <>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-2">
                    <span className="text-slate-500 dark:text-slate-400">Cash Received:</span>
                    <span className="font-semibold">₹{completedPaymentDetails.tendered.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-green-600 dark:text-green-400">
                    <span>Change Returned:</span>
                    <span>₹{(completedPaymentDetails.change || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleNewOrder}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-indigo-500 active:scale-[0.99] transition-all duration-200 text-base"
            >
              Start Next Order
            </button>
          </div>
        ) : (
          <div className="p-1">
            <h2 className="text-2xl font-bold mb-4 text-center">Complete Payment</h2>
            
            {/* Amount Summary */}
            <div className="bg-slate-100 dark:bg-slate-700/60 p-4 rounded-xl text-center mb-5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Amount Due</span>
              <p className="text-4xl font-black text-slate-900 dark:text-white mt-1">₹{cartTotal.toFixed(2)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cartItems.reduce((acc, i) => acc + i.quantity, 0)} items in order</p>
            </div>

            {/* Payment Method Selector */}
            <div className="flex rounded-xl bg-slate-200 dark:bg-slate-700 p-1 mb-5">
              <button
                type="button"
                onClick={() => setSelectedMethod(PaymentMethod.CASH)}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 ${
                  selectedMethod === PaymentMethod.CASH
                    ? 'bg-white dark:bg-slate-800 text-green-600 dark:text-green-400 shadow'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                💵 Cash
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod(PaymentMethod.UPI)}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 ${
                  selectedMethod === PaymentMethod.UPI
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                📱 UPI
              </button>
            </div>

            {/* Cash Calculator View */}
            {selectedMethod === PaymentMethod.CASH ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="tendered-amount" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Cash Tendered (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-lg font-bold text-slate-400">₹</span>
                    <input
                      id="tendered-amount"
                      type="number"
                      step="1"
                      min="0"
                      value={tenderedAmount}
                      onChange={(e) => setTenderedAmount(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Quick denomination chips */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Quick Denominations</span>
                  <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleDenominationClick(cartTotal)}
                      className="py-1.5 px-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                    >
                      Exact
                    </button>
                    {[50, 100, 200, 500].map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => handleDenominationClick(amount)}
                        className={`py-1.5 px-2 border text-xs font-bold rounded-lg transition-colors ${
                          tenderedNumeric === amount
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        ₹{amount}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change Breakdown */}
                {tenderedAmount !== '' && (
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    isShort
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                      : 'bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200'
                  }`}>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider">
                        {isShort ? 'Remaining Needed' : 'Change to Return'}
                      </p>
                      <p className="text-xs opacity-75 mt-0.5">
                        {isShort ? 'Insufficient cash tendered' : 'Return to customer before closing'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black">
                        ₹{isShort ? (cartTotal - tenderedNumeric).toFixed(2) : changeDue.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessingPayment || isShort}
                  className="w-full mt-2 bg-green-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:bg-green-500 transition-all duration-200 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-base flex items-center justify-center gap-2"
                >
                  {isProcessingPayment ? (
                    'Processing Order...'
                  ) : (
                    <>
                      <span>Complete Cash Sale</span>
                      {changeDue > 0 && <span className="text-xs bg-green-700 px-2 py-0.5 rounded-full font-semibold">Change ₹{changeDue.toFixed(0)}</span>}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-5 text-center">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">UPI Confirmation</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                    Request customer to scan counter QR code or send payment of <strong className="text-slate-900 dark:text-white">₹{cartTotal.toFixed(2)}</strong>.
                  </p>
                </div>

                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessingPayment}
                  className="w-full bg-blue-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg hover:bg-blue-500 transition-all duration-200 disabled:bg-slate-500 text-base flex items-center justify-center gap-2"
                >
                  {isProcessingPayment ? 'Processing...' : 'Confirm UPI Payment Received'}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ManualSaleModal isOpen={isManualSaleModalOpen} onClose={() => setManualSaleModalOpen(false)} onConfirm={handleConfirmManualSale} />
      <NotesModal isOpen={isNotesModalOpen} initialNotes={userNotes} onClose={() => setNotesModalOpen(false)} onSave={handleSaveNotes} />
    </div>
  );
};

export default PosView;