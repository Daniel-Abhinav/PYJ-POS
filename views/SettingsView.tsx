import React, { useState, useEffect } from 'react';
import type { Product } from '../types';
import Modal from '../components/Modal';
import { PlusIcon, PencilIcon, TrashIcon } from '../components/icons/Icons';

interface SettingsViewProps {
  products: Product[];
  onSaveProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
}

const ProductForm: React.FC<{
  product: Product | null;
  onSave: (product: Product) => void;
  onClose: () => void;
}> = ({ product, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({ name: '', price: 0, stock: 0 });

  useEffect(() => {
    if (product) {
      setFormData({ name: product.name, price: product.price, stock: product.stock });
    } else {
      setFormData({ name: '', price: 0, stock: 0 });
    }
  }, [product]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = product ? product.id : new Date().toISOString(); // Temp ID for new items
    onSave({ ...formData, id });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-2xl font-bold mb-6 text-white">{product ? 'Edit Product' : 'Add New Product'}</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-300">Product Name</label>
          <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-slate-300">Price (₹)</label>
          <input type="number" name="price" id="price" value={formData.price} onChange={handleChange} required min="0" step="0.01" className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
        <div>
          <label htmlFor="stock" className="block text-sm font-medium text-slate-300">Stock Count</label>
          <input type="number" name="stock" id="stock" value={formData.stock} onChange={handleChange} required min="0" step="1" className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-500 transition-colors">Cancel</button>
        <button type="submit" className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-500 transition-colors">Save Product</button>
      </div>
    </form>
  );
};


const SettingsView: React.FC<SettingsViewProps> = ({ products, onSaveProduct, onDeleteProduct }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const handleOpenModal = (product: Product | null = null) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };
  
  const handleSaveProduct = async (product: Product) => {
    await onSaveProduct(product);
    handleCloseModal();
  };

  const confirmDeleteProduct = async () => {
    if (deletingProductId) {
        await onDeleteProduct(deletingProductId);
        setDeletingProductId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Inventory Management</h2>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-500 transition-colors">
          <PlusIcon />
          Add Product
        </button>
      </div>

      <div className="bg-slate-800 p-2 sm:p-4 rounded-lg shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="p-3">Product Name</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-right">Stock</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const stockClasses = product.stock === 0 
                  ? 'text-red-500 font-bold' 
                  : product.stock <= 5 
                  ? 'text-yellow-500 font-semibold' 
                  : '';
                return (
                  <tr key={product.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="p-3 font-medium text-white">{product.name}</td>
                    <td className="p-3 text-right">₹{product.price.toFixed(2)}</td>
                    <td className={`p-3 text-right ${stockClasses}`}>{product.stock}</td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleOpenModal(product)} className="text-blue-400 hover:text-blue-300 p-1"><PencilIcon/></button>
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
      
      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        <ProductForm product={editingProduct} onSave={handleSaveProduct} onClose={handleCloseModal} />
      </Modal>

      <Modal isOpen={!!deletingProductId} onClose={() => setDeletingProductId(null)}>
        <div>
            <h2 className="text-2xl font-bold mb-4 text-white text-center">Confirm Deletion</h2>
            <p className="text-slate-300 text-center mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setDeletingProductId(null)} className="bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-slate-500 transition-colors">Cancel</button>
                <button onClick={confirmDeleteProduct} className="bg-red-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-red-500 transition-colors">Delete</button>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsView;