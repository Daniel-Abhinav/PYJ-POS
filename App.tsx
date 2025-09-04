
import React, { useState, useEffect } from 'react';
import { Product, Sale, SaleItem, Category, Session } from './types';
import Header from './components/Header';
import PosView from './views/PosView';
import DashboardView from './views/DashboardView';
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';
import OrdersView from './views/OrdersView';
import LoginView from './views/LoginView';
import { supabase } from './lib/supabaseClient';
import useTheme from './hooks/useTheme';
import { ToastProvider, useToasts } from './components/ToastProvider';
import useLocalStorage from './hooks/useLocalStorage';

export type View = 'pos' | 'orders' | 'dashboard' | 'history' | 'inventory';

const AppContent: React.FC = () => {
  const [session, setSession] = useLocalStorage<Session | null>('pyj-pos-session', null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentView, setCurrentView] = useState<View>('pos');
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToasts();

  useEffect(() => {
    if (!session) {
      return;
    }

    // 1. Initial Data Fetch
    const fetchInitialData = async () => {
      setIsLoading(true);
      const productsPromise = supabase.from('products').select('*, categories(name)').order('name');
      const categoriesPromise = supabase.from('categories').select('*').order('name');
      const salesPromise = supabase.from('sales').select('*').neq('status', 'Draft').order('timestamp', { ascending: false });

      const [productsResult, categoriesResult, salesResult] = await Promise.all([
        productsPromise,
        categoriesPromise,
        salesPromise,
      ]);

      if (productsResult.data) setProducts(productsResult.data);
      if (categoriesResult.data) setCategories(categoriesResult.data);
      
      if (salesResult.data) {
        const salesData = salesResult.data;
        const saleIds = salesData.map(s => s.id);

        const { data: saleItemsData } = saleIds.length > 0
            ? await supabase.from('sale_items').select('*').in('sale_id', saleIds)
            : { data: [] };

        const salesWithItems = salesData.map((sale): Sale => ({
          ...sale,
          items: saleItemsData
            ? saleItemsData
                .filter(item => item.sale_id === sale.id)
                .map(item => ({
                  id: item.product_id, name: item.name, price: item.price, quantity: item.quantity,
                }))
            : [],
          status: sale.status || 'Completed', 
          order_number: sale.order_number || 0,
          admin_notes: sale.admin_notes, user_notes: sale.user_notes,
        }));
        setSales(salesWithItems);
      }
      setIsLoading(false);
    };
    fetchInitialData();

    // 2. Poll for Global Logout (this is a separate concern)
    const checkGlobalLogout = async () => {
      const { data, error } = await supabase.from('app_config').select('value').eq('key', 'last_global_logout_timestamp').single();
      if (data && session) {
        const globalLogoutTimestamp = data.value;
        if (globalLogoutTimestamp && new Date(globalLogoutTimestamp) > new Date(session.loginTimestamp)) {
          setSession(null);
          addToast('You have been logged out by an admin.', 'warning');
        }
      }
      if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
        console.error("Polling error fetching config:", error);
      }
    };
    const logoutIntervalId = setInterval(checkGlobalLogout, 5000);

    // 3. Set up Real-time Subscriptions
    const channel = supabase.channel('pyj-pos-realtime');
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        console.log('Product change received!', payload);
        supabase.from('products').select('*, categories(name)').order('name').then(({ data }) => {
          if (data) setProducts(data);
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, payload => {
        console.log('Category change received!', payload);
        supabase.from('categories').select('*').order('name').then(({ data }) => {
          if (data) setCategories(data);
        });
        supabase.from('products').select('*, categories(name)').order('name').then(({ data }) => {
          if (data) setProducts(data);
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, async payload => {
        console.log('New sale received!', payload);
        const newSaleRecord = payload.new;
        const { data: saleItemsData } = await supabase.from('sale_items').select('*').eq('sale_id', newSaleRecord.id);
        const newSaleWithItems: Sale = {
            ...newSaleRecord,
            items: saleItemsData?.map(item => ({ id: item.product_id, name: item.name, price: item.price, quantity: item.quantity })) || [],
        };
        setSales(prev => [newSaleWithItems, ...prev.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sales' }, payload => {
         console.log('Sale update received!', payload);
         const updatedSaleRecord = payload.new;
         setSales(prev => prev.map(sale =>
            sale.id === updatedSaleRecord.id
              ? { ...sale, status: updatedSaleRecord.status, admin_notes: updatedSaleRecord.admin_notes }
              : sale
         ));
      })
      .subscribe();

    // 4. Cleanup on component unmount
    return () => {
      clearInterval(logoutIntervalId);
      supabase.removeChannel(channel);
    };
  }, [session, addToast, setSession]);


  const handleLogin = async (loginRole: 'user' | 'admin', password?: string): Promise<boolean> => {
    if (!password) return false;
    
    const passwordKey = loginRole === 'admin' ? 'admin_password' : 'user_password';

    try {
      const { data, error } = await supabase.from('app_config').select('value').eq('key', passwordKey).single();

      if (error || !data) {
        console.error(`Error fetching ${loginRole} password:`, error);
        addToast(`Password not configured. Please contact an admin.`, 'error');
        return false;
      }

      if (data.value === password) {
        setSession({
          role: loginRole,
          loginTimestamp: new Date().toISOString(),
        });
        setCurrentView('pos');
        addToast(`Welcome, ${loginRole}!`, 'success');
        return true;
      } else {
        return false;
      }
    } catch (e) {
      console.error("Login error:", e);
      addToast("An unexpected error occurred during login.", 'error');
      return false;
    }
  };

  const handleLogout = () => {
    setSession(null);
    setCurrentView('pos');
  };

  const handleGlobalLogout = async (): Promise<void> => {
    if (!session) return;
    const { error } = await supabase.rpc('update_global_logout_timestamp');

    if (error) {
      console.error('Error during global logout:', error);
      addToast('Failed to log out from other devices.', 'error');
    } else {
      setSession({
        role: session.role,
        loginTimestamp: new Date().toISOString(),
      });
      addToast('Successfully triggered a log out on all other devices.', 'success');
    }
  };

  const handleAddSale = async (saleData: { items: SaleItem[], total: number, paymentMethod: string, userNotes?: string }): Promise<Sale | undefined> => {
    const { data: lastSale, error: lastSaleError } = await supabase
      .from('sales').select('order_number').order('order_number', { ascending: false }).limit(1).single();

    if (lastSaleError && lastSaleError.code !== 'PGRST116') {
      console.error("Error fetching last order number:", lastSaleError);
      addToast("Error creating sale: could not get next order number.", 'error');
      return;
    }

    const nextOrderNumber = (lastSale?.order_number || 0) + 1;

    const { data: newSaleData, error: saleInsertError } = await supabase
        .from('sales').insert({ 
            total: saleData.total, 
            paymentMethod: saleData.paymentMethod,
            status: saleData.items[0]?.name === 'Manual Sale' ? 'Completed' : 'Pending',
            order_number: nextOrderNumber,
            user_notes: saleData.userNotes,
        }).select().single();
    
    if (saleInsertError || !newSaleData) {
      console.error("Error creating sale:", saleInsertError);
      addToast("An error occurred while creating the sale.", 'error');
      return;
    }
    const saleId = newSaleData.id;

    const saleItemsToInsert = saleData.items.map(item => ({
        sale_id: saleId, product_id: item.id, name: item.name, price: item.price, quantity: item.quantity,
    }));
    await supabase.from('sale_items').insert(saleItemsToInsert);

    const stockUpdates = saleData.items
        .filter(item => !item.id.startsWith('manual-'))
        .map(item => {
            const product = products.find(p => p.id === item.id);
            const newStock = product ? product.stock - item.quantity : 0;
            if (product && product.stock > 0 && newStock <= 0) {
              addToast(`${product.name} is now out of stock!`, 'warning');
            }
            return supabase.from('products').update({ stock: newStock }).eq('id', item.id);
        });
    await Promise.all(stockUpdates);
    
    // The UI will now update via the realtime subscription.
    return {
      id: newSaleData.id, timestamp: newSaleData.timestamp, total: newSaleData.total,
      paymentMethod: newSaleData.paymentMethod, order_number: newSaleData.order_number,
      status: newSaleData.status, items: saleData.items, admin_notes: null, user_notes: saleData.userNotes,
    };
  };

  const handleUpdateSaleStatus = async (saleId: string, status: 'Completed') => {
    const { error } = await supabase.from('sales').update({ status }).eq('id', saleId);
    if (error) {
      console.error('Error updating sale status:', error);
      addToast('Failed to update order status.', 'error');
    } else {
        const completedOrder = sales.find(s => s.id === saleId);
        if (completedOrder) {
          addToast(`Order #${completedOrder.order_number} marked as complete.`, 'success');
        }
        // UI will update via realtime subscription.
    }
  };
  
  const handleUpdateSaleNotes = async (saleId: string, notes: string) => {
    const { error } = await supabase.from('sales').update({ admin_notes: notes }).eq('id', saleId);
    if (error) {
      console.error('Error updating sale notes:', error);
      addToast('Failed to save notes.', 'error');
    } else {
      addToast('Notes saved successfully!', 'success');
       // UI will update via realtime subscription.
    }
  };
  
  const handleSaveProduct = async (product: Omit<Product, 'id'> & { id?: string }) => {
    const { id, ...productData } = product;
    if (id) {
      await supabase.from('products').update(productData).eq('id', id);
    } else {
      await supabase.from('products').insert(productData);
    }
    // UI will update via realtime subscription.
  };

  const handleDeleteProduct = async (productId: string) => {
    await supabase.from('products').delete().eq('id', productId);
    // UI will update via realtime subscription.
  };
  
  const handleSaveCategory = async (category: Omit<Category, 'id'> & { id?: string }) => {
     const { id, ...categoryData } = category;
     if (id) {
        await supabase.from('categories').update(categoryData).eq('id', id);
     } else {
        await supabase.from('categories').insert(categoryData);
     }
     // UI will update via realtime subscription.
  };
  
  const handleDeleteCategory = async (categoryId: string) => {
    await supabase.from('categories').delete().eq('id', categoryId);
    // UI (both categories and products list) will update via realtime subscription.
  };

  const handleResetHistory = async (): Promise<void> => {
    // Mass deletes don't broadcast a single event, so we'll clear state manually for instant feedback.
    await supabase.from('sale_items').delete().neq('sale_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setSales([]);
  };

  const renderView = () => {
    const adminViews: View[] = ['dashboard', 'history', 'inventory'];
    if (session?.role === 'user' && adminViews.includes(currentView)) {
      setCurrentView('pos');
      return <PosView products={products} categories={categories} onAddSale={handleAddSale} />;
    }

    if (isLoading) {
      return <div className="text-center text-xl mt-20">Loading...</div>;
    }

    switch (currentView) {
      case 'pos':
        return <PosView products={products} categories={categories} onAddSale={handleAddSale} />;
      case 'orders':
        return <OrdersView sales={sales} onUpdateSaleStatus={handleUpdateSaleStatus} onUpdateSaleNotes={handleUpdateSaleNotes} role={session!.role} />;
      case 'dashboard':
        return <DashboardView sales={sales} products={products} />;
      case 'history':
        return <HistoryView sales={sales} onResetHistory={handleResetHistory} />;
      case 'inventory':
        return <SettingsView 
                  products={products} 
                  categories={categories}
                  onSaveProduct={handleSaveProduct} 
                  onDeleteProduct={handleDeleteProduct}
                  onSaveCategory={handleSaveCategory}
                  onDeleteCategory={handleDeleteCategory}
                  onGlobalLogout={handleGlobalLogout}
                />;
      default:
        return <PosView products={products} categories={categories} onAddSale={handleAddSale} />;
    }
  };

  if (!session) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen font-sans">
      <Header currentView={currentView} setCurrentView={setCurrentView} role={session.role} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
      <main className="p-2 sm:p-4 lg:p-6">
        {renderView()}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);


export default App;
