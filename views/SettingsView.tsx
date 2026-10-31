import React, { useState, useEffect } from 'react';
import type { Product, Category } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, PencilIcon, TrashIcon, TagIcon } from '../components/icons/Icons';
import { checkRpcAvailability } from '../lib/checkoutService';
import { useToasts } from '../components/ToastProvider';

interface SettingsViewProps {
  products: Product[];
  categories: Category[];
  onSaveProduct: (product: Omit<Product, 'id'> & { id?: string }) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onSaveCategory: (category: Omit<Category, 'id'> & { id?: string }) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onGlobalLogout: () => Promise<void>;
}

const ProductForm: React.FC<{
  product: Product | null;
  categories: Category[];
  onSave: (product: Omit<Product, 'id'> & { id?: string }) => void;
  onClose: () => void;
}> = ({ product, categories, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    cost_price: '',
    stock: '',
    category_id: ''
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        price: product.price !== undefined && product.price !== null ? product.price.toString() : '',
        cost_price: product.cost_price !== undefined && product.cost_price !== null ? product.cost_price.toString() : '',
        stock: product.stock !== undefined && product.stock !== null ? product.stock.toString() : '',
        category_id: product.category_id || ''
      });
    } else {
      setFormData({ name: '', price: '', cost_price: '', stock: '', category_id: '' });
    }
  }, [product]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const sellingPrice = parseFloat(formData.price) || 0;
  const costPrice = formData.cost_price.trim() !== '' ? parseFloat(formData.cost_price) : null;
  const hasCost = costPrice !== null && !isNaN(costPrice);
  const profitMargin = hasCost ? sellingPrice - (costPrice || 0) : null;
  const profitPercentage = hasCost && sellingPrice > 0 ? ((profitMargin! / sellingPrice) * 100) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(formData.price);
    const parsedStock = parseInt(formData.stock, 10);
    const parsedCost = formData.cost_price.trim() !== '' ? parseFloat(formData.cost_price) : null;

    const dataToSave = {
      name: formData.name.trim(),
      price: isNaN(parsedPrice) ? 0 : Math.max(0, parsedPrice),
      cost_price: parsedCost !== null && !isNaN(parsedCost) ? Math.max(0, parsedCost) : null,
      stock: isNaN(parsedStock) ? 0 : Math.max(0, parsedStock),
      is_sold_out: product ? product.is_sold_out : false,
      category_id: formData.category_id || null,
    };
    if (product) {
      onSave({ ...dataToSave, id: product.id });
    } else {
      onSave(dataToSave);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-2xl font-bold mb-6">{product ? 'Edit Product' : 'Add New Product'}</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-500 dark:text-slate-300">Product Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="category_id" className="block text-sm font-medium text-slate-500 dark:text-slate-300">Category</label>
          <select
            id="category_id"
            name="category_id"
            value={formData.category_id}
            onChange={handleChange}
            className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Uncategorized</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-slate-500 dark:text-slate-300">Selling Price (₹)</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              onFocus={(e) => e.target.select()}
              placeholder="0.00"
              required
              min="0"
              step="0.01"
              className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 font-semibold"
            />
          </div>
          <div>
            <label htmlFor="cost_price" className="block text-sm font-medium text-slate-500 dark:text-slate-300">
              Cost Price (₹) <span className="text-xs text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="number"
              id="cost_price"
              name="cost_price"
              value={formData.cost_price}
              onChange={handleChange}
              onFocus={(e) => e.target.select()}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 font-semibold"
            />
          </div>
        </div>

        {/* Dynamic Margin Indicator */}
        {hasCost && sellingPrice > 0 && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Estimated Profit Margin:</span>
            <span className={`font-bold ${profitMargin! >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              ₹{profitMargin!.toFixed(2)} ({profitPercentage!.toFixed(1)}%)
            </span>
          </div>
        )}

        <div>
          <label htmlFor="stock" className="block text-sm font-medium text-slate-500 dark:text-slate-300">Stock Count</label>
          <input
            type="number"
            id="stock"
            name="stock"
            value={formData.stock}
            onChange={handleChange}
            onFocus={(e) => e.target.select()}
            placeholder="0"
            min="0"
            step="1"
            className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1">Quick Add:</span>
            <button
              type="button"
              onClick={() => {
                const cur = parseInt(formData.stock, 10) || 0;
                setFormData(prev => ({ ...prev, stock: (cur + 1).toString() }));
              }}
              className="px-2 py-0.5 text-xs font-bold rounded bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-colors shadow-sm active:scale-95"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => {
                const cur = parseInt(formData.stock, 10) || 0;
                setFormData(prev => ({ ...prev, stock: (cur + 5).toString() }));
              }}
              className="px-2 py-0.5 text-xs font-bold rounded bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-colors shadow-sm active:scale-95"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => {
                const cur = parseInt(formData.stock, 10) || 0;
                setFormData(prev => ({ ...prev, stock: (cur + 10).toString() }));
              }}
              className="px-2 py-0.5 text-xs font-bold rounded bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-colors shadow-sm active:scale-95"
            >
              +10
            </button>
            <button
              type="button"
              onClick={() => {
                const cur = parseInt(formData.stock, 10) || 0;
                setFormData(prev => ({ ...prev, stock: (cur + 25).toString() }));
              }}
              className="px-2 py-0.5 text-xs font-bold rounded bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-colors shadow-sm active:scale-95"
            >
              +25
            </button>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
        <button type="submit" className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-500">Save Product</button>
      </div>
    </form>
  );
};


const StockEditModal: React.FC<{
  product: Product | null;
  onSave: (product: Omit<Product, 'id'> & { id?: string }) => Promise<void>;
  onClose: () => void;
}> = ({ product, onSave, onClose }) => {
  if (!product) return null;

  const [stockInput, setStockInput] = useState<string>(product.stock.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setStockInput(product.stock.toString());
    }
  }, [product]);

  const handleAdd = (delta: number) => {
    const cur = parseInt(stockInput, 10) || 0;
    setStockInput(Math.max(0, cur + delta).toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(stockInput, 10);
    const newStock = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setIsSubmitting(true);
    try {
      await onSave({ ...product, stock: newStock });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-1 text-slate-900 dark:text-white">Edit Stock Count</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Adjust inventory for <span className="font-semibold text-slate-800 dark:text-slate-200">{product.name}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="modal-stock-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Stock Count
          </label>
          <div className="relative">
            <input
              type="number"
              id="modal-stock-input"
              value={stockInput}
              onChange={(e) => setStockInput(e.target.value)}
              onFocus={(e) => e.target.select()}
              min="0"
              step="1"
              required
              className="block w-full text-center text-3xl font-extrabold py-3 px-4 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Quick Restock Buttons appear only here when editing stock count */}
        <div className="bg-slate-50 dark:bg-slate-700/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
            Quick Restock:
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleAdd(1)}
              className="py-2 px-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-600 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all shadow-sm active:scale-95 border border-slate-200 dark:border-slate-500 text-slate-700 dark:text-slate-200"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => handleAdd(5)}
              className="py-2 px-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-600 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all shadow-sm active:scale-95 border border-slate-200 dark:border-slate-500 text-slate-700 dark:text-slate-200"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => handleAdd(10)}
              className="py-2 px-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-600 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all shadow-sm active:scale-95 border border-slate-200 dark:border-slate-500 text-slate-700 dark:text-slate-200"
            >
              +10
            </button>
            <button
              type="button"
              onClick={() => handleAdd(25)}
              className="py-2 px-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-600 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-all shadow-sm active:scale-95 border border-slate-200 dark:border-slate-500 text-slate-700 dark:text-slate-200"
            >
              +25
            </button>
          </div>
          <div className="mt-2 flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-600/70 text-xs text-slate-400">
            <span>Current in inventory: <strong className="text-slate-700 dark:text-slate-200">{product.stock}</strong></span>
            <button
              type="button"
              onClick={() => setStockInput('0')}
              className="text-red-500 hover:text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              Set to 0
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-indigo-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-indigo-500 transition-colors shadow-md disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Stock'}
          </button>
        </div>
      </form>
    </div>
  );
};

const CategoryManager: React.FC<{
  categories: Category[];
  onSave: (category: Omit<Category, 'id'> & { id?: string }) => Promise<void>;
  onDelete: (categoryId: string) => Promise<void>;
}> = ({ categories, onSave, onDelete }) => {
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [isDeleting, setIsDeleting] = useState<Category | null>(null);
    const [name, setName] = useState('');

    const handleEdit = (cat: Category) => {
        setEditingCategory(cat);
        setName(cat.name);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave({ id: editingCategory?.id, name: name.trim() });
            setName('');
            setEditingCategory(null);
        }
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-lg">
            <h3 className="text-2xl font-bold mb-4">Manage Categories</h3>
            <form onSubmit={handleSave} className="flex gap-2 mb-4">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={editingCategory ? "Edit category name..." : "New category name..."}
                    className="flex-grow bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500" />
                <button type="submit" className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-500">{editingCategory ? 'Update' : 'Add'}</button>
                {editingCategory && <button type="button" onClick={() => { setEditingCategory(null); setName(''); }} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg">Cancel</button>}
            </form>
            <ul className="space-y-2">
                {categories.map(cat => (
                    <li key={cat.id} className="flex justify-between items-center p-2 rounded-md bg-slate-100 dark:bg-slate-700/50">
                        <span>{cat.name}</span>
                        <div className="flex gap-2">
                            <button onClick={() => handleEdit(cat)} className="text-blue-500 hover:text-blue-400 p-1"><PencilIcon/></button>
                            <button onClick={() => setIsDeleting(cat)} className="text-red-500 hover:text-red-400 p-1"><TrashIcon/></button>
                        </div>
                    </li>
                ))}
            </ul>
             <Modal isOpen={!!isDeleting} onClose={() => setIsDeleting(null)}>
                <h2 className="text-xl font-bold mb-4 text-center">Delete Category?</h2>
                <p className="text-center mb-6">Are you sure you want to delete the "<strong>{isDeleting?.name}</strong>" category? Products in this category will become uncategorized.</p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => setIsDeleting(null)} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-6 rounded-lg">Cancel</button>
                    <button onClick={() => { if (isDeleting?.id) onDelete(isDeleting.id); setIsDeleting(null); }} className="bg-red-600 text-white font-semibold py-2 px-6 rounded-lg">Delete</button>
                </div>
            </Modal>
        </div>
    );
};

const ConcurrencySettings: React.FC = () => {
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'active' | 'not_installed' | 'untested'>('untested');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const { addToast } = useToasts();

  const handleTestRpc = async () => {
    setRpcStatus('checking');
    setStatusMessage('Testing RPC function connection with Supabase...');
    const result = await checkRpcAvailability();
    if (result.installed) {
      setRpcStatus('active');
      setStatusMessage('Atomic RPC with row-level locking (SELECT FOR UPDATE) is verified and active in your database.');
      addToast('Row-level locking RPC verified active!', 'success');
    } else {
      setRpcStatus('not_installed');
      setStatusMessage(result.message);
      addToast(result.message, 'warning');
    }
  };

  useEffect(() => {
    handleTestRpc();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Multi-Device Concurrency</h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                rpcStatus === 'active'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                  : rpcStatus === 'checking'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
              }`}
            >
              {rpcStatus === 'active'
                ? '✓ Row-Level Locking Active'
                : rpcStatus === 'checking'
                ? 'Testing Connection...'
                : 'Pending Database Function'}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Guarantees that when 4–5 cashiers checkout simultaneously, race conditions and duplicate selling of the last stock items are prevented with PostgreSQL row locking.
          </p>
        </div>
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={handleTestRpc}
            disabled={rpcStatus === 'checking'}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {rpcStatus === 'checking' ? (
              <>
                <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Testing...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Test Connection</span>
              </>
            )}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-lg text-xs mt-4 ${
          rpcStatus === 'active'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
        }`}>
          <span className="font-bold">Database Status: </span>{statusMessage}
        </div>
      )}
    </div>
  );
};


const SettingsView: React.FC<SettingsViewProps> = (props) => {
  const { products, onSaveProduct, onDeleteProduct, onGlobalLogout } = props;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockEditingProduct, setStockEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [isGlobalLogoutModalOpen, setIsGlobalLogoutModalOpen] = useState(false);

  const handleOpenModal = (product: Product | null = null) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };
  
  const handleSaveProduct = async (product: Omit<Product, 'id'> & { id?: string }) => {
    await onSaveProduct(product);
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const confirmDeleteProduct = async () => {
    if (deletingProductId) {
        await onDeleteProduct(deletingProductId);
        setDeletingProductId(null);
    }
  };

  const confirmGlobalLogout = async () => {
    await onGlobalLogout();
    setIsGlobalLogoutModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-3xl font-bold">Inventory Management</h2>
            <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-500 transition-colors">
            <PlusIcon /> Add Product
            </button>
        </div>
        <div className="bg-white dark:bg-slate-800 p-2 sm:p-4 rounded-lg shadow-lg">
            <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Price / Cost</th>
                    <th className="p-3 text-center">Stock</th>
                    <th className="p-3 text-center">Availability</th>
                    <th className="p-3 text-center">Actions</th>
                </tr>
                </thead>
                <tbody>
                {products.map(product => {
                    const isSoldOut = Boolean(product.is_sold_out);
                    const stockClasses = product.stock === 0 ? 'text-red-500 font-bold' : product.stock <= 5 ? 'text-amber-500 font-bold' : 'text-slate-800 dark:text-slate-200 font-semibold';
                    const hasCost = product.cost_price !== undefined && product.cost_price !== null;
                    const margin = hasCost ? product.price - (product.cost_price || 0) : null;
                    
                    return (
                    <tr key={product.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          {product.name}
                        </td>
                        <td className="p-3 text-sm text-slate-500 dark:text-slate-400">{product.categories?.name || 'Uncategorized'}</td>
                        <td className="p-3 text-right">
                          <div className="font-bold text-slate-900 dark:text-white">₹{product.price.toFixed(2)}</div>
                          {hasCost ? (
                            <div className="text-[11px] text-slate-400">
                              Cost: ₹{product.cost_price?.toFixed(2)} ({margin! >= 0 ? '+' : ''}₹{margin!.toFixed(2)})
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 italic">No cost set</div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setStockEditingProduct(product)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-700/80 transition-all cursor-pointer group shadow-sm active:scale-95"
                            title="Click to edit stock count and access quick restock"
                          >
                            <span className={`text-sm ${stockClasses}`}>{product.stock}</span>
                            <span className="text-[11px] text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium">
                              Edit
                            </span>
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => onSaveProduct({ ...product, is_sold_out: !isSoldOut })}
                            className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-150 shadow-sm active:scale-95 ${
                              isSoldOut
                                ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 hover:bg-red-200'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200'
                            }`}
                            title="Click to toggle availability"
                          >
                            {isSoldOut ? '🚫 Sold Out' : '✓ Available'}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleOpenModal(product)} className="text-blue-500 hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Edit Product">
                              <PencilIcon/>
                            </button>
                            <button onClick={() => setDeletingProductId(product.id)} className="text-red-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Delete Product">
                              <TrashIcon/>
                            </button>
                          </div>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
        </div>
      </div>
      
      <CategoryManager categories={props.categories} onSave={props.onSaveCategory} onDelete={props.onDeleteCategory} />

      <ConcurrencySettings />

      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-lg">
        <h3 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-500">Security</h3>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
            <p className="font-semibold">Log Out From All Devices</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Force a sign-out on every device currently logged in. You will remain logged in on this device.</p>
            </div>
            <button
            onClick={() => setIsGlobalLogoutModalOpen(true)}
            className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-500 transition-colors flex-shrink-0"
            >
            Force Log Out
            </button>
        </div>
      </div>
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ProductForm product={editingProduct} categories={props.categories} onSave={handleSaveProduct} onClose={() => setIsModalOpen(false)} />
      </Modal>

      <Modal isOpen={!!stockEditingProduct} onClose={() => setStockEditingProduct(null)}>
        <StockEditModal
          product={stockEditingProduct}
          onSave={onSaveProduct}
          onClose={() => setStockEditingProduct(null)}
        />
      </Modal>

      <Modal isOpen={!!deletingProductId} onClose={() => setDeletingProductId(null)}>
            <h2 className="text-2xl font-bold mb-4 text-center">Confirm Deletion</h2>
            <p className="text-center mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setDeletingProductId(null)} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                <button onClick={confirmDeleteProduct} className="bg-red-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-red-500">Delete</button>
            </div>
      </Modal>

      <Modal isOpen={isGlobalLogoutModalOpen} onClose={() => setIsGlobalLogoutModalOpen(false)}>
        <h2 className="text-xl font-bold mb-4 text-center">Are you sure?</h2>
        <p className="text-center mb-6">This will log out your account from all other computers and devices. You will have to sign in again on those devices.</p>
        <div className="flex justify-center gap-4">
            <button onClick={() => setIsGlobalLogoutModalOpen(false)} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
            <button onClick={confirmGlobalLogout} className="bg-red-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-red-500">Yes, Log Out All</button>
        </div>
      </Modal>

    </div>
  );
};

export default SettingsView;