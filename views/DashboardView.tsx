import React, { useMemo } from 'react';
import type { Sale, Product } from '../types';

interface DashboardViewProps {
  sales: Sale[];
  products: Product[];
}

const StatCard: React.FC<{ title: string; value: string; className?: string }> = ({ title, value, className }) => (
  <div className={`p-6 rounded-lg shadow-lg transform transition-transform hover:-translate-y-1 ${className}`}>
    <h3 className="text-sm font-medium text-slate-100/90 uppercase tracking-wider">{title}</h3>
    <p className="mt-2 text-3xl font-bold text-white [text-shadow:1px_1px_3px_rgba(0,0,0,0.5)]">{value}</p>
  </div>
);

const LowStockCard: React.FC<{ products: Product[] }> = ({ products }) => {
  const lowStockProducts = products.filter(p => p.stock <= 5).sort((a,b) => a.stock - b.stock);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4">Low Stock Items</h3>
      {lowStockProducts.length > 0 ? (
        <ul className="space-y-3 max-h-80 overflow-y-auto">
          {lowStockProducts.map(product => (
            <li key={product.id} className="flex justify-between items-center text-sm">
              <span>{product.name}</span>
              <span className={`font-bold px-2 py-0.5 rounded-full ${
                product.stock === 0 ? 'bg-red-200 dark:bg-red-800/50 text-red-800 dark:text-red-300' : 'bg-yellow-200 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-300'
              }`}>
                {product.stock} left
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500 dark:text-slate-400">All products are well-stocked!</p>
      )}
    </div>
  );
};


const DashboardView: React.FC<DashboardViewProps> = ({ sales, products }) => {
  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.total, 0);
    const totalItemsSold = sales.reduce((acc, sale) => acc + sale.items.reduce((itemAcc, item) => itemAcc + item.quantity, 0), 0);
    
    const totalRevenueCash = sales
      .filter(sale => sale.paymentMethod === 'Cash')
      .reduce((acc, sale) => acc + sale.total, 0);

    const totalRevenueUPI = sales
      .filter(sale => sale.paymentMethod === 'UPI')
      .reduce((acc, sale) => acc + sale.total, 0);

    const salesPerItem = sales
      .flatMap(sale => sale.items)
      .reduce((acc, item) => {
        if (!acc[item.id]) {
          acc[item.id] = { name: item.name, quantity: 0, revenue: 0 };
        }
        acc[item.id].quantity += item.quantity;
        acc[item.id].revenue += item.quantity * item.price;
        return acc;
      }, {} as Record<string, { name: string; quantity: number; revenue: number }>);

    return {
      totalRevenue,
      totalItemsSold,
      totalRevenueCash,
      totalRevenueUPI,
      salesPerItem: Object.values(salesPerItem).sort((a, b) => b.quantity - a.quantity),
    };
  }, [sales]);

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toFixed(2)}`} className="bg-gradient-to-br from-green-500 to-green-700"/>
          <StatCard title="Revenue (Cash)" value={`₹${stats.totalRevenueCash.toFixed(2)}`} className="bg-gradient-to-br from-teal-500 to-teal-700"/>
          <StatCard title="Revenue (UPI)" value={`₹${stats.totalRevenueUPI.toFixed(2)}`} className="bg-gradient-to-br from-sky-500 to-sky-700"/>
          <StatCard title="Total Sales" value={sales.length.toString()} className="bg-gradient-to-br from-blue-500 to-blue-700"/>
          <StatCard title="Items Sold" value={stats.totalItemsSold.toString()} className="bg-gradient-to-br from-purple-500 to-purple-700" />
          <StatCard title="Product Types" value={products.length.toString()} className="bg-gradient-to-br from-yellow-500 to-yellow-700"/>
        </div>
        <LowStockCard products={products}/>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-bold mb-4">Sales Per Item</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="p-3">Item Name</th>
                <th className="p-3 text-right">Quantity Sold</th>
                <th className="p-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.salesPerItem.length > 0 ? (
                stats.salesPerItem.map((item, index) => (
                  <tr key={index} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right text-green-600 dark:text-green-400">₹{item.revenue.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center p-6 text-slate-500 dark:text-slate-400">No items sold yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;