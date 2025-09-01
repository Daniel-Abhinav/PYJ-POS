import React, { useState, useEffect } from 'react';
import { Product, Sale, SaleItem } from './types';
import Header from './components/Header';
import PosView from './views/PosView';
import DashboardView from './views/DashboardView';
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';
import OrdersView from './views/OrdersView';
import { supabase } from './lib/supabaseClient';

export type View = 'pos' | 'orders' | 'dashboard' | 'history' | 'inventory';

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentView, setCurrentView] = useState<View>('pos');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
            // Provide defaults for old data that might not have these fields
            status: sale.status || 'Completed', 
            order_number: sale.order_number || 0,
        }));
        setSales(salesWithItems);
      }
    };
    
    const fetchInitialData = async () => {
      setIsLoading(true);

      // Fetch products
      const { data: productsData } = await supabase.from('products').select('*').order('name');
      if (productsData) setProducts(productsData);

      // Fetch initial sales
      await fetchSalesUpdates();
      
      setIsLoading(false);
    };

    fetchInitialData();

    // Set up polling to refresh sales data every 2 seconds as a fallback for realtime.
    const intervalId = setInterval(fetchSalesUpdates, 2000);

    // Cleanup subscription on component unmount
    return () => {
      clearInterval(intervalId);
    };

  }, []);

  const handleAddSale = async (saleData: { items: SaleItem[], total: number, paymentMethod: string }): Promise<Sale | undefined> => {
    // New logic: Fetch the current max order number to determine the next one.
    const { data: lastSale, error: lastSaleError } = await supabase
      .from('sales')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1)
      .single();

    // PGRST116 is the error code for "query returned no rows", which is expected for the first sale.
    if (lastSaleError && lastSaleError.code !== 'PGRST116') {
      console.error("Error fetching last order number:", lastSaleError);
      alert("Error creating sale: Could not determine the next order number.");
      return;
    }

    const nextOrderNumber = (lastSale?.order_number || 0) + 1;

    // 1. Insert new sale with the calculated order number
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
      // Handle potential unique constraint violation on order_number
      if (saleInsertError?.code === '23505') { // unique_violation
        alert("A sale with the same order number was just created. Please try again.");
      } else {
        alert("An error occurred while creating the sale.");
      }
      return;
    }
    const saleId = newSaleData.id;

    // 2. Prepare and insert 'sale_items'
    const saleItemsToInsert = saleData.items.map(item => ({
        sale_id: saleId,
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
    
    // Manually trigger a product refresh
    const { data: updatedProducts } = await supabase.from('products').select('*').order('name');
    if (updatedProducts) setProducts(updatedProducts);

    // Sale state update is now handled by polling.

    // 4. Construct the full sale object to return
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
    // State update is handled by the polling mechanism
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

  const handleResetHistory = async (): Promise<void> => {
    // Foreign key constraints will handle sale_items deletion
    await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // The problematic RPC call is no longer needed. The order number will
    // reset automatically on the next sale because the table will be empty.
    
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
