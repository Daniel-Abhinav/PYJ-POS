
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

  const fetchInitialData = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    const productsPromise = supabase.from('products').select('*, categories(name)').order('name');
    const categoriesPromise = supabase.from('categories').select('*').order('name');
    const salesPromise = supabase.from('sales').select('*').neq('status', 'Draft').order('timestamp', { ascending: false });

    const [productsResult, categoriesResult, salesResult] = await Promise.all([
      productsPromise,
      categoriesPromise,
      salesPromise,
    ]);

    if (productsResult.error) {
      console.error("Products fetch error:", productsResult.error);
      if (!silent) addToast(`Error fetching products: ${productsResult.error.message}`, 'error');
    }
    if (categoriesResult.error) {
      console.error("Categories fetch error:", categoriesResult.error);
      if (!silent) addToast(`Error fetching categories: ${categoriesResult.error.message}`, 'error');
    }
    if (salesResult.error) {
      console.error("Sales fetch error:", salesResult.error);
      if (!silent) addToast(`Error fetching sales: ${salesResult.error.message}`, 'error');
    }

    if (productsResult.data) setProducts(productsResult.data);
    if (categoriesResult.data) setCategories(categoriesResult.data);
    
    if (salesResult.data) {
      const salesData = salesResult.data;
      const saleIds = salesData.map(s => s.id);

      const { data: saleItemsData, error: saleItemsError } = saleIds.length > 0
          ? await supabase.from('sale_items').select('*').in('sale_id', saleIds)
          : { data: [], error: null };

      if (saleItemsError) {
        console.error("Sale items fetch error:", saleItemsError);
        if (!silent) addToast(`Error fetching sale items: ${saleItemsError.message}`, 'error');
      }

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
    if (!silent) setIsLoading(false);
  }, [addToast]);

  useEffect(() => {
    if (!session) {
      return;
    }

    // 1. Initial Data Fetch
    fetchInitialData();

    // Setup fallback polling to ensure parity between devices (since realtime is removed)
    const fallbackPollIntervalId = setInterval(() => {
        fetchInitialData(true);
    }, 2000); // 2 seconds polling to ensure parity

    // 2. Poll for Global Logout
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

    // 3. Cleanup on component unmount
    return () => {
      clearInterval(logoutIntervalId);
      clearInterval(fallbackPollIntervalId);
    };
  }, [session, addToast, fetchInitialData, setSession]);


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
      addToast(`An error occurred while creating the sale: ${saleInsertError?.message || 'Unknown Error'}`, 'error');
      return;
    }
    const saleId = newSaleData.id;

    const saleItemsToInsert = saleData.items.map(item => ({
        sale_id: saleId, product_id: item.id, name: item.name, price: item.price, quantity: item.quantity,
    }));
    const { error: saleItemsInsertError } = await supabase.from('sale_items').insert(saleItemsToInsert);
    
    if (saleItemsInsertError) {
      console.error("Error creating sale items:", saleItemsInsertError);
      addToast(`Error saving sale items: ${saleItemsInsertError.message}`, 'error');
    }

    const stockUpdates = saleData.items
        .filter(item => !item.id.startsWith('manual-'))
        .map(async item => {
            const product = products.find(p => p.id === item.id);
            const newStock = product ? product.stock - item.quantity : 0;
            if (product && product.stock > 0 && newStock <= 0) {
              addToast(`${product.name} is now out of stock!`, 'warning');
            }
            const { error: stockUpdateError } = await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
            if (stockUpdateError) {
               console.error("Error updating stock:", stockUpdateError);
               addToast(`Failed to update stock for ${item.name}: ${stockUpdateError.message}`, 'error');
            }
        });
    await Promise.all(stockUpdates);
    
    const newSaleWithItems: Sale = {
      id: newSaleData.id, timestamp: newSaleData.timestamp, total: newSaleData.total,
      paymentMethod: newSaleData.paymentMethod, order_number: newSaleData.order_number,
      status: newSaleData.status, items: saleData.items, admin_notes: null, user_notes: saleData.userNotes,
    };

    // Optimistically update the UI state so it doesn't solely rely on Realtime
    setSales(prev => {
      // Prevent duplicates in case realtime arrives fast
      if (prev.some(s => s.id === newSaleWithItems.id)) return prev;
      return [newSaleWithItems, ...prev];
    });

    setProducts(prev => {
      let updated = [...prev];
      saleData.items.forEach(item => {
        if (!item.id.startsWith('manual-')) {
          updated = updated.map(p => 
            p.id === item.id ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p
          );
        }
      });
      return updated;
    });

    return newSaleWithItems;
  };

  const handleUpdateSaleStatus = async (saleId: string, status: 'Completed') => {
    // Optimistic update
    setSales(prev => prev.map(s => s.id === saleId ? { ...s, status } : s));
    
    const { error } = await supabase.from('sales').update({ status }).eq('id', saleId);
    if (error) {
      console.error('Error updating sale status:', error);
      addToast('Failed to update order status.', 'error');
      // Revert optimistic update on error would be ideal here if doing it properly
    } else {
        const completedOrder = sales.find(s => s.id === saleId);
        if (completedOrder) {
          addToast(`Order #${completedOrder.order_number} marked as complete.`, 'success');
        }
    }
  };
  
  const handleUpdateSaleNotes = async (saleId: string, notes: string) => {
    // Optimistic update
    setSales(prev => prev.map(s => s.id === saleId ? { ...s, admin_notes: notes } : s));

    const { error } = await supabase.from('sales').update({ admin_notes: notes }).eq('id', saleId);
    if (error) {
      console.error('Error updating sale notes:', error);
      addToast('Failed to save notes.', 'error');
    } else {
      addToast('Notes saved successfully!', 'success');
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
