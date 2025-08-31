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
    const fetchData = async (isInitialLoad = false) => {
      if (isInitialLoad) setIsLoading(true);

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
      if (isInitialLoad) setIsLoading(false);
    };

    // Initial fetch
    fetchData(true);

    // Set up polling every 2 seconds as an alternative to realtime
    const interval = setInterval(() => {
      fetchData(false);
    }, 2000); // 2 seconds

    // Cleanup interval on component unmount
    return () => {
      clearInterval(interval);
    };

  }, []); // Empty dependency array ensures this runs only once on mount

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
            if (product && product.stock > 0 && newStock <= 0) {
              setTimeout(() => alert(`${product.name} is now out of stock!`), 100);
            }
            return supabase.from('products').update({ stock: newStock }).eq('id', item.id);
        });
    await Promise.all(stockUpdates);
    
    // Manually trigger a refresh after a sale instead of waiting for the next poll
    const { data: updatedProducts } = await supabase.from('products').select('*').order('name');
    if (updatedProducts) setProducts(updatedProducts);

    const { data: updatedSalesData } = await supabase.from('sales').select('*').order('timestamp', { ascending: false }).limit(1).single();
    if(updatedSalesData) {
        const { data: saleItemsData } = await supabase.from('sale_items').select('*').eq('sale_id', updatedSalesData.id);
        const newSaleWithItems: Sale = {
            ...updatedSalesData,
            items: saleItemsData ? saleItemsData.map(item => ({
                id: item.product_id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
            })) : []
        }
        setSales(prev => [newSaleWithItems, ...prev]);
    }
  };
  
  const handleSaveProduct = async (product: Product) => {
    const isEditing = products.some(p => p.id === product.id);
    const { id, ...productData } = product;

    if (isEditing) {
      await supabase.from('products').update(productData).eq('id', id);
    } else {
      await supabase.from('products').insert(productData);
    }
    // Manually trigger a refresh
    const { data: updatedProducts } = await supabase.from('products').select('*').order('name');
    if (updatedProducts) setProducts(updatedProducts);
  };

  const handleDeleteProduct = async (productId: string) => {
    await supabase.from('products').delete().eq('id', productId);
    // Manually trigger a refresh
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleResetHistory = async () => {
    // Foreign key constraints will handle sale_items deletion
    await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // Manually trigger a refresh
    setSales([]);
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
        return <HistoryView sales={sales} onResetHistory={handleResetHistory} />;
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
