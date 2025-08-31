import React, { useState, useMemo } from 'react';
import type { Sale } from '../types';

interface OrdersViewProps {
  sales: Sale[];
  onUpdateSaleStatus: (saleId: string, status: 'Completed') => Promise<void>;
}

const OrderCard: React.FC<{ sale: Sale; onMarkAsDone: (saleId: string) => void }> = ({ sale, onMarkAsDone }) => {
  return (
    <div className="bg-slate-800 rounded-lg shadow-lg p-4 flex flex-col justify-between transform transition-transform hover:scale-105">
      <div>
        <div className="flex justify-between items-baseline border-b border-slate-700 pb-2 mb-3">
          <h3 className="text-4xl md:text-5xl font-bold text-indigo-400 [text-shadow:1px_1px_5px_rgba(99,102,241,0.5)]">#{sale.order_number}</h3>
          <span className="text-xs text-slate-400">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <ul className="space-y-1 text-base">
          {sale.items.map((item, index) => (
            <li key={`${item.id}-${index}`} className="flex justify-between text-slate-200">
              <span className="truncate pr-2">{item.name}</span>
              <span className="font-semibold whitespace-nowrap">x {item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={() => onMarkAsDone(sale.id)}
        className="mt-4 w-full bg-green-600 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-green-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-green-500"
        aria-label={`Mark order number ${sale.order_number} as done`}
      >
        Mark as Done
      </button>
    </div>
  );
};

const RecentlyCompletedChip: React.FC<{ sale: Sale }> = ({ sale }) => (
    <div className="bg-slate-700 text-slate-300 rounded-full px-4 py-1.5 text-sm font-semibold shadow">
        #{sale.order_number} Done
    </div>
);


const OrdersView: React.FC<OrdersViewProps> = ({ sales, onUpdateSaleStatus }) => {
  const [showHistory, setShowHistory] = useState(false);

  const pendingOrders = useMemo(() =>
    sales
      .filter(sale => sale.status === 'Pending')
      .sort((a, b) => (a.order_number || 0) - (b.order_number || 0)),
  [sales]);

  const completedOrders = useMemo(() =>
    sales
      .filter(sale => sale.status === 'Completed')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
  [sales]);
  
  const recentlyCompleted = completedOrders.slice(0, 3);
  
  const handleMarkAsDone = (saleId: string) => {
    onUpdateSaleStatus(saleId, 'Completed');
  };

  return (
    <div className="p-0 md:p-4 max-w-7xl mx-auto">
      {/* This outer div is for small screen padding */}
      <div className="p-4 md:p-0">
        <section className="mb-8" aria-labelledby="pending-orders-heading">
          <h2 id="pending-orders-heading" className="text-2xl font-bold text-white mb-4">
            Pending Orders ({pendingOrders.length})
          </h2>
          {pendingOrders.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {pendingOrders.map(sale => (
                <OrderCard key={sale.id} sale={sale} onMarkAsDone={handleMarkAsDone} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-slate-800 rounded-lg shadow-inner">
              <p className="text-slate-400">No pending orders.</p>
            </div>
          )}
        </section>

        <section className="mb-8 p-4 bg-slate-800/50 rounded-lg" aria-labelledby="recently-completed-heading">
            <h3 id="recently-completed-heading" className="text-xl font-bold text-white mb-3">Recently Completed</h3>
            {recentlyCompleted.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                  {recentlyCompleted.map(sale => (
                      <RecentlyCompletedChip key={sale.id} sale={sale} />
                  ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No orders completed yet.</p>
            )}
        </section>

        <section aria-labelledby="order-history-heading">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full text-left text-xl font-bold text-white mb-4 p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500"
            aria-expanded={showHistory}
            aria-controls="order-history-content"
          >
             <h3 id="order-history-heading" className="flex justify-between items-center">
                <span>Full Order History</span>
                <svg className={`w-6 h-6 transform transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </h3>
          </button>
          {showHistory && (
            <div id="order-history-content" className="bg-slate-800 p-2 sm:p-4 rounded-lg shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="p-3">Order #</th>
                      <th className="p-3">Time</th>
                      <th className="p-3">Items</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedOrders.length > 0 ? (
                      completedOrders.map(sale => (
                        <tr key={sale.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                          <td className="p-3 font-bold text-indigo-400 whitespace-nowrap">#{sale.order_number}</td>
                          <td className="p-3 whitespace-nowrap">{new Date(sale.timestamp).toLocaleTimeString()}</td>
                          <td className="p-3 max-w-xs">{sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</td>
                          <td className="p-3 text-right text-green-400 whitespace-nowrap">₹{sale.total.toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center p-6 text-slate-400">No completed orders in history.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default OrdersView;
