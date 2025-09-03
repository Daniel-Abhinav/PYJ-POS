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

    const refreshData = async () => {
      const productsPromise = supabase.from('products').select('*, categories(name)').order('name');
      const categoriesPromise = supabase.from('categories').select('*').order('name');
      const salesPromise = supabase.from('sales').select('*').neq('status', 'Draft').order('timestamp', { ascending: false });
      const configPromise = supabase.from('app_config').select('value').eq('key', 'last_global_logout_timestamp').single();

      const [productsResult, categoriesResult, salesResult, configResult] = await Promise.all([productsPromise, categoriesPromise, salesPromise, configPromise]);
      
      if (configResult.data && session) {
        const globalLogoutTimestamp = configResult.data.value;
        if (globalLogoutTimestamp && new Date(globalLogoutTimestamp) > new Date(session.loginTimestamp)) {
          setSession(null);
          addToast('You have been logged out by an admin.', 'warning');
          return;
        }
      }
      if(configResult.error && configResult.error.code !== 'PGRST116') { // Ignore "no rows" error
        console.error("Polling error fetching config:", configResult.error);
      }

      if (productsResult.data) setProducts(productsResult.data);
      if (productsResult.error) console.error("Polling error fetching products:", productsResult.error);

      if (categoriesResult.data) setCategories(categoriesResult.data);
      if (categoriesResult.error) console.error("Polling error fetching categories:", categoriesResult.error);
      
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
                  id: item.product_id,
                  name: item.name,
                  price: item.price,
                  quantity: item.quantity,
                }))
            : [],
          status: sale.status || 'Completed', 
          order_number: sale.order_number || 0,
          admin_notes: sale.admin_notes,
          user_notes: sale.user_notes,
        }));
        setSales(salesWithItems);
      }
      if (salesResult.error) console.error("Polling error fetching sales:", salesResult.error);
    };
    
    const fetchInitialData = async () => {
      setIsLoading(true);
      await refreshData();
      setIsLoading(false);
    };

    fetchInitialData();

    const intervalId = setInterval(refreshData, 2000);

    return () => {
      clearInterval(intervalId);
    };

  }, [session]);

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
    const { error } = await supabase
        .from('app_config')
        .update({ value: new Date().toISOString() })
        .eq('key', 'last_global_logout_timestamp');
    
    if (error) {
        console.error('Error during global logout:', error);
        addToast('Failed to log out from other devices.', 'error');
    } else {
        addToast('Successfully triggered a log out on all other devices.', 'success');
    }
  };

  const handleAddSale = async (saleData: { items: SaleItem[], total: number, paymentMethod: string, userNotes?: string }): Promise<Sale | undefined> => {
    const { data: lastSale, error: lastSaleError } = await supabase
      .from('sales').select('order_number').order('order_number', { ascending: false }).limit(1).single();

    if (lastSaleError && lastSaleError.code !== 'PGRST116') { // PGRST116: no rows found, which is fine
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
    
    const { data: updatedProducts } = await supabase.from('products').select('*, categories(name)').order('name');
    if (updatedProducts) setProducts(updatedProducts);

    const newSale: Sale = {
      id: newSaleData.id, timestamp: newSaleData.timestamp, total: newSaleData.total,
      paymentMethod: newSaleData.paymentMethod, order_number: newSaleData.order_number,
      status: newSaleData.status, items: saleData.items, admin_notes: null, user_notes: saleData.userNotes,
    };
    
    // Manually update state for instant UI feedback
    setSales(prevSales => [newSale, ...prevSales]);

    return newSale;
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
        // Manually update state for instant UI feedback
        setSales(prevSales =>
          prevSales.map(sale =>
            sale.id === saleId ? { ...sale, status } : sale
          )
        );
    }
  };
  
  const handleUpdateSaleNotes = async (saleId: string, notes: string) => {
    const { error } = await supabase.from('sales').update({ admin_notes: notes }).eq('id', saleId);
    if (error) {
      console.error('Error updating sale notes:', error);
      addToast('Failed to save notes.', 'error');
    } else {
      addToast('Notes saved successfully!', 'success');
       // Manually update state for instant UI feedback
       setSales(prevSales =>
        prevSales.map(sale =>
          sale.id === saleId ? { ...sale, admin_notes: notes } : sale
        )
      );
    }
  };
  
  const handleSaveProduct = async (product: Omit<Product, 'id'> & { id?: string }) => {
    const { id, ...productData } = product;
    if (id) {
      await supabase.from('products').update(productData).eq('id', id);
    } else {
      await supabase.from('products').insert(productData);
    }
    const { data: updatedProducts } = await supabase.from('products').select('*, categories(name)').order('name');
    if (updatedProducts) setProducts(updatedProducts);
  };

  const handleDeleteProduct = async (productId: string) => {
    await supabase.from('products').delete().eq('id', productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
  };
  
  const handleSaveCategory = async (category: Omit<Category, 'id'> & { id?: string }) => {
     const { id, ...categoryData } = category;
     if (id) {
        await supabase.from('categories').update(categoryData).eq('id', id);
     } else {
        await supabase.from('categories').insert(categoryData);
     }
     const { data: updatedCategories } = await supabase.from('categories').select('*').order('name');
     if (updatedCategories) setCategories(updatedCategories);
  };
  
  const handleDeleteCategory = async (categoryId: string) => {
    // Note: The foreign key is ON DELETE SET NULL, so products won't be deleted.
    await supabase.from('categories').delete().eq('id', categoryId);
    setCategories(prev => prev.filter(c => c.id !== categoryId));
    // Refetch products to update their category info
    const { data: updatedProducts } = await supabase.from('products').select('*, categories(name)').order('name');
    if (updatedProducts) setProducts(updatedProducts);
  };

  const handleResetHistory = async (): Promise<void> => {
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