import React, { useState, useEffect } from 'react';
import { Product, Sale, SaleItem, Category, Session } from './types';
import Header from './components/Header';
import PosView from './views/PosView';
import DashboardView from './views/DashboardView';
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';
import OrdersView from './views/OrdersView';
import LoginView from './views/LoginView';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { initialProducts } from './constants';
import useTheme from './hooks/useTheme';
import { ToastProvider, useToasts } from './components/ToastProvider';
import useLocalStorage from './hooks/useLocalStorage';
import { Analytics } from '@vercel/analytics/react';

export type View = 'pos' | 'orders' | 'dashboard' | 'history' | 'inventory';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-snacks', name: 'Snacks' },
  { id: 'cat-beverages', name: 'Beverages' },
  { id: 'cat-bakery', name: 'Bakery' },
];

const AppContent: React.FC = () => {
  const [session, setSession] = useLocalStorage<Session | null>('pyj-pos-session', null);
  const [productMeta, setProductMeta] = useLocalStorage<Record<string, { cost_price?: number | null; is_sold_out?: boolean }>>('pyj-products-meta', {});
  const productMetaRef = React.useRef(productMeta);
  useEffect(() => {
    productMetaRef.current = productMeta;
  }, [productMeta]);

  // Initial products with fallback to localStorage or initial constants
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('pyj_cached_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return initialProducts.map(p => {
      const isDrink = p.name.includes('Soda') || p.name.includes('Tea') || p.name.includes('Water');
      const catId = isDrink ? 'cat-beverages' : 'cat-snacks';
      const catName = isDrink ? 'Beverages' : 'Snacks';
      return {
        ...p,
        cost_price: null,
        is_sold_out: false,
        category_id: catId,
        categories: { name: catName },
      };
    });
  });

  // Initial categories with fallback
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const cached = localStorage.getItem('pyj_cached_categories');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_CATEGORIES;
  });

  // Initial sales with fallback
  const [sales, setSales] = useState<Sale[]>(() => {
    try {
      const cached = localStorage.getItem('pyj_cached_sales');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });

  const [currentView, setCurrentView] = useState<View>('pos');
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToasts();

  const enrichProducts = React.useCallback((rawList: Product[]) => {
    const metaMap = productMetaRef.current;
    return rawList.map(p => {
      const meta = metaMap[p.id];
      return {
        ...p,
        cost_price: p.cost_price !== undefined && p.cost_price !== null ? p.cost_price : (meta?.cost_price ?? null),
        is_sold_out: p.is_sold_out !== undefined ? p.is_sold_out : (meta?.is_sold_out ?? false),
      };
    });
  }, []);

  const fetchInitialData = React.useCallback(async (silent = false) => {
    if (!isSupabaseConfigured) {
      return;
    }

    if (!silent) setIsLoading(true);
    try {
      const productsPromise = supabase.from('products').select('*, categories(name)').order('name');
      const categoriesPromise = supabase.from('categories').select('*').order('name');
      const salesPromise = supabase.from('sales').select('*').neq('status', 'Draft').order('timestamp', { ascending: false });

      const [productsResult, categoriesResult, salesResult] = await Promise.all([
        productsPromise,
        categoriesPromise,
        salesPromise,
      ]);

      if (productsResult.data && productsResult.data.length > 0) {
        const enriched = enrichProducts(productsResult.data);
        setProducts(enriched);
        try { localStorage.setItem('pyj_cached_products', JSON.stringify(enriched)); } catch (_) {}
      }
      if (categoriesResult.data && categoriesResult.data.length > 0) {
        setCategories(categoriesResult.data);
        try { localStorage.setItem('pyj_cached_categories', JSON.stringify(categoriesResult.data)); } catch (_) {}
      }
      
      if (salesResult.data) {
        const salesData = salesResult.data;
        const saleIds = salesData.map((s: any) => s.id);

        const { data: saleItemsData } = saleIds.length > 0
            ? await supabase.from('sale_items').select('*').in('sale_id', saleIds)
            : { data: [] };

        const salesWithItems = salesData.map((sale: any): Sale => ({
          ...sale,
          items: saleItemsData
            ? saleItemsData
                .filter((item: any) => item.sale_id === sale.id)
                .map((item: any) => ({
                  id: item.product_id, name: item.name, price: item.price, quantity: item.quantity,
                }))
            : [],
          status: sale.status || 'Completed', 
          order_number: sale.order_number || 0,
          admin_notes: sale.admin_notes, user_notes: sale.user_notes,
        }));
        setSales(salesWithItems);
        try { localStorage.setItem('pyj_cached_sales', JSON.stringify(salesWithItems)); } catch (_) {}
      }
    } catch (err) {
      console.warn("Background fetch notice:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [enrichProducts]);

  useEffect(() => {
    if (!session) {
      return;
    }

    // 1. Initial Data Fetch from Remote DB if configured
    fetchInitialData();

    if (!isSupabaseConfigured) {
      return;
    }

    // 2. Poll for Global Logout when Supabase is active
    const checkGlobalLogout = async () => {
      try {
        const { data } = await supabase.from('app_config').select('value').eq('key', 'last_global_logout_timestamp').single();
        if (data && session) {
          const globalLogoutTimestamp = data.value;
          if (globalLogoutTimestamp && new Date(globalLogoutTimestamp) > new Date(session.loginTimestamp)) {
            setSession(null);
            addToast('You have been logged out by an admin.', 'warning');
          }
        }
      } catch (err) {
        console.warn("Global logout poll notice:", err);
      }
    };
    const logoutIntervalId = setInterval(checkGlobalLogout, 10000);

    // 3. Set up Real-time Subscriptions with auto-reconnect and error resilience
    let isMounted = true;
    let activeChannel: any = null;
    let reconnectTimeoutId: any = null;
    let retryCount = 0;

    const setupRealtimeChannel = () => {
      if (!isMounted || !isSupabaseConfigured) return;

      if (activeChannel) {
        try {
          supabase.removeChannel(activeChannel);
        } catch (_) {}
        activeChannel = null;
      }

      const channelTopic = `pyj-pos-realtime-${Date.now()}`;
      const channel = supabase.channel(channelTopic);

      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'products' }, async (payload: any) => {
          const { data: newProduct } = await supabase.from('products').select('*, categories(name)').eq('id', payload.new.id).single();
          if (newProduct && isMounted) {
            setProducts(prev => {
              if (prev.some(p => p.id === newProduct.id)) return prev;
              const meta = productMetaRef.current[newProduct.id];
              const enriched: Product = {
                ...newProduct,
                cost_price: newProduct.cost_price !== undefined && newProduct.cost_price !== null ? newProduct.cost_price : (meta?.cost_price ?? null),
                is_sold_out: newProduct.is_sold_out !== undefined ? newProduct.is_sold_out : (meta?.is_sold_out ?? false),
              };
              const updated = [...prev, enriched].sort((a, b) => a.name.localeCompare(b.name));
              try { localStorage.setItem('pyj_cached_products', JSON.stringify(updated)); } catch (_) {}
              return updated;
            });
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, async (payload: any) => {
          const { data: updatedProduct } = await supabase.from('products').select('*, categories(name)').eq('id', payload.new.id).single();
          if (updatedProduct && isMounted) {
            setProducts(prev => {
              const oldProduct = prev.find(p => p.id === updatedProduct.id);
              if (oldProduct) {
                if (oldProduct.stock >= 5 && updatedProduct.stock < 5 && updatedProduct.stock > 0) {
                  setTimeout(() => {
                    addToast(`${updatedProduct.name} is now low on stock (${updatedProduct.stock} left)!`, 'warning');
                  }, 0);
                } else if (oldProduct.stock > 0 && updatedProduct.stock <= 0) {
                  setTimeout(() => {
                    addToast(`${updatedProduct.name} is now out of stock!`, 'error');
                  }, 0);
                }
              }
              const meta = productMetaRef.current[updatedProduct.id];
              const enriched: Product = {
                ...updatedProduct,
                cost_price: updatedProduct.cost_price !== undefined && updatedProduct.cost_price !== null ? updatedProduct.cost_price : (meta?.cost_price ?? null),
                is_sold_out: updatedProduct.is_sold_out !== undefined ? updatedProduct.is_sold_out : (meta?.is_sold_out ?? false),
              };
              const updated = prev.map(p => (p.id === enriched.id ? enriched : p));
              try { localStorage.setItem('pyj_cached_products', JSON.stringify(updated)); } catch (_) {}
              return updated;
            });
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'products' }, (payload: any) => {
          if (isMounted) {
            setProducts(prev => {
              const updated = prev.filter(p => p.id !== payload.old.id);
              try { localStorage.setItem('pyj_cached_products', JSON.stringify(updated)); } catch (_) {}
              return updated;
            });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
          if (!isMounted) return;
          supabase.from('categories').select('*').order('name').then(({ data }: any) => {
            if (data && isMounted) {
              setCategories(data);
              try { localStorage.setItem('pyj_cached_categories', JSON.stringify(data)); } catch (_) {}
            }
          });
          supabase.from('products').select('*, categories(name)').order('name').then(({ data }: any) => {
            if (data && isMounted) {
              const enriched = enrichProducts(data);
              setProducts(enriched);
              try { localStorage.setItem('pyj_cached_products', JSON.stringify(enriched)); } catch (_) {}
            }
          });
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, async (payload: any) => {
          const newSaleRecord = payload.new;
          if (newSaleRecord.status === 'Draft' || !isMounted) return;
          
          const { data: saleItemsData } = await supabase.from('sale_items').select('*').eq('sale_id', newSaleRecord.id);
          const newSaleWithItems: Sale = {
              ...newSaleRecord,
              items: saleItemsData?.map((item: any) => ({ id: item.product_id, name: item.name, price: item.price, quantity: item.quantity })) || [],
          };
          if (isMounted) {
            setSales(prev => {
              if (prev.some(s => s.id === newSaleWithItems.id)) return prev;
              const updated = [newSaleWithItems, ...prev];
              try { localStorage.setItem('pyj_cached_sales', JSON.stringify(updated)); } catch (_) {}
              return updated;
            });
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sales' }, (payload: any) => {
           if (!isMounted) return;
           const updatedSaleRecord = payload.new;
           setSales(prev => {
             const updated = prev.map(sale =>
                sale.id === updatedSaleRecord.id
                  ? { ...sale, status: updatedSaleRecord.status, admin_notes: updatedSaleRecord.admin_notes }
                  : sale
             );
             try { localStorage.setItem('pyj_cached_sales', JSON.stringify(updated)); } catch (_) {}
             return updated;
           });
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sales' }, (payload: any) => {
            if (isMounted) {
              setSales(prev => {
                const updated = prev.filter(s => s.id !== payload.old.id);
                try { localStorage.setItem('pyj_cached_sales', JSON.stringify(updated)); } catch (_) {}
                return updated;
              });
            }
        })
        .subscribe((status: string) => {
          if (!isMounted) return;

          if (status === 'SUBSCRIBED') {
            retryCount = 0;
            fetchInitialData(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            try {
              supabase.removeChannel(channel);
            } catch (_) {}
            if (activeChannel === channel) {
              activeChannel = null;
            }

            if (isMounted && !reconnectTimeoutId) {
              const delay = Math.min(2000 * Math.pow(1.5, retryCount), 15000);
              retryCount++;
              reconnectTimeoutId = setTimeout(() => {
                reconnectTimeoutId = null;
                if (isMounted) {
                  setupRealtimeChannel();
                }
              }, delay);
            }
          }
        });

      activeChannel = channel;
    };

    setupRealtimeChannel();

    // 4. Fallback silent background polling (every 25s) when online
    const syncIntervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine) {
        fetchInitialData(true);
      }
    }, 25000);

    const handleReconnectedOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine) {
        fetchInitialData(true);
        if (!activeChannel && !reconnectTimeoutId && isMounted) {
          setupRealtimeChannel();
        }
      }
    };

    window.addEventListener('visibilitychange', handleReconnectedOrVisible);
    window.addEventListener('online', handleReconnectedOrVisible);

    return () => {
      isMounted = false;
      clearInterval(logoutIntervalId);
      clearInterval(syncIntervalId);
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
      window.removeEventListener('visibilitychange', handleReconnectedOrVisible);
      window.removeEventListener('online', handleReconnectedOrVisible);
      if (activeChannel) {
        try {
          supabase.removeChannel(activeChannel);
        } catch (_) {}
        activeChannel = null;
      }
    };
  }, [session, addToast, fetchInitialData, setSession, enrichProducts]);

  const handleLogin = async (loginRole: 'user' | 'admin', password?: string): Promise<boolean> => {
    if (!password) return false;
    const cleanPassword = password.trim();

    // 1. Check Supabase app_config table if configured
    if (isSupabaseConfigured) {
      const passwordKey = loginRole === 'admin' ? 'admin_password' : 'user_password';
      try {
        const { data, error } = await supabase.from('app_config').select('value').eq('key', passwordKey).single();
        if (!error && data?.value) {
          if (data.value === cleanPassword) {
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
        }
      } catch (e) {
        console.warn("Supabase password check skipped:", e);
      }
    }

    // 2. Default credentials check for local mode / initial setup
    const validAdminPasswords = ['admin', 'admin123', 'pyjadmin'];
    const validUserPasswords = ['user', 'user123', 'pyjuser', 'admin'];

    const isValid = loginRole === 'admin'
      ? validAdminPasswords.includes(cleanPassword.toLowerCase())
      : validUserPasswords.includes(cleanPassword.toLowerCase());

    if (isValid) {
      setSession({
        role: loginRole,
        loginTimestamp: new Date().toISOString(),
      });
      setCurrentView('pos');
      addToast(`Welcome, ${loginRole}!`, 'success');
      return true;
    }

    return false;
  };

  const handleLogout = () => {
    setSession(null);
    setCurrentView('pos');
  };

  const handleGlobalLogout = async (): Promise<void> => {
    if (!session) return;
    if (isSupabaseConfigured) {
      try {
        await supabase.rpc('update_global_logout_timestamp');
      } catch (_) {}
    }
    setSession({
      role: session.role,
      loginTimestamp: new Date().toISOString(),
    });
    addToast('Successfully triggered a log out on all other devices.', 'success');
  };

  const handleAddSale = async (saleData: { items: SaleItem[], total: number, paymentMethod: string, userNotes?: string }): Promise<Sale | undefined> => {
    // Generate order number
    let nextOrderNumber = 1;
    if (sales.length > 0) {
      const maxOrderNum = Math.max(0, ...sales.map(s => s.order_number || 0));
      nextOrderNumber = maxOrderNum + 1;
    }

    if (isSupabaseConfigured) {
      try {
        const { data: lastSale } = await supabase
          .from('sales').select('order_number').order('order_number', { ascending: false }).limit(1).single();
        if (lastSale?.order_number && lastSale.order_number >= nextOrderNumber) {
          nextOrderNumber = lastSale.order_number + 1;
        }
      } catch (_) {}
    }

    let saleId = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const isManual = saleData.items[0]?.name === 'Manual Sale';
    const status = isManual ? 'Completed' : 'Pending';
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        const { data: newSaleData } = await supabase
          .from('sales').insert({
            total: saleData.total,
            paymentMethod: saleData.paymentMethod,
            status,
            order_number: nextOrderNumber,
            user_notes: saleData.userNotes || null,
          }).select().single();

        if (newSaleData?.id) {
          saleId = newSaleData.id;
          const saleItemsToInsert = saleData.items.map(item => ({
            sale_id: saleId, product_id: item.id, name: item.name, price: item.price, quantity: item.quantity,
          }));
          await supabase.from('sale_items').insert(saleItemsToInsert);

          // Update stock in Supabase
          saleData.items.filter(item => !item.id.startsWith('manual-')).forEach(async item => {
            const currentP = products.find(p => p.id === item.id);
            const remaining = Math.max(0, (currentP ? currentP.stock : 0) - item.quantity);
            await supabase.from('products').update({ stock: remaining }).eq('id', item.id);
          });
        }
      } catch (err) {
        console.warn("Supabase sale insertion recorded locally:", err);
      }
    }

    const newSaleWithItems: Sale = {
      id: saleId,
      timestamp: nowIso,
      total: saleData.total,
      paymentMethod: saleData.paymentMethod as any,
      order_number: nextOrderNumber,
      status,
      items: saleData.items,
      admin_notes: null,
      user_notes: saleData.userNotes || null,
    };

    // Optimistic UI state update
    setSales(prev => {
      if (prev.some(s => s.id === newSaleWithItems.id)) return prev;
      const next = [newSaleWithItems, ...prev];
      try { localStorage.setItem('pyj_cached_sales', JSON.stringify(next)); } catch (_) {}
      return next;
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
      try { localStorage.setItem('pyj_cached_products', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });

    addToast(`Order #${nextOrderNumber} created successfully!`, 'success');
    return newSaleWithItems;
  };

  const handleUpdateSaleStatus = async (saleId: string, status: 'Completed') => {
    setSales(prev => {
      const next = prev.map(s => s.id === saleId ? { ...s, status } : s);
      try { localStorage.setItem('pyj_cached_sales', JSON.stringify(next)); } catch (_) {}
      return next;
    });

    if (isSupabaseConfigured) {
      try {
        await supabase.from('sales').update({ status }).eq('id', saleId);
      } catch (_) {}
    }

    const completedOrder = sales.find(s => s.id === saleId);
    if (completedOrder) {
      addToast(`Order #${completedOrder.order_number} marked as complete.`, 'success');
    }
  };

  const handleUpdateSaleNotes = async (saleId: string, notes: string) => {
    setSales(prev => {
      const next = prev.map(s => s.id === saleId ? { ...s, admin_notes: notes } : s);
      try { localStorage.setItem('pyj_cached_sales', JSON.stringify(next)); } catch (_) {}
      return next;
    });

    if (isSupabaseConfigured) {
      try {
        await supabase.from('sales').update({ admin_notes: notes }).eq('id', saleId);
      } catch (_) {}
    }
    addToast('Notes saved successfully!', 'success');
  };

  const handleSaveProduct = async (product: Omit<Product, 'id'> & { id?: string }) => {
    const { id, categories: _joinedCat, ...productData } = product as any;
    const matchedCategory = categories.find(c => c.id === productData.category_id);
    const categoryName = matchedCategory ? matchedCategory.name : null;

    if (id) {
      // Edit existing product
      const updatedProduct: Product = {
        id,
        name: productData.name,
        price: productData.price,
        stock: productData.stock,
        cost_price: productData.cost_price ?? null,
        is_sold_out: productData.is_sold_out ?? false,
        category_id: productData.category_id || null,
        categories: categoryName ? { name: categoryName } : null,
      };

      setProductMeta(prev => ({
        ...prev,
        [id]: {
          cost_price: updatedProduct.cost_price,
          is_sold_out: updatedProduct.is_sold_out,
        }
      }));

      setProducts(prev => {
        const next = prev.map(p => (p.id === id ? updatedProduct : p));
        try { localStorage.setItem('pyj_cached_products', JSON.stringify(next)); } catch (_) {}
        return next;
      });

      if (isSupabaseConfigured) {
        const dbPayload: any = {
          name: productData.name,
          price: productData.price,
          stock: productData.stock,
          category_id: productData.category_id || null,
        };
        if (productData.cost_price !== undefined) dbPayload.cost_price = productData.cost_price;
        if (productData.is_sold_out !== undefined) dbPayload.is_sold_out = productData.is_sold_out;

        const { error } = await supabase.from('products').update(dbPayload).eq('id', id);
        if (error) {
          await supabase.from('products').update({
            name: productData.name,
            price: productData.price,
            stock: productData.stock,
            category_id: productData.category_id || null,
          }).eq('id', id);
        }
      }
      addToast(`Updated ${productData.name} successfully!`, 'success');
    } else {
      // Add new product
      let newId = `prod-${Date.now()}`;
      let createdProduct: Product = {
        id: newId,
        name: productData.name,
        price: productData.price,
        stock: productData.stock,
        cost_price: productData.cost_price ?? null,
        is_sold_out: productData.is_sold_out ?? false,
        category_id: productData.category_id || null,
        categories: categoryName ? { name: categoryName } : null,
      };

      if (isSupabaseConfigured) {
        const dbPayload: any = {
          name: productData.name,
          price: productData.price,
          stock: productData.stock,
          category_id: productData.category_id || null,
        };
        if (productData.cost_price !== undefined) dbPayload.cost_price = productData.cost_price;
        if (productData.is_sold_out !== undefined) dbPayload.is_sold_out = productData.is_sold_out;

        const { data, error } = await supabase.from('products').insert(dbPayload).select().single();
        if (data?.id) {
          newId = data.id;
          createdProduct.id = newId;
        } else if (error) {
          const fallback = await supabase.from('products').insert({
            name: productData.name,
            price: productData.price,
            stock: productData.stock,
            category_id: productData.category_id || null,
          }).select().single();
          if (fallback.data?.id) {
            newId = fallback.data.id;
            createdProduct.id = newId;
          }
        }
      }

      setProductMeta(prev => ({
        ...prev,
        [newId]: {
          cost_price: createdProduct.cost_price,
          is_sold_out: createdProduct.is_sold_out,
        }
      }));

      setProducts(prev => {
        if (prev.some(p => p.id === newId)) return prev;
        const next = [...prev, createdProduct].sort((a, b) => a.name.localeCompare(b.name));
        try { localStorage.setItem('pyj_cached_products', JSON.stringify(next)); } catch (_) {}
        return next;
      });

      addToast(`Added ${createdProduct.name} to menu!`, 'success');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const prod = products.find(p => p.id === productId);
    setProducts(prev => {
      const next = prev.filter(p => p.id !== productId);
      try { localStorage.setItem('pyj_cached_products', JSON.stringify(next)); } catch (_) {}
      return next;
    });

    if (isSupabaseConfigured) {
      try {
        await supabase.from('products').delete().eq('id', productId);
      } catch (_) {}
    }
    addToast(`${prod ? prod.name : 'Product'} deleted.`, 'info');
  };

  const handleSaveCategory = async (category: Omit<Category, 'id'> & { id?: string }) => {
    const { id, name } = category;
    if (id) {
      setCategories(prev => {
        const next = prev.map(c => c.id === id ? { ...c, name } : c);
        try { localStorage.setItem('pyj_cached_categories', JSON.stringify(next)); } catch (_) {}
        return next;
      });
      setProducts(prev => {
        const next = prev.map(p => p.category_id === id ? { ...p, categories: { name } } : p);
        try { localStorage.setItem('pyj_cached_products', JSON.stringify(next)); } catch (_) {}
        return next;
      });

      if (isSupabaseConfigured) {
        try {
          await supabase.from('categories').update({ name }).eq('id', id);
        } catch (_) {}
      }
      addToast(`Category "${name}" updated.`, 'success');
    } else {
      let newId = `cat-${Date.now()}`;
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.from('categories').insert({ name }).select().single();
          if (data?.id) newId = data.id;
        } catch (_) {}
      }
      const newCat: Category = { id: newId, name };
      setCategories(prev => {
        const next = [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name));
        try { localStorage.setItem('pyj_cached_categories', JSON.stringify(next)); } catch (_) {}
        return next;
      });
      addToast(`Category "${name}" added.`, 'success');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    setCategories(prev => {
      const next = prev.filter(c => c.id !== categoryId);
      try { localStorage.setItem('pyj_cached_categories', JSON.stringify(next)); } catch (_) {}
      return next;
    });
    setProducts(prev => {
      const next = prev.map(p => p.category_id === categoryId ? { ...p, category_id: null, categories: null } : p);
      try { localStorage.setItem('pyj_cached_products', JSON.stringify(next)); } catch (_) {}
      return next;
    });

    if (isSupabaseConfigured) {
      try {
        await supabase.from('categories').delete().eq('id', categoryId);
      } catch (_) {}
    }
    addToast(`Category "${cat?.name || 'Category'}" deleted.`, 'info');
  };

  const handleCancelSale = async (saleId: string, reason: string): Promise<void> => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    if (sale.status === 'Cancelled') {
      addToast(`Order #${sale.order_number} is already cancelled.`, 'warning');
      return;
    }

    const cancelNote = `[Cancelled: ${reason}]`;
    const updatedAdminNotes = sale.admin_notes
      ? `${sale.admin_notes} | ${cancelNote}`
      : cancelNote;

    // 1. Update sales state
    setSales(prev => {
      const next = prev.map(s => s.id === saleId ? {
        ...s,
        status: 'Cancelled' as const,
        cancellation_reason: reason,
        admin_notes: updatedAdminNotes,
      } : s);
      try { localStorage.setItem('pyj_cached_sales', JSON.stringify(next)); } catch (_) {}
      return next;
    });

    // 2. Return quantities to product stock
    setProducts(prev => {
      let updated = [...prev];
      sale.items.forEach(item => {
        if (!item.id.startsWith('manual-')) {
          updated = updated.map(p =>
            p.id === item.id ? { ...p, stock: p.stock + item.quantity } : p
          );
        }
      });
      try { localStorage.setItem('pyj_cached_products', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });

    // 3. Sync to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        sale.items
          .filter(item => !item.id.startsWith('manual-'))
          .forEach(async item => {
            const currentProd = products.find(p => p.id === item.id);
            const restored = (currentProd ? currentProd.stock : 0) + item.quantity;
            await supabase.from('products').update({ stock: restored }).eq('id', item.id);
          });

        await supabase.from('sales').update({
          status: 'Cancelled',
          admin_notes: updatedAdminNotes,
        }).eq('id', saleId);
      } catch (err) {
        console.warn("Supabase cancel sale update skipped:", err);
      }
    }

    addToast(`Order #${sale.order_number} cancelled and items returned to stock.`, 'info');
  };

  const handleResetHistory = async (): Promise<void> => {
    setSales([]);
    try { localStorage.setItem('pyj_cached_sales', JSON.stringify([])); } catch (_) {}

    if (isSupabaseConfigured) {
      try {
        await supabase.from('sale_items').delete().neq('sale_id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (_) {}
    }
    addToast('Sales history has been reset.', 'success');
  };

  const renderView = () => {
    const adminViews: View[] = ['dashboard', 'history', 'inventory'];
    if (session?.role === 'user' && adminViews.includes(currentView)) {
      setCurrentView('pos');
      return <PosView products={products} categories={categories} onAddSale={handleAddSale} />;
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-semibold">Loading PYJ POS System...</p>
        </div>
      );
    }

    switch (currentView) {
      case 'pos':
        return <PosView products={products} categories={categories} onAddSale={handleAddSale} />;
      case 'orders':
        return (
          <OrdersView
            sales={sales}
            onUpdateSaleStatus={handleUpdateSaleStatus}
            onUpdateSaleNotes={handleUpdateSaleNotes}
            onCancelSale={handleCancelSale}
            role={session!.role}
          />
        );
      case 'dashboard':
        return <DashboardView sales={sales} products={products} />;
      case 'history':
        return (
          <HistoryView
            sales={sales}
            onResetHistory={handleResetHistory}
            onUpdateSaleNotes={handleUpdateSaleNotes}
            onCancelSale={handleCancelSale}
          />
        );
      case 'inventory':
        return (
          <SettingsView 
            products={products} 
            categories={categories}
            onSaveProduct={handleSaveProduct} 
            onDeleteProduct={handleDeleteProduct}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onGlobalLogout={handleGlobalLogout}
          />
        );
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
    <Analytics />
  </ToastProvider>
);

export default App;
