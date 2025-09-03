import React, { useState, useEffect } from 'react';
import type { Product, Category } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, PencilIcon, TrashIcon, TagIcon } from '../components/icons/Icons';

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
  const [formData, setFormData] = useState({ name: '', price: 0, stock: 0, category_id: '' });

  useEffect(() => {
    if (product) {
      setFormData({ name: product.name, price: product.price, stock: product.stock, category_id: product.category_id || '' });
    } else {
      setFormData({ name: '', price: 0, stock: 0, category_id: '' });
    }
  }, [product]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNumber = e.target.attributes.getNamedItem('type')?.value === 'number';
    setFormData(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData, category_id: formData.category_id || null };
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
          <input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
        <div>
          <label htmlFor="category_id" className="block text-sm font-medium text-slate-500 dark:text-slate-300">Category</label>
          <select name="category_id" value={formData.category_id} onChange={handleChange} className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <option value="">Uncategorized</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-slate-500 dark:text-slate-300">Price (₹)</label>
          <input type="number" name="price" value={formData.price} onChange={handleChange} required min="0" step="0.01" className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
        <div>
          <label htmlFor="stock" className="block text-sm font-medium text-slate-500 dark:text-slate-300">Stock Count</label>
          <input type="number" name="stock" value={formData.stock} onChange={handleChange} required min="0" step="1" className="mt-1 block w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
        <button type="submit" className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-500">Save Product</button>
      </div>
    </form>
  );
};


const CategoryManager: React.FC<{ categories: Category[], onSave: Function, onDelete: Function }> = ({ categories, onSave, onDelete }) => {
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
                    <button onClick={() => { onDelete(isDeleting?.id); setIsDeleting(null); }} className="bg-red-600 text-white font-semibold py-2 px-6 rounded-lg">Delete</button>
                </div>
            </Modal>
        </div>
    );
};


const SettingsView: React.FC<SettingsViewProps> = (props) => {
  const { products, onSaveProduct, onDeleteProduct, onGlobalLogout } = props;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
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
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">Stock</th>
                    <th className="p-3 text-center">Actions</th>
                </tr>
                </thead>
                <tbody>
                {products.map(product => {
                    const stockClasses = product.stock === 0 ? 'text-red-500 font-bold' : product.stock <= 5 ? 'text-yellow-500 font-semibold' : '';
                    return (
                    <tr key={product.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="p-3 font-medium">{product.name}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{product.categories?.name || 'N/A'}</td>
                        <td className="p-3 text-right">₹{product.price.toFixed(2)}</td>
                        <td className={`p-3 text-right ${stockClasses}`}>{product.stock}</td>
                        <td className="p-3 text-center">
                        <div className="flex justify-center gap-2">
                            <button onClick={() => handleOpenModal(product)} className="text-blue-500 hover:text-blue-400 p-1"><PencilIcon/></button>
                            <button onClick={() => setDeletingProductId(product.id)} className="text-red-500 hover:text-red-400 p-1"><TrashIcon/></button>
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