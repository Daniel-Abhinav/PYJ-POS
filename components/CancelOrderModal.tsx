import React, { useState } from 'react';
import type { Sale } from '../types';
import Modal from './Modal';

interface CancelOrderModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (saleId: string, reason: string) => Promise<void>;
}

const PRESET_REASONS = [
  'Customer Changed Mind',
  'Duplicate Order',
  'Spilled / Damaged Item',
  'Customer Left / Unpaid',
  'Other',
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  sale,
  isOpen,
  onClose,
  onConfirmCancel,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!sale) return null;

  const totalItemsCount = sale.items.reduce((acc, item) => acc + item.quantity, 0);

  const handleConfirm = async () => {
    const finalReason = selectedReason === 'Other'
      ? (customReason.trim() || 'Other reason')
      : (customReason.trim() ? `${selectedReason} - ${customReason.trim()}` : selectedReason);

    setIsSubmitting(true);
    try {
      await onConfirmCancel(sale.id, finalReason);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-1">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white">
          Cancel Order #{sale.order_number}
        </h2>
        
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
          Total value: <strong className="text-slate-800 dark:text-slate-200">₹{sale.total.toFixed(2)}</strong> ({totalItemsCount} items)
        </p>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3 rounded-lg text-xs text-amber-900 dark:text-amber-300 mb-4">
          <p className="font-semibold">⚠️ Automatic Inventory Restock</p>
          <p className="mt-0.5">Cancelling this order will immediately restore all {totalItemsCount} item(s) back into your available stock.</p>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Select Cancellation Reason
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_REASONS.map(reason => (
              <button
                key={reason}
                type="button"
                onClick={() => setSelectedReason(reason)}
                className={`py-2 px-3 text-xs font-semibold rounded-lg text-left transition-colors border ${
                  selectedReason === reason
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Additional Details / Notes (Optional)
            </label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="e.g. spilled hot milk, customer requested refund..."
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm"
          >
            Keep Order
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-red-600 text-white font-bold py-2.5 px-5 rounded-lg hover:bg-red-500 transition-colors text-sm shadow-md disabled:bg-slate-400 flex items-center gap-2"
          >
            {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CancelOrderModal;
