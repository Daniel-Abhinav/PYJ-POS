
import React, { useState, useMemo } from 'react';
import type { Sale } from '../types';
import Modal from '../components/Modal';
import { NotesIcon, SearchIcon, ViewGridIcon, ViewListIcon } from '../components/icons/Icons';

interface OrdersViewProps {
  sales: Sale[];
  onUpdateSaleStatus: (saleId: string, status: 'Completed') => Promise<void>;
  onUpdateSaleNotes: (saleId: string, notes: string) => Promise<void>;
  role: 'user' | 'admin';
}

const OrderCard: React.FC<{ sale: Sale; onMarkAsDone: (saleId: string) => void }> = ({ sale, onMarkAsDone }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 flex flex-col justify-between transform transition-transform hover:-translate-y-1 animate-fade-in-up">
      <div>
        <div className="flex justify-between items-baseline border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">
          <h3 className="text-4xl md:text-5xl font-bold text-indigo-500 dark:text-indigo-400 [text-shadow:1px_1px_5px_rgba(99,102,241,0.2)]">#{sale.order_number}</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <ul className="space-y-1 text-base mb-3 max-h-32 overflow-y-auto">
          {sale.items.map((item, index) => (
            <li key={`${item.id}-${index}`} className="flex justify-between">
              <span className="truncate pr-2">{item.name}</span>
              <span className="font-semibold whitespace-nowrap">x {item.quantity}</span>
            </li>
          ))}
        </ul>
        {sale.user_notes && (
          <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-semibold flex items-center gap-2"><NotesIcon /> Note:</p>
            <p className="whitespace-pre-wrap pl-1">{sale.user_notes}</p>
          </div>
        )}
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

const CompactOrderCard: React.FC<{ sale: Sale; onClick: (sale: Sale) => void }> = ({ sale, onClick }) => (
    <button
      onClick={() => onClick(sale)}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 flex flex-col justify-center items-center aspect-square transform transition-transform hover:-translate-y-1 animate-fade-in-up"
    >
      <span className="text-4xl font-bold text-indigo-500 dark:text-indigo-400">#{sale.order_number}</span>
    </button>
);

const RecentlyCompletedChip: React.FC<{ sale: Sale; onClick: (sale: Sale) => void; isHighlighted: boolean }> = ({ sale, onClick, isHighlighted }) => (
    <button
        onClick={() => onClick(sale)}
        className={`rounded-full px-4 py-1.5 text-sm font-semibold shadow transition-all duration-300 ${
        isHighlighted
            ? 'bg-indigo-500 text-white ring-2 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-800 ring-indigo-500'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
        }`}
    >
        #{sale.order_number} Done
    </button>
);


const NotesModal: React.FC<{ sale: Sale; onClose: () => void; onSave: (notes: string) => Promise<void>; }> = ({ sale, onClose, onSave }) => {
  const [notes, setNotes] = useState(sale.admin_notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(notes);
    setIsSaving(false);
    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <h2 className="text-2xl font-bold mb-4">Notes for Order #{sale.order_number}</h2>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}
        className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500"
        placeholder="Add administrative notes here..." autoFocus />
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
        <button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-500 disabled:bg-slate-500">
          {isSaving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>
    </Modal>
  );
};

const OrderDetailsModal: React.FC<{ sale: Sale | null; onClose: () => void; onMarkAsDone: (id: string) => void }> = ({ sale, onClose, onMarkAsDone }) => {
    if (!sale) return null;
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-baseline border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">
                  <h3 className="text-4xl md:text-5xl font-bold text-indigo-500 dark:text-indigo-400">#{sale.order_number}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <ul className="space-y-1 text-base mb-3 max-h-48 overflow-y-auto">
                  {sale.items.map((item, index) => (
                    <li key={`${item.id}-${index}`} className="flex justify-between">
                      <span className="truncate pr-2">{item.name}</span>
                      <span className="font-semibold whitespace-nowrap">x {item.quantity}</span>
                    </li>
                  ))}
                </ul>
                {sale.user_notes && (
                  <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-semibold flex items-center gap-2"><NotesIcon /> Note:</p>
                    <p className="whitespace-pre-wrap pl-1">{sale.user_notes}</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => { onMarkAsDone(sale.id); onClose(); }}
                className="mt-4 w-full bg-green-600 text-white font-bold py-3 rounded-lg shadow-lg hover:bg-green-500"
              >
                Mark as Done
              </button>
            </div>
        </Modal>
    );
};


const OrdersView: React.FC<OrdersViewProps> = ({ sales, onUpdateSaleStatus, onUpdateSaleNotes, role }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isCompactView, setIsCompactView] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Sale | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);


  const pendingOrders = useMemo(() =>
    sales.filter(s => s.status === 'Pending').sort((a, b) => (a.order_number || 0) - (b.order_number || 0)),
  [sales]);

  const completedOrders = useMemo(() =>
    sales.filter(s => s.status === 'Completed').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
  [sales]);
  
  const recentlyCompleted = completedOrders.slice(0, 5);

  const filteredCompletedOrders = useMemo(() => {
    if (!historySearchTerm.trim()) return completedOrders;
    return completedOrders.filter(sale => sale.order_number.toString().includes(historySearchTerm.trim()));
  }, [completedOrders, historySearchTerm]);

  const handleChipClick = (sale: Sale) => {
    setHighlightedOrderId(sale.id);
    if (!showHistory) setShowHistory(true);
    setHistorySearchTerm(''); // Clear search on chip click
    
    setTimeout(() => {
      document.getElementById(`order-row-${sale.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedOrderId(null), 2000); // Highlight lasts for 2 seconds
    }, 100);
  };

  return (
    <div className="animate-fade-in">
        <section className="mb-8" aria-labelledby="pending-orders-heading">
            <div className="flex justify-between items-center mb-4">
                <h2 id="pending-orders-heading" className="text-2xl font-bold">
                    Pending Orders ({pendingOrders.length})
                </h2>
                <button 
                    onClick={() => setIsCompactView(!isCompactView)} 
                    className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    aria-label={isCompactView ? "Switch to detailed view" : "Switch to compact view"}
                >
                    {isCompactView ? <ViewListIcon className="h-5 w-5"/> : <ViewGridIcon className="h-5 w-5"/>}
                </button>
            </div>
          {pendingOrders.length > 0 ? (
            <div className={`grid gap-4 ${isCompactView 
                ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10' 
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}
            >
              {pendingOrders.map(sale => (
                isCompactView ?
                <CompactOrderCard key={sale.id} sale={sale} onClick={setSelectedOrderDetails} /> :
                <OrderCard key={sale.id} sale={sale} onMarkAsDone={(id) => onUpdateSaleStatus(id, 'Completed')} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-lg shadow-inner">
              <p className="text-slate-500 dark:text-slate-400">No pending orders.</p>
            </div>
          )}
        </section>

        <section className="mb-8 p-4 bg-white dark:bg-slate-800/50 rounded-lg" aria-labelledby="recently-completed-heading">
            <h3 id="recently-completed-heading" className="text-xl font-bold mb-3">Recently Completed</h3>
            {recentlyCompleted.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                  {recentlyCompleted.map(sale => <RecentlyCompletedChip key={sale.id} sale={sale} onClick={handleChipClick} isHighlighted={sale.id === highlightedOrderId} />)}
              </div>
            ) : <p className="text-sm text-slate-500">No orders completed yet.</p>}
        </section>

        <section aria-labelledby="order-history-heading">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full text-left text-xl font-bold mb-4 p-4 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500"
            aria-expanded={showHistory} aria-controls="order-history-content">
             <h3 id="order-history-heading" className="flex justify-between items-center">
                <span>Full Order History</span>
                <svg className={`w-6 h-6 transform transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </h3>
          </button>
          {showHistory && (
            <div id="order-history-content" className="bg-white dark:bg-slate-800 p-2 sm:p-4 rounded-lg shadow-lg">
              <div className="relative mb-4">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500"><SearchIcon/></span>
                  <input type="text" placeholder="Search by Order #" value={historySearchTerm} onChange={(e) => setHistorySearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-full bg-slate-100 dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"/>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <th className="p-3">Order #</th>
                      <th className="p-3">Time</th>
                      <th className="p-3">Items</th>
                      <th className="p-3">Admin Notes</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompletedOrders.map(sale => (
                        <tr key={sale.id} id={`order-row-${sale.id}`} className={`border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-500 ${sale.id === highlightedOrderId ? 'bg-indigo-100 dark:bg-indigo-900/50' : ''}`}>
                          <td className="p-3 font-bold text-indigo-500 dark:text-indigo-400 whitespace-nowrap">#{sale.order_number}</td>
                          <td className="p-3 whitespace-nowrap">{new Date(sale.timestamp).toLocaleTimeString()}</td>
                          <td className="p-3 max-w-xs">{sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</td>
                          <td className="p-3 max-w-xs">
                            <p className="text-sm whitespace-pre-wrap">{sale.admin_notes || <span className="text-slate-500">No notes</span>}</p>
                            {role === 'admin' && (
                                <button onClick={() => setEditingSale(sale)} className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline mt-1" aria-label={`Edit notes for order ${sale.order_number}`}>
                                    {sale.admin_notes ? 'Edit Notes' : 'Add Notes'}
                                </button>
                            )}
                          </td>
                          <td className="p-3 text-right text-green-600 dark:text-green-400 whitespace-nowrap">₹{sale.total.toFixed(2)}</td>
                        </tr>
                    ))}
                    {filteredCompletedOrders.length === 0 && <tr><td colSpan={5} className="text-center p-6 text-slate-500 dark:text-slate-400">No matching orders found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
       {editingSale && <NotesModal sale={editingSale} onClose={() => setEditingSale(null)} onSave={(notes) => onUpdateSaleNotes(editingSale.id, notes)} />}
       <OrderDetailsModal sale={selectedOrderDetails} onClose={() => setSelectedOrderDetails(null)} onMarkAsDone={(id) => onUpdateSaleStatus(id, 'Completed')} />
    </div>
  );
};

export default OrdersView;
