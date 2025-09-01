import React, { useState } from 'react';
import type { Sale } from '../types';
import Modal from '../components/Modal';
import { RefreshIcon } from '../components/icons/Icons';

// Fix: Declare the jspdf property on the global Window object to resolve TypeScript error.
declare global {
  interface Window {
    jspdf: any;
  }
}

interface HistoryViewProps {
  sales: Sale[];
  onResetHistory: () => Promise<{ rpcError: boolean }>;
}

const HistoryView: React.FC<HistoryViewProps> = ({ sales, onResetHistory }) => {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const sqlCodeToCopy = `/* 
  Step 1: Create the function to reset the sequence.
  Run this code in the Supabase SQL Editor.
*/
CREATE OR REPLACE FUNCTION reset_order_number_sequence()
RETURNS void AS $$
BEGIN
  -- This finds the sequence related to the 'order_number' column
  -- in the 'sales' table and resets it to 1.
  ALTER SEQUENCE sales_order_number_seq RESTART WITH 1;
END;
$$ LANGUAGE plpgsql;

/*
  Step 2: Grant permission for the app to use the function.
  After creating the function, run this command in the same editor.
  This is a security step to expose the function to the API.
*/
GRANT EXECUTE ON FUNCTION reset_order_number_sequence() TO anon, authenticated;`;

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(sqlCodeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

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
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    });

    const tableTitle = "PYJ Sales History";
    const generatedDate = `Generated on: ${new Date().toLocaleString()}`;
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);

    doc.setFontSize(18);
    doc.text(tableTitle, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(generatedDate, doc.internal.pageSize.getWidth() / 2, 29, { align: 'center' });

    doc.autoTable({
      startY: 35,
      head: [['Date', 'Time', 'Items', 'Payment', 'Total']],
      body: sales.map(sale => {
        const date = new Date(sale.timestamp);
        return [
          date.toLocaleDateString(),
          date.toLocaleTimeString(),
          formatItems(sale.items),
          sale.paymentMethod,
          `₹${sale.total.toFixed(2)}`,
        ];
      }),
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185], // A nice blue color
        textColor: 255,
        fontStyle: 'bold',
      },
      didDrawPage: (data) => {
        // Footer
        const str = `Page ${doc.internal.getNumberOfPages()}`;
        doc.setFontSize(10);
        doc.text(str, data.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
      },
      columnStyles: {
        4: { halign: 'right' } // Right-align the Total column
      }
    });
    
    // Add a summary footer row
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Revenue:', 150, finalY + 10, { align: 'right' });
    doc.text(`₹${totalRevenue.toFixed(2)}`, doc.internal.pageSize.getWidth() - 14, finalY + 10, { align: 'right' });

    doc.save('pyj_sales_history.pdf');
  };

  const confirmReset = async () => {
    const { rpcError } = await onResetHistory();
    setIsResetModalOpen(false); // Close the confirmation modal first

    if (rpcError) {
        setShowSetupModal(true); // Show the new setup guide modal
    } else {
        alert('Sales history and order numbers have been successfully reset.');
    }
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Sales History</h2>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-500 transition-colors">Export CSV</button>
          <button onClick={handleExportPDF} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-500 transition-colors">Export PDF</button>
          <button onClick={() => setIsResetModalOpen(true)} className="flex items-center gap-2 bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-orange-500 transition-colors">
            <RefreshIcon />
            Reset History
          </button>
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

      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)}>
          <div>
              <h2 className="text-2xl font-bold mb-4 text-white text-center">Reset Sales History?</h2>
              <p className="text-slate-300 text-center mb-6">
                This will <span className="font-bold text-red-400">permanently delete all</span> sales records. This action cannot be undone.
              </p>
              <div className="bg-slate-700/50 p-4 rounded-lg mb-6">
                <p className="text-sm text-slate-300 text-center mb-3">You can download a final copy of the history before resetting.</p>
                <div className="flex justify-center gap-4">
                  <button onClick={handleExportCSV} className="flex-1 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-500 transition-colors">Download CSV</button>
                  <button onClick={handleExportPDF} className="flex-1 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-500 transition-colors">Download PDF</button>
                </div>
              </div>
              <div className="flex justify-center gap-4">
                  <button onClick={() => setIsResetModalOpen(false)} className="bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-slate-500 transition-colors">Cancel</button>
                  <button onClick={confirmReset} className="bg-orange-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-orange-500 transition-colors">Yes, Reset History</button>
              </div>
          </div>
        </Modal>

        <Modal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)}>
          <div>
              <h2 className="text-2xl font-bold mb-4 text-white text-center">Action Required to Reset Order Numbers</h2>
              <p className="text-slate-300 text-center mb-2">
                  Sales history has been cleared successfully.
              </p>
              <p className="text-slate-300 text-center mb-6">
                  To enable automatic order number resets, a one-time setup is needed in your Supabase database.
              </p>
              
              <div className="bg-slate-900 p-4 rounded-lg mb-6 text-left">
                  <h4 className="font-semibold text-slate-200 mb-2">Instructions:</h4>
                  <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1">
                      <li>Log in to your Supabase project dashboard.</li>
                      <li>In the sidebar, go to the <strong>SQL Editor</strong>.</li>
                      <li>Click <strong>"New query"</strong>.</li>
                      <li>Copy the entire code block below, which includes two steps.</li>
                      <li>Paste it into the editor and click <strong>"Run"</strong>.</li>
                      <li>This will create the function and grant the necessary permissions.</li>
                  </ol>
              </div>

              <div className="mb-6">
                  <label htmlFor="sql-code-snippet" className="block text-sm font-medium text-slate-300 mb-2">SQL Code to run:</label>
                  <textarea
                      id="sql-code-snippet"
                      readOnly
                      className="w-full h-60 bg-slate-900 text-slate-300 font-mono text-xs p-2 rounded-md border border-slate-700 focus:outline-none"
                      value={sqlCodeToCopy}
                  />
                  <button
                      onClick={handleCopyToClipboard}
                      className="mt-2 w-full bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-500 transition-colors"
                  >
                      {copied ? 'Copied to Clipboard!' : 'Copy Code'}
                  </button>
              </div>

              <div className="flex justify-center">
                  <button onClick={() => setShowSetupModal(false)} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-500 transition-colors">
                      Done
                  </button>
              </div>
          </div>
      </Modal>

    </div>
  );
};

export default HistoryView;