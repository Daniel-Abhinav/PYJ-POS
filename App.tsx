import React, { useState, useEffect } from 'react';
import { Product, Sale, SaleItem } from './types';
import Header from './components/Header';
import PosView from './views/PosView';
import DashboardView from './views/DashboardView';
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';
import OrdersView from './views/OrdersView';
import LoginView from './views/LoginView';
import { supabase } from './lib/supabaseClient';

export type View = 'pos' | 'orders' | 'dashboard' | 'history' | 'inventory';

const App: React.FC = () => {
  const [role, setRole] = useState<'user' | 'admin' | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentView, setCurrentView] = useState<View>('pos');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!role) {
      // Don't fetch data if not logged in
      return;
    }

    const fetchSalesUpdates = async () => {
      const { data: salesData } = await supabase.from('sales').select('*').neq('status', 'Draft').order('timestamp', { ascending: false });
      if (salesData) {
        const saleIds = salesData.map(s => s.id);
        const { data: saleItemsData } = await supabase.from('sale_items').select('*').in('sale_id', saleIds);
        
        const salesWithItems = salesData.map((sale): Sale => ({
            ...sale,
            items: saleItemsData
              ? saleItemsData
                  .filter(item => item.sale_id === sale.id)
                  .map(item => ({
                    id: item.product_id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                  }))
              : [],
            status: sale.status || 'Completed', 
            order_number: sale.order_number || 0,
        }));
        setSales(salesWithItems);
      }
    };
    
    const fetchInitialData = async () => {
      setIsLoading(true);

      const { data: productsData } = await supabase.from('products').select('*').order('name');
      if (productsData) setProducts(productsData);

      await fetchSalesUpdates();
      
      setIsLoading(false);
    };

    fetchInitialData();

    const intervalId = setInterval(fetchSalesUpdates, 2000);

    return () => {
      clearInterval(intervalId);
    };

  }, [role]);

  const handleLogin = async (loginRole: 'user' | 'admin', password?: string): Promise<boolean> => {
    if (loginRole === 'user') {
      setRole('user');
      setCurrentView('pos');
      return true;
    }
    if (loginRole === 'admin') {
      if (!password) {
        return false;
      }
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'admin_password')
          .single();

        if (error || !data) {
          console.error("Error fetching admin password:", error);
          alert("Admin password not configured in the database or a fetch error occurred. Please check the database setup and console for details.");
          return false;
        }

        if (data.value === password) {
          setRole('admin');
          setCurrentView('pos');
          return true;
        } else {
          return false;
        }
      } catch (e) {
        console.error("An unexpected error occurred during login:", e);
        alert("An unexpected error occurred during login.");
        return false;
      }
    }
    return false;
  };

  const handleLogout = () => {
    setRole(null);
    setCurrentView('pos');
  };

  const handleAddSale = async (saleData: { items: SaleItem[], total: number, paymentMethod: string }): Promise<Sale | undefined> => {
    const { data: lastSale, error: lastSaleError } = await supabase
      .from('sales')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1)
      .single();

    if (lastSaleError && lastSaleError.code !== 'PGRST116') {
      console.error("Error fetching last order number:", lastSaleError);
      alert("Error creating sale: Could not determine the next order number.");
      return;
    }

    const nextOrderNumber = (lastSale?.order_number || 0) + 1;

    const { data: newSaleData, error: saleInsertError } = await supabase
        .from('sales')
        .insert({ 
            total: saleData.total, 
            paymentMethod: saleData.paymentMethod,
            status: saleData.items[0]?.name === 'Manual Sale' ? 'Completed' : 'Pending',
            order_number: nextOrderNumber,
        })
        .select()
        .single();
    
    if (saleInsertError || !newSaleData) {
      console.error("Error creating sale:", saleInsertError);
      if (saleInsertError?.code === '23505') {
        alert("A sale with the same order number was just created. Please try again.");
      } else {
        alert("An error occurred while creating the sale.");
      }
      return;
    }
    const saleId = newSaleData.id;

    const saleItemsToInsert = saleData.items.map(item => ({
        sale_id: saleId,
        product_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
    }));
    await supabase.from('sale_items').insert(saleItemsToInsert);

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
    
    const { data: updatedProducts } = await supabase.from('products').select('*').order('name');
    if (updatedProducts) setProducts(updatedProducts);

    const newSale: Sale = {
      id: newSaleData.id,
      timestamp: newSaleData.timestamp,
      total: newSaleData.total,
      paymentMethod: newSaleData.paymentMethod,
      order_number: newSaleData.order_number,
      status: newSaleData.status,
      items: saleData.items,
    };

    return newSale;
  };

  const handleUpdateSaleStatus = async (saleId: string, status: 'Completed') => {
    const { error } = await supabase
      .from('sales')
      .update({ status })
      .eq('id', saleId);

    if (error) {
      console.error('Error updating sale status:', error);
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
    const { data: updatedProducts } = await supabase.from('products').select('*').order('name');
    if (updatedProducts) setProducts(updatedProducts);
  };

  const handleDeleteProduct = async (productId: string) => {
    await supabase.from('products').delete().eq('id', productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleResetHistory = async (): Promise<void> => {
    await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setSales([]);
  };

  const renderView = () => {
    const adminViews: View[] = ['dashboard', 'history', 'inventory'];
    if (role === 'user' && adminViews.includes(currentView)) {
      // If a user somehow navigates to an admin view, redirect to POS
      setCurrentView('pos');
      return <PosView products={products} onAddSale={handleAddSale} />;
    }

    if (isLoading) {
      return <div className="text-center text-xl mt-20">Loading...</div>;
    }

    switch (currentView) {
      case 'pos':
        return <PosView products={products} onAddSale={handleAddSale} />;
      case 'orders':
        return <OrdersView sales={sales} onUpdateSaleStatus={handleUpdateSaleStatus} />;
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

  if (!role) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <Header currentView={currentView} setCurrentView={setCurrentView} role={role} onLogout={handleLogout} />
      <main className="p-4 sm:p-6 lg:p-8">
        {renderView()}
      </main>
    </div>
  );
};

export default App;
