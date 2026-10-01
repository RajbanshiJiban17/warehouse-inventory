import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

type ReportTab =
  | 'current-stock'
  | 'stock-ledger'
  | 'low-stock'
  | 'location-stock'
  | 'fast-slow-moving'
  | 'dormant-items'
  | 'user-activity';

export const Reports: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ReportTab>('stock-ledger');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const tabs = [
    { id: 'stock-ledger', label: 'Stock Movement Ledger (Reconciliation)' },
    { id: 'current-stock', label: 'Current Stock Report' },
    { id: 'low-stock', label: 'Low Stock Alerts' },
    { id: 'location-stock', label: 'Stock by Location' },
    { id: 'fast-slow-moving', label: 'Fast / Slow Moving' },
    { id: 'dormant-items', label: 'Dormant Items' },
    { id: 'user-activity', label: 'User Operations Activity' },
  ];

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.getReport(activeTab, { search: search || undefined });
      setReportData(res.items || []);
    } catch (e: any) {
      showToast('error', 'Error Loading Report', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, search]);

  const handleExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    const url = api.getReportExportUrl(activeTab, format, { search: search || undefined });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <BarChart3 className="w-7 h-7 text-brand-400" />
            <span>Analytical Reports & Stock Ledger</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Mathematical reconciliations (Opening + In - Out = Closing) and multi-format exports.
          </p>
        </div>

        {/* Export Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 hover:bg-slate-700 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 hover:bg-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 hover:bg-slate-700 transition"
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 hover:bg-slate-700 transition"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto space-x-2 border-b border-slate-800 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as ReportTab);
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Filter Bar */}
      {activeTab === 'current-stock' && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search report items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      )}

      {/* Report Tables Container */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {activeTab === 'stock-ledger' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Item Code & Name</th>
                  <th className="px-6 py-3.5 text-right">Opening Qty</th>
                  <th className="px-6 py-3.5 text-right">Total In (+)</th>
                  <th className="px-6 py-3.5 text-right">Total Out (-)</th>
                  <th className="px-6 py-3.5 text-right">Closing Balance</th>
                  <th className="px-6 py-3.5 text-center">Mathematical Reconciliation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-sans">
                      Calculating ledger balances...
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-sans">
                      No stock movement ledger records found.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50 transition">
                      <td className="px-6 py-4 font-sans">
                        <div className="font-semibold text-white">{row.itemName}</div>
                        <div className="text-xs text-brand-400 font-mono">{row.itemCode}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-300">{Number(row.openingQuantity).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-emerald-400">+{Number(row.totalIn).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-amber-400">-{Number(row.totalOut).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-white text-sm">
                        {Number(row.closingBalance).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center font-sans">
                        {row.isReconciled ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Opening + In - Out = Closing</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                            <span>MISMATCH</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'current-stock' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Code & Name</th>
                  <th className="px-6 py-3.5">Barcode</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5 text-right">Current Stock</th>
                  <th className="px-6 py-3.5 text-right">Min Stock</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-white">{row.itemName}</div>
                      <div className="text-xs font-mono text-brand-400">{row.itemCode}</div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-300">{row.barcode}</td>
                    <td className="px-6 py-3.5 text-xs">{row.categoryName}</td>
                    <td className="px-6 py-3.5 text-right font-bold text-white">
                      {Number(row.quantity).toLocaleString()} {row.unitName}
                    </td>
                    <td className="px-6 py-3.5 text-right text-xs text-slate-400">
                      {Number(row.minStockLevel).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {row.isLowStock ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                          LOW STOCK
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          IN STOCK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'low-stock' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Item Code & Name</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5 text-right">Current Stock</th>
                  <th className="px-6 py-3.5 text-right">Min Threshold</th>
                  <th className="px-6 py-3.5 text-right">Deficit (Reorder Qty)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {reportData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-emerald-400 font-sans">
                      All inventory stock levels are healthy! No items below minimum threshold.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      <td className="px-6 py-3.5 font-sans">
                        <span className="font-semibold text-white">{row.itemName}</span> ({row.itemCode})
                      </td>
                      <td className="px-6 py-3.5 font-sans text-slate-400">{row.categoryName}</td>
                      <td className="px-6 py-3.5 text-right font-bold text-amber-400">{Number(row.currentStock).toLocaleString()}</td>
                      <td className="px-6 py-3.5 text-right text-slate-400">{Number(row.minStockLevel).toLocaleString()}</td>
                      <td className="px-6 py-3.5 text-right font-bold text-rose-400">-{Number(row.deficit).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'location-stock' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Destination / Place</th>
                  <th className="px-6 py-3.5 text-right">Total Issue Transactions</th>
                  <th className="px-6 py-3.5 text-right">Cumulative Issued Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50">
                    <td className="px-6 py-4 font-semibold text-white">{row.location}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300">{row.totalTransactions}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-amber-400 text-base">
                      {Number(row.totalQuantityIssued).toLocaleString()} units
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'fast-slow-moving' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Item Code & Name</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5 text-right">Dispatched Quantity (30 Days)</th>
                  <th className="px-6 py-3.5 text-right">Operations Count</th>
                  <th className="px-6 py-3.5 text-center">Velocity Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50">
                    <td className="px-6 py-3.5">
                      <span className="font-semibold text-white">{row.itemName}</span> ({row.itemCode})
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">{row.categoryName}</td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-white">
                      {Number(row.totalIssuedQuantity).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-slate-400">{row.issueTransactionsCount}</td>
                    <td className="px-6 py-3.5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          row.status === 'FAST_MOVING'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : row.status === 'SLOW_MOVING'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : 'bg-slate-900 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'dormant-items' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Item Code & Name</th>
                  <th className="px-6 py-3.5 text-right">Stock Held</th>
                  <th className="px-6 py-3.5">Last Movement Date</th>
                  <th className="px-6 py-3.5 text-right">Days Inactive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50">
                    <td className="px-6 py-3.5 font-semibold text-white">
                      {row.itemName} <span className="text-xs font-mono text-slate-400">({row.itemCode})</span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-200">
                      {Number(row.currentStock).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-400">
                      {row.lastMovementDate ? new Date(row.lastMovementDate).toLocaleDateString() : 'No recorded movement'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-amber-400 font-bold">
                      {row.daysInactive} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'user-activity' && (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5 text-right">Stock In Ops</th>
                  <th className="px-6 py-3.5 text-right">Stock In Qty</th>
                  <th className="px-6 py-3.5 text-right">Stock Out Ops</th>
                  <th className="px-6 py-3.5 text-right">Stock Out Qty</th>
                  <th className="px-6 py-3.5 text-right">Total Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50">
                    <td className="px-6 py-3.5 font-sans font-semibold text-white">{row.username}</td>
                    <td className="px-6 py-3.5 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                        {row.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right text-emerald-400">{row.stockInCount}</td>
                    <td className="px-6 py-3.5 text-right text-emerald-400 font-bold">+{Number(row.stockInTotalQuantity).toLocaleString()}</td>
                    <td className="px-6 py-3.5 text-right text-amber-400">{row.stockOutCount}</td>
                    <td className="px-6 py-3.5 text-right text-amber-400 font-bold">-{Number(row.stockOutTotalQuantity).toLocaleString()}</td>
                    <td className="px-6 py-3.5 text-right font-bold text-white text-sm">{row.totalOperations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
