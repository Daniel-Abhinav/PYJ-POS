import React, { useState, useMemo } from 'react';
import type { Sale } from '../types';
import Modal from '../components/Modal';
import { RefreshIcon } from '../components/icons/Icons';
import { useToasts } from '../components/ToastProvider';

declare global {
  interface Window { jspdf: any; }
}

const DailyReportModal: React.FC<{ isOpen: boolean; onClose: () => void; sales: Sale[] }> = ({ isOpen, onClose, sales }) => {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);

    const reportData = useMemo(() => {
        const filteredSales = sales.filter(sale => {
            const saleDate = new Date(sale.timestamp);
            const saleDateString = saleDate.toISOString().split('T')[0];
            return saleDateString === selectedDate;
        });

        if (filteredSales.length === 0) return null;

        const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
        const totalSales = filteredSales.length;
        const cashRevenue = filteredSales.filter(s => s.paymentMethod === 'Cash').reduce((s, a) => s + a.total, 0);
        const upiRevenue = filteredSales.filter(s => s.paymentMethod === 'UPI').reduce((s, a) => s + a.total, 0);

        const itemsSold = filteredSales.flatMap(s => s.items).reduce((acc, item) => {
            acc[item.name] = (acc[item.name] || 0) + item.quantity;
            return acc;
        }, {} as Record<string, number>);

        return { totalRevenue, totalSales, cashRevenue, upiRevenue, itemsSold: Object.entries(itemsSold) };
    }, [selectedDate, sales]);
    
    const handlePrint = () => {
        const printContents = document.getElementById('print-area')?.innerHTML;
        const originalContents = document.body.innerHTML;
        if (printContents) {
            document.body.innerHTML = printContents;
            window.print();
            document.body.innerHTML = originalContents;
            // Re-attach React to the DOM, a bit of a hack but necessary after replacing innerHTML
            window.location.reload(); 
        }
    };
    
    const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="text-slate-800 dark:text-slate-100">
                <h2 className="text-2xl font-bold mb-4 text-center">Daily Sales Report</h2>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                    className="w-full p-2 rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600"
                />
                
                <div id="print-area" className="mt-6">
                    <style>{`@media print { body { padding: 2rem; } .no-print { display: none; } }`}</style>
                    <h3 className="text-xl font-semibold text-center">{formattedDate}</h3>
                    {reportData ? (
                        <div className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                                    <p className="text-sm text-slate-500">Total Revenue</p>
                                    <p className="text-2xl font-bold">₹{reportData.totalRevenue.toFixed(2)}</p>
                                </div>
                                 <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                                    <p className="text-sm text-slate-500">Total Sales</p>
                                    <p className="text-2xl font-bold">{reportData.totalSales}</p>
                                </div>
                            </div>
                             <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                                    <p className="text-sm text-green-600">Cash Revenue</p>
                                    <p className="text-lg font-semibold">₹{reportData.cashRevenue.toFixed(2)}</p>
                                </div>
                                 <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                    <p className="text-sm text-blue-600">UPI Revenue</p>
                                    <p className="text-lg font-semibold">₹{reportData.upiRevenue.toFixed(2)}</p>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Items Sold Summary:</h4>
                                <ul className="space-y-1 text-sm list-disc list-inside max-h-40 overflow-y-auto p-2 bg-slate-100 dark:bg-slate-700/50 rounded">
                                    {reportData.itemsSold.map(([name, qty]) => <li key={name}>{name}: <strong>{qty}</strong></li>)}
                                </ul>
                            </div>
                        </div>
                    ) : <p className="text-center text-slate-500 mt-8">No sales recorded on this date.</p>}
                </div>
                
                <div className="flex justify-end gap-3 mt-8 no-print">
                    <button onClick={onClose} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Close</button>
                    <button onClick={handlePrint} disabled={!reportData} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-500 disabled:bg-slate-400">Print Report</button>
                </div>
            </div>
        </Modal>
    );
};


const HistoryView: React.FC<{ sales: Sale[]; onResetHistory: () => Promise<void>; }> = ({ sales, onResetHistory }) => {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const { addToast } = useToasts();

  const formatItems = (items: Sale['items']) => items.map(item => `${item.name} (x${item.quantity})`).join(', ');
  
  const handleExportCSV = () => {
    const headers = ['Transaction ID', 'Date', 'Time', 'Items', 'Total Amount', 'Payment Method'];
    const rows = sales.map(sale => [
        sale.id, new Date(sale.timestamp).toLocaleDateString(), new Date(sale.timestamp).toLocaleTimeString(),
        formatItems(sale.items).replace(/,/g, ';'), sale.total.toFixed(2), sale.paymentMethod
      ].join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const link = Object.assign(document.createElement("a"), { href: encodeURI(csvContent), download: "pyj_sales_history.csv" });
    link.click();
    link.remove();
  };
  
  const handleExportPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);

    doc.setFontSize(18);
    doc.text("PYJ Sales History", 105, 22, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 29, { align: 'center' });
    doc.autoTable({
      startY: 35,
      head: [['Date', 'Time', 'Items', 'Payment', 'Total']],
      body: sales.map(sale => [ new Date(sale.timestamp).toLocaleDateString(), new Date(sale.timestamp).toLocaleTimeString(), formatItems(sale.items), sale.paymentMethod, `₹${sale.total.toFixed(2)}` ]),
      theme: 'grid', headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      didDrawPage: (data) => doc.text(`Page ${doc.internal.getNumberOfPages()}`, data.settings.margin.left, doc.internal.pageSize.getHeight() - 10),
      columnStyles: { 4: { halign: 'right' } }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Total Revenue:', 150, finalY + 10, { align: 'right' });
    doc.text(`₹${totalRevenue.toFixed(2)}`, doc.internal.pageSize.getWidth() - 14, finalY + 10, { align: 'right' });
    doc.save('pyj_sales_history.pdf');
  };

  const confirmReset = async () => {
    await onResetHistory();
    setIsResetModalOpen(false);
    addToast('Sales history has been reset.', 'success');
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold">Sales History</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setIsReportModalOpen(true)} className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-purple-500">Daily Report</button>
          <button onClick={handleExportCSV} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-500">Export CSV</button>
          <button onClick={handleExportPDF} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-500">Export PDF</button>
          <button onClick={() => setIsResetModalOpen(true)} className="flex items-center gap-2 bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-orange-500">
            <RefreshIcon /> Reset History
          </button>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-2 sm:p-4 rounded-lg shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="p-3">Date</th>
                <th className="p-3">Items</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Payment</th>
              </tr>
            </thead>
            <tbody>
              {sales.length > 0 ? (
                sales.map(sale => (
                  <tr key={sale.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="p-3 whitespace-nowrap">
                      <div>{new Date(sale.timestamp).toLocaleDateString()}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(sale.timestamp).toLocaleTimeString()}</div>
                    </td>
                    <td className="p-3 max-w-xs xl:max-w-md">{formatItems(sale.items)}</td>
                    <td className="p-3 text-right font-semibold text-green-600 dark:text-green-400">₹{sale.total.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ sale.paymentMethod === 'Cash' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' }`}>
                        {sale.paymentMethod}
                      </span>
                    </td>
                  </tr>
                ))
              ) : <tr><td colSpan={4} className="text-center p-6 text-slate-500 dark:text-slate-400">No sales recorded yet.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)}>
          <div>
              <h2 className="text-2xl font-bold mb-4 text-center">Reset Sales History?</h2>
              <p className="text-center mb-6"> This will <span className="font-bold text-red-500 dark:text-red-400">permanently delete all</span> sales records. This action cannot be undone. </p>
              <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg mb-6">
                <p className="text-sm text-center mb-3">You can download a final copy of the history before resetting.</p>
                <div className="flex justify-center gap-4">
                  <button onClick={handleExportCSV} className="flex-1 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-500">Download CSV</button>
                  <button onClick={handleExportPDF} className="flex-1 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-500">Download PDF</button>
                </div>
              </div>
              <div className="flex justify-center gap-4">
                  <button onClick={() => setIsResetModalOpen(false)} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
                  <button onClick={confirmReset} className="bg-orange-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-orange-500">Yes, Reset History</button>
              </div>
          </div>
        </Modal>
        
        <DailyReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} sales={sales} />
    </div>
  );
};

export default HistoryView;