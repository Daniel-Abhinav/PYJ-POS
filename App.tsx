import React, { useState, useEffect } from 'react';
import { Product, Sale, SaleItem } from './types';
import Header from './components/Header';
import PosView from './views/PosView';
import DashboardView from './views/DashboardView';
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';
import { supabase } from './lib/supabaseClient';

export type View = 'pos' | 'dashboard' | 'history' | 'inventory';

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentView, setCurrentView] = useState<View>('pos');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      // Fetch products
      const { data: productsData } = await supabase.from('products').select('*').order('name');
      if (productsData) setProducts(productsData);

      // Fetch sales and their items
      const { data: salesData } = await supabase.from('sales').select('*').order('timestamp', { ascending: false });
      if (salesData) {
        const saleIds = salesData.map(s => s.id);
        const { data: saleItemsData } = await supabase.from('sale_items').select('*').in('sale_id', saleIds);
        
        if (saleItemsData) {
          const salesWithItems = salesData.map((sale): Sale => ({
            ...sale,
            items: saleItemsData
              .filter(item => item.sale_id === sale.id)
              .map(item => ({
                id: item.product_id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
              }))
          }));
          setSales(salesWithItems);
        } else {
           setSales(salesData.map(s => ({...s, items: []})));
        }
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const handleAddSale = async (saleData: { items: SaleItem[], total: number, paymentMethod: string }) => {
    // 1. Insert into 'sales' table
    const { data: newSaleData, error: saleInsertError } = await supabase
        .from('sales')
        .insert({ total: saleData.total, paymentMethod: saleData.paymentMethod })
        .select()
        .single();
    
    if (saleInsertError || !newSaleData) {
      console.error("Error creating sale:", saleInsertError);
      return;
    }

    // 2. Prepare and insert 'sale_items'
    const saleItemsToInsert = saleData.items.map(item => ({
        sale_id: newSaleData.id,
        product_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
    }));
    await supabase.from('sale_items').insert(saleItemsToInsert);

    // 3. Update product stock in DB
    const stockUpdates = saleData.items
        .filter(item => !item.id.startsWith('manual-'))
        .map(item => {
            const product = products.find(p => p.id === item.id);
            const newStock = product ? product.stock - item.quantity : 0;
            return supabase.from('products').update({ stock: newStock }).eq('id', item.id);
        });
    await Promise.all(stockUpdates);
    
    // 4. Update local state for immediate UI feedback
    const finalNewSale: Sale = { ...newSaleData, items: saleData.items };
    setSales(prev => [finalNewSale, ...prev]);

    const updatedProducts = products.map(p => {
      const soldItem = saleData.items.find(item => item.id === p.id);
      if (soldItem) {
        const newStock = p.stock - soldItem.quantity;
        if (p.stock > 0 && newStock <= 0) {
           setTimeout(() => alert(`${p.name} is now out of stock!`), 100);
        }
        return { ...p, stock: Math.max(0, newStock) };
      }
      return p;
    });
    setProducts(updatedProducts);
  };
  
  const handleSaveProduct = async (product: Product) => {
    const isEditing = products.some(p => p.id === product.id);
    const { id, ...productData } = product;

    if (isEditing) {
      const { data, error } = await supabase.from('products').update(productData).eq('id', id).select().single();
      if (data) setProducts(prev => prev.map(p => (p.id === id ? data : p)));
    } else {
      const { data, error } = await supabase.from('products').insert(productData).select().single();
      if (data) setProducts(prev => [...prev, data]);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (!error) {
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
  };


  const renderView = () => {
    if (isLoading) {
      return <div className="text-center text-xl mt-20">Loading...</div>;
    }
    switch (currentView) {
      case 'pos':
        return <PosView products={products} onAddSale={handleAddSale} />;
      case 'dashboard':
        return <DashboardView sales={sales} products={products} />;
      case 'history':
        return <HistoryView sales={sales} />;
      case 'inventory':
        return <SettingsView products={products} onSaveProduct={handleSaveProduct} onDeleteProduct={handleDeleteProduct} />;
      default:
        return <PosView products={products} onAddSale={handleAddSale} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <Header currentView={currentView} setCurrentView={setCurrentView} />
      <main className="p-4 sm:p-6 lg:p-8">
        {renderView()}
      </main>
    </div>
  );
};

export default App;