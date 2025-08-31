
import React from 'react';
import type { Sale } from '../types';

// Fix: Declare the jspdf property on the global Window object to resolve TypeScript error.
declare global {
  interface Window {
    jspdf: any;
  }
}

interface HistoryViewProps {
  sales: Sale[];
}

const HistoryView: React.FC<HistoryViewProps> = ({ sales }) => {
  const formatItems = (items: Sale['items']) => {
    return items.map(item => `${item.name} (x${item.quantity})`).join(', ');
  };
  
  const handleExportCSV = () => {
    const headers = ['Transaction ID', 'Date', 'Time', 'Items', 'Total Amount', 'Payment Method'];
    const rows = sales.map(sale => {
      const date = new Date(sale.timestamp);
      return [
        sale.id,
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        formatItems(sale.items).replace(/,/g, ';'), // Replace commas in items to not break CSV
        sale.total.toFixed(2),
        sale.paymentMethod,
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pyj_sales_history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleExportPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("PYJ Sales History", 14, 16);
    doc.autoTable({
      startY: 20,
      head: [['Date', 'Time', 'Items', 'Total', 'Payment']],
      body: sales.map(sale => {
        const date = new Date(sale.timestamp);
        return [
          date.toLocaleDateString(),
          date.toLocaleTimeString(),
          formatItems(sale.items),
          `₹${sale.total.toFixed(2)}`,
          sale.paymentMethod,
        ];
      }),
    });

    doc.save('pyj_sales_history.pdf');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Sales History</h2>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-500 transition-colors">Export CSV</button>
          <button onClick={handleExportPDF} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-500 transition-colors">Export PDF</button>
        </div>
      </div>
      
      <div className="bg-slate-800 p-2 sm:p-4 rounded-lg shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="p-3">Date</th>
                <th className="p-3">Items</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Payment</th>
              </tr>
            </thead>
            <tbody>
              {sales.length > 0 ? (
                sales.map(sale => (
                  <tr key={sale.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="p-3 whitespace-nowrap">
                      <div>{new Date(sale.timestamp).toLocaleDateString()}</div>
                      <div className="text-xs text-slate-400">{new Date(sale.timestamp).toLocaleTimeString()}</div>
                    </td>
                    <td className="p-3 max-w-xs xl:max-w-md">{formatItems(sale.items)}</td>
                    <td className="p-3 text-right font-semibold text-green-400">₹{sale.total.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        sale.paymentMethod === 'Cash' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center p-6 text-slate-400">No sales recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryView;
