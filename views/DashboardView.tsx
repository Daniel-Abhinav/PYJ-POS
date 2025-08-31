import React, { useMemo } from 'react';
import type { Sale, Product } from '../types';

interface DashboardViewProps {
  sales: Sale[];
  products: Product[];
}

const StatCard: React.FC<{ title: string; value: string; className?: string }> = ({ title, value, className }) => (
  <div className={`p-6 rounded-lg shadow-lg ${className}`}>
    <h3 className="text-sm font-medium text-slate-100/90 uppercase tracking-wider">{title}</h3>
    <p className="mt-2 text-3xl font-bold text-white [text-shadow:1px_1px_3px_rgba(0,0,0,0.5)]">{value}</p>
  </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ sales, products }) => {
  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.total, 0);
    const totalItemsSold = sales.reduce((acc, sale) => acc + sale.items.reduce((itemAcc, item) => itemAcc + item.quantity, 0), 0);
    
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
      salesPerItem: Object.values(salesPerItem).sort((a, b) => b.quantity - a.quantity),
    };
  }, [sales]);

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-white">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toFixed(2)}`} className="bg-gradient-to-br from-green-500 to-green-700"/>
        <StatCard title="Total Sales" value={sales.length.toString()} className="bg-gradient-to-br from-blue-500 to-blue-700"/>
        <StatCard title="Items Sold" value={stats.totalItemsSold.toString()} className="bg-gradient-to-br from-purple-500 to-purple-700" />
        <StatCard title="Product Types" value={products.length.toString()} className="bg-gradient-to-br from-yellow-500 to-yellow-700"/>
      </div>

      <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">Sales Per Item</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="p-3">Item Name</th>
                <th className="p-3 text-right">Quantity Sold</th>
                <th className="p-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.salesPerItem.length > 0 ? (
                stats.salesPerItem.map((item, index) => (
                  <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="p-3 font-medium text-white">{item.name}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right text-green-400">₹{item.revenue.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center p-6 text-slate-400">No items sold yet.</td>
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