import React, { useState, useMemo } from 'react';
import type { Sale, Product } from '../types';
import Modal from '../components/Modal';
import { useToasts } from '../components/ToastProvider';

interface DashboardViewProps {
  sales: Sale[];
  products: Product[];
}

const StatCard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  className?: string;
}> = ({ title, value, subtitle, className }) => (
  <div className={`p-4 sm:p-5 rounded-xl shadow-md transform transition-all hover:-translate-y-1 ${className}`}>
    <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider truncate">{title}</h3>
    <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">{value}</p>
    {subtitle && <p className="text-[11px] text-white/75 mt-0.5 font-medium truncate">{subtitle}</p>}
  </div>
);

const LowStockCard: React.FC<{ products: Product[] }> = ({ products }) => {
  const lowStockProducts = products.filter(p => p.stock <= 5 || p.is_sold_out).sort((a, b) => a.stock - b.stock);

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md border border-slate-200/80 dark:border-slate-700/60 flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-bold text-slate-800 dark:text-white">Inventory Alerts</h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
          {lowStockProducts.length} Alert{lowStockProducts.length === 1 ? '' : 's'}
        </span>
      </div>
      {lowStockProducts.length > 0 ? (
        <ul className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {lowStockProducts.map(product => {
            const isSoldOut = Boolean(product.is_sold_out);
            return (
              <li key={product.id} className="flex justify-between items-center text-sm p-2 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-2">{product.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  isSoldOut || product.stock === 0
                    ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                }`}>
                  {isSoldOut || product.stock === 0 ? 'Sold Out' : `${product.stock} left`}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">All products are well-stocked!</p>
      )}
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({ sales, products }) => {
  const { addToast } = useToasts();
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedClosingDate, setSelectedClosingDate] = useState<string>(todayStr);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState<string>('');

  // Map product cost lookup
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      if (p.cost_price !== undefined && p.cost_price !== null && !isNaN(p.cost_price)) {
        map.set(p.id, p.cost_price);
        map.set(p.name.toLowerCase().trim(), p.cost_price);
      }
    });
    return map;
  }, [products]);

  // Overall All-Time / Current State Metrics
  const activeSales = useMemo(() => sales.filter(s => s.status !== 'Cancelled'), [sales]);
  const cancelledSales = useMemo(() => sales.filter(s => s.status === 'Cancelled'), [sales]);

  const metrics = useMemo(() => {
    const grossRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const netRevenue = activeSales.reduce((acc, s) => acc + s.total, 0);
    const cancelledRevenue = cancelledSales.reduce((acc, s) => acc + s.total, 0);

    const cashRevenue = activeSales
      .filter(s => s.paymentMethod === 'Cash')
      .reduce((acc, s) => acc + s.total, 0);

    const upiRevenue = activeSales
      .filter(s => s.paymentMethod === 'UPI')
      .reduce((acc, s) => acc + s.total, 0);

    let totalCost = 0;
    let costTrackedRevenue = 0;

    const itemsSummary = activeSales
      .flatMap(s => s.items)
      .reduce((acc, item) => {
        const key = item.name;
        if (!acc[key]) {
          acc[key] = {
            id: item.id,
            name: item.name,
            quantity: 0,
            revenue: 0,
            totalCost: 0,
          };
        }
        acc[key].quantity += item.quantity;
        const rev = item.quantity * item.price;
        acc[key].revenue += rev;

        const cost = productCostMap.get(item.id) ?? productCostMap.get(item.name.toLowerCase().trim());
        if (cost !== undefined) {
          const itemTotalCost = item.quantity * cost;
          acc[key].totalCost += itemTotalCost;
          totalCost += itemTotalCost;
          costTrackedRevenue += rev;
        }
        return acc;
      }, {} as Record<string, { id: string; name: string; quantity: number; revenue: number; totalCost: number }>);

    const sortedItems = Object.values(itemsSummary).sort((a, b) => b.quantity - a.quantity);
    const totalUnitsSold = sortedItems.reduce((acc, item) => acc + item.quantity, 0);
    const estimatedProfit = costTrackedRevenue > 0 ? (costTrackedRevenue - totalCost) : null;

    return {
      grossRevenue,
      netRevenue,
      cancelledRevenue,
      cashRevenue,
      upiRevenue,
      totalUnitsSold,
      estimatedProfit,
      sortedItems,
    };
  }, [activeSales, cancelledSales, sales, productCostMap]);

  // Daily Closing Calculation based on selectedClosingDate
  const dailyClosingData = useMemo(() => {
    const daySales = sales.filter(s => {
      const sDate = new Date(s.timestamp).toISOString().split('T')[0];
      return sDate === selectedClosingDate;
    });

    const dayActive = daySales.filter(s => s.status !== 'Cancelled');
    const dayCancelled = daySales.filter(s => s.status === 'Cancelled');

    const netSales = dayActive.reduce((acc, s) => acc + s.total, 0);
    const cashTotal = dayActive.filter(s => s.paymentMethod === 'Cash').reduce((acc, s) => acc + s.total, 0);
    const upiTotal = dayActive.filter(s => s.paymentMethod === 'UPI').reduce((acc, s) => acc + s.total, 0);
    const cancelledTotal = dayCancelled.reduce((acc, s) => acc + s.total, 0);

    const dayItems = dayActive.flatMap(s => s.items).reduce((acc, item) => {
      acc[item.name] = (acc[item.name] || 0) + item.quantity;
      return acc;
    }, {} as Record<string, number>);

    const topItems = Object.entries(dayItems)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let dayCost = 0;
    let dayCostRevenue = 0;
    dayActive.flatMap(s => s.items).forEach(item => {
      const cost = productCostMap.get(item.id) ?? productCostMap.get(item.name.toLowerCase().trim());
      if (cost !== undefined) {
        dayCost += item.quantity * cost;
        dayCostRevenue += item.quantity * item.price;
      }
    });

    const dayProfit = dayCostRevenue > 0 ? (dayCostRevenue - dayCost) : null;

    return {
      date: selectedClosingDate,
      totalOrders: daySales.length,
      activeOrdersCount: dayActive.length,
      cancelledOrdersCount: dayCancelled.length,
      netSales,
      cashTotal,
      upiTotal,
      cancelledTotal,
      topItems,
      dayProfit,
    };
  }, [sales, selectedClosingDate, productCostMap]);

  // Over / Short Discrepancy calculation for cash drawer
  const countedCash = parseFloat(countedCashInput);
  const hasCountedCash = countedCashInput.trim() !== '' && !isNaN(countedCash);
  const discrepancy = hasCountedCash ? countedCash - dailyClosingData.cashTotal : null;

  // Format message for WhatsApp / Text
  const generateShareText = () => {
    const formattedDate = new Date(selectedClosingDate + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const lines = [
      `📊 *PYJ POS - Daily Sales Summary*`,
      `📅 *Date:* ${formattedDate}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 *Net Sales:* ₹${dailyClosingData.netSales.toFixed(2)}`,
      `💵 *Cash in Drawer:* ₹${dailyClosingData.cashTotal.toFixed(2)}`,
      `📱 *UPI Payments:* ₹${dailyClosingData.upiTotal.toFixed(2)}`,
      `📦 *Total Orders:* ${dailyClosingData.activeOrdersCount} completed${dailyClosingData.cancelledOrdersCount > 0 ? ` (${dailyClosingData.cancelledOrdersCount} cancelled)` : ''}`,
    ];

    if (dailyClosingData.dayProfit !== null) {
      lines.push(`📈 *Est. Net Profit:* ₹${dailyClosingData.dayProfit.toFixed(2)}`);
    }

    if (hasCountedCash && discrepancy !== null) {
      if (Math.abs(discrepancy) < 0.01) {
        lines.push(`⚖️ *Cash Drawer:* Balanced (₹${countedCash.toFixed(2)})`);
      } else if (discrepancy > 0) {
        lines.push(`⚖️ *Cash Drawer:* +₹${discrepancy.toFixed(2)} Over`);
      } else {
        lines.push(`⚖️ *Cash Drawer:* -₹${Math.abs(discrepancy).toFixed(2)} Short`);
      }
    }

    if (dailyClosingData.topItems.length > 0) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`🏆 *Top Selling Items:*`);
      dailyClosingData.topItems.forEach(([name, qty], idx) => {
        lines.push(`${idx + 1}. ${name} (${qty} sold)`);
      });
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`*Generated via PYJ POS*`);

    return lines.join('\n');
  };

  const handleCopySummary = () => {
    const text = generateShareText();
    navigator.clipboard.writeText(text);
    addToast('Daily summary copied to clipboard! Ready to paste into WhatsApp or SMS.', 'success');
  };

  const handleOpenWhatsApp = () => {
    const text = generateShareText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
      }
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('Opening WhatsApp & summary copied to clipboard!', 'success');
    } catch {
      window.open(url, '_blank');
    }
  };

  const topFiveBestsellers = metrics.sortedItems.slice(0, 5);
  const maxBestsellerQty = topFiveBestsellers[0]?.quantity || 1;

  const getRankBadge = (index: number) => {
    if (index === 0) return { icon: '🥇', label: '1st', color: 'from-amber-400 to-amber-500 text-amber-950 border-amber-300' };
    if (index === 1) return { icon: '🥈', label: '2nd', color: 'from-slate-200 to-slate-400 text-slate-900 border-slate-300' };
    if (index === 2) return { icon: '🥉', label: '3rd', color: 'from-amber-600 to-amber-700 text-amber-100 border-amber-600' };
    return { icon: `#${index + 1}`, label: `${index + 1}th`, color: 'from-slate-100 to-slate-200 text-slate-700 dark:from-slate-700 dark:to-slate-800 dark:text-slate-200 border-slate-300' };
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top Header & Fast Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard & Insights</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Community sales performance, leaderboard & drawer reconciliation
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsClosingModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
          >
            <span>🔒</span> End-of-Day Closing
          </button>
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95 text-xs sm:text-sm"
          >
            <span>💬</span> Share for WhatsApp
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          title="Net Revenue"
          value={`₹${metrics.netRevenue.toFixed(0)}`}
          subtitle={cancelledSales.length > 0 ? `Excl. ₹${metrics.cancelledRevenue.toFixed(0)} cancelled` : 'Gross & Net'}
          className="bg-gradient-to-br from-emerald-600 to-teal-700 col-span-2 sm:col-span-1 lg:col-span-2"
        />
        <StatCard
          title="Cash Collected"
          value={`₹${metrics.cashRevenue.toFixed(0)}`}
          subtitle="Expected Drawer Cash"
          className="bg-gradient-to-br from-green-600 to-emerald-800"
        />
        <StatCard
          title="UPI Collected"
          value={`₹${metrics.upiRevenue.toFixed(0)}`}
          subtitle="Direct Bank / Counter QR"
          className="bg-gradient-to-br from-blue-600 to-indigo-700"
        />
        <StatCard
          title="Orders Completed"
          value={activeSales.length.toString()}
          subtitle={cancelledSales.length > 0 ? `${cancelledSales.length} cancelled` : '100% fulfilled'}
          className="bg-gradient-to-br from-indigo-600 to-purple-700"
        />
        <StatCard
          title="Est. Net Profit"
          value={metrics.estimatedProfit !== null ? `₹${metrics.estimatedProfit.toFixed(0)}` : 'Set Cost'}
          subtitle="From items with cost"
          className="bg-gradient-to-br from-violet-600 to-purple-800"
        />
      </div>

      {/* Main Insights Layout: Best-Selling Leaderboard + Inventory alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard Card (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-xl shadow-md border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🏆</span> Best-Selling Items Leaderboard
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Top menu favorites ranked by total volume and revenue
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              Top 5 Items
            </span>
          </div>

          {topFiveBestsellers.length > 0 ? (
            <div className="space-y-4">
              {topFiveBestsellers.map((item, index) => {
                const badge = getRankBadge(index);
                const percentage = Math.round((item.quantity / maxBestsellerQty) * 100);
                return (
                  <div key={item.name} className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700/50 hover:bg-slate-100/80 dark:hover:bg-slate-700/70 transition-all">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${badge.color} flex items-center justify-center font-black text-sm shadow-sm flex-shrink-0 border`}>
                          {badge.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-white text-sm sm:text-base truncate">{item.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            <strong>{item.quantity}</strong> sold • avg ₹{(item.revenue / item.quantity).toFixed(0)}/ea
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">
                          ₹{item.revenue.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">revenue</p>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              No sales completed yet. Once orders are checked out, bestsellers will appear here!
            </div>
          )}
        </div>

        {/* Low Stock Card */}
        <div className="lg:col-span-1">
          <LowStockCard products={products} />
        </div>
      </div>

      {/* Complete Sales Breakdown Table */}
      <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-xl shadow-md border border-slate-200/80 dark:border-slate-700/60">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Complete Item Sales Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-3">Rank</th>
                <th className="p-3">Item Name</th>
                <th className="p-3 text-right">Units Sold</th>
                <th className="p-3 text-right">Total Revenue</th>
                <th className="p-3 text-right">Estimated Profit</th>
              </tr>
            </thead>
            <tbody>
              {metrics.sortedItems.length > 0 ? (
                metrics.sortedItems.map((item, index) => {
                  const hasCost = item.totalCost > 0;
                  const profit = hasCost ? item.revenue - item.totalCost : null;
                  return (
                    <tr key={item.name} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="p-3 text-xs font-semibold text-slate-400">#{index + 1}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                      <td className="p-3 text-right font-medium">{item.quantity}</td>
                      <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">₹{item.revenue.toFixed(2)}</td>
                      <td className="p-3 text-right text-xs">
                        {profit !== null ? (
                          <span className={`font-semibold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            ₹{profit.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No cost price set</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center p-6 text-slate-500 dark:text-slate-400">
                    No sales recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* End of Day Cash Drawer Closing Modal */}
      <Modal isOpen={isClosingModalOpen} onClose={() => setIsClosingModalOpen(false)}>
        <div className="p-1 space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">End-of-Day Cash Drawer Closing</h2>
            <p className="text-xs text-slate-500 mt-1">Reconcile cash drawer, review daily totals and confirm settlement</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Select Closing Date
            </label>
            <input
              type="date"
              value={selectedClosingDate}
              onChange={(e) => setSelectedClosingDate(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-semibold"
            />
          </div>

          {/* Daily Totals Cards */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 bg-slate-100 dark:bg-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-500 dark:text-slate-400">Net Sales</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">₹{dailyClosingData.netSales.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl">
              <span className="text-xs font-semibold text-green-700 dark:text-green-300">Expected Drawer Cash</span>
              <p className="text-xl font-black text-green-700 dark:text-green-300 mt-0.5">₹{dailyClosingData.cashTotal.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">UPI Received</span>
              <p className="text-xl font-black text-blue-700 dark:text-blue-300 mt-0.5">₹{dailyClosingData.upiTotal.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-500 dark:text-slate-400">Orders Settled</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{dailyClosingData.activeOrdersCount}</p>
            </div>
          </div>

          {/* Drawer Cash Count Verification */}
          <div className="p-4 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl space-y-3">
            <label htmlFor="drawer-count" className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Counted Physical Cash In Drawer (₹)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-lg font-bold text-slate-400">₹</span>
              <input
                id="drawer-count"
                type="number"
                step="1"
                min="0"
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                placeholder="Enter total counted notes & coins..."
                className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {hasCountedCash && discrepancy !== null && (
              <div className={`p-3 rounded-lg border text-sm flex items-center justify-between font-bold ${
                Math.abs(discrepancy) < 0.01
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                  : discrepancy > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-800 dark:text-amber-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-800 dark:text-rose-300'
              }`}>
                <span>
                  {Math.abs(discrepancy) < 0.01
                    ? '✓ Drawer Perfectly Balanced!'
                    : discrepancy > 0
                    ? `Over by ₹${discrepancy.toFixed(2)}`
                    : `Short by ₹${Math.abs(discrepancy).toFixed(2)}`}
                </span>
                <span className="text-xs font-normal opacity-80">
                  {Math.abs(discrepancy) < 0.01 ? 'Matches register expected' : `Diff from ₹${dailyClosingData.cashTotal.toFixed(2)}`}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCopySummary}
              className="py-2.5 px-4 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-semibold rounded-lg text-xs transition-colors"
            >
              Copy Summary
            </button>
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
            >
              <span>💬</span> Send on WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setIsClosingModalOpen(false)}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Share for WhatsApp Modal */}
      <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)}>
        <div className="p-1 space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Share Daily Sales Summary</h2>
            <p className="text-xs text-slate-500 mt-1">Ready-to-share message for WhatsApp community or manager update</p>
          </div>

          <div className="p-3 bg-slate-100 dark:bg-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-600">
            <pre className="text-xs whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-100 leading-relaxed max-h-60 overflow-y-auto">
              {generateShareText()}
            </pre>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span>📋</span> Copy to Clipboard
            </button>
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <span>💬</span> Open in WhatsApp
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardView;