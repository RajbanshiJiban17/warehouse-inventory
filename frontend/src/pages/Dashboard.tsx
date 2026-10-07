import React, { useEffect, useState } from 'react';
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Flame,
  Package,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { DashboardStats } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [statsData, chartsData] = await Promise.all([
          api.getDashboardStats(),
          api.getDashboardCharts(),
        ]);
        setStats(statsData);
        setCharts(chartsData);
      } catch {
        // Ignored
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400 text-sm">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading warehouse analytics...</span>
        </div>
      </div>
    );
  }

  if (stats && stats.totalItems === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-brand-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h1 className="text-2xl font-bold text-white tracking-tight">Warehouse Operations Center</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time stock movements, automatic quantity deductions, and inventory velocity indicators.
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-10 text-center max-w-2xl mx-auto space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 mx-auto flex items-center justify-center">
            <Boxes className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white">कुनै डाटा छैन (No Inventory Data Uploaded Yet)</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              इन्भेन्टरी पूर्णतया सफा छ। जबसम्म तपाईंले सामानको सूची (Excel / CSV Spreadsheet) अपलोड गर्नुहुन्न, यहाँ कुनै पनि डाटा देखिने छैन।
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate('/items')}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-600/30 flex items-center space-x-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Go to Item Master & Upload Spreadsheet (फाइल अपलोड)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Active Items',
      value: stats?.totalItems.toLocaleString() || '0',
      icon: Boxes,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10 border-brand-500/20',
      sub: 'Catalog SKU variants',
    },
    {
      title: 'Total Stock Quantity',
      value: Number(stats?.totalStockQuantity || 0).toLocaleString(),
      icon: Package,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      sub: 'Cumulative physical units',
    },
    {
      title: "Today's Stock In",
      value: `+${Number(stats?.todayInQuantity || 0).toLocaleString()}`,
      icon: ArrowDownLeft,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      sub: 'Received today',
    },
    {
      title: "Today's Stock Out",
      value: `-${Number(stats?.todayOutQuantity || 0).toLocaleString()}`,
      icon: ArrowUpRight,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      sub: 'Dispatched today',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Warehouse Operations Center</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time stock movements, automatic quantity deductions, and inventory velocity indicators.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats && stats.totalItems > 0 && (
            <button
              onClick={async () => {
                if (window.confirm("के तपाईं सबै आइटम र डेटा मेटाएर सिस्टम खाली गर्न चाहनुहुन्छ? (Are you sure you want to clear all inventory data?)")) {
                  try {
                    await api.resetInventory();
                    window.location.reload();
                  } catch (e: any) {
                    alert(e.message || "Failed to reset");
                  }
                }
              }}
              className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-sm"
              title="सबै डेटा मेटाएर खाली गर्नुहोस्"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>डाटा खाली गर्नुहोस् (Reset All)</span>
            </button>
          )}
          {stats && stats.lowStockCount > 0 && (
            <div className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-950/80 border border-amber-700/80 text-amber-200 text-xs font-bold animate-pulse">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{stats.lowStockCount} Item(s) Need Reordering</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-slate-700 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.title}</p>
                  <p className="text-2xl font-extrabold text-white mt-1.5">{card.value}</p>
                </div>
                <div className={`p-2.5 rounded-xl border ${card.bg} ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Analytics & Top Moving Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* In vs Out 7-Day Trend Chart */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-brand-400" />
              <span>Inbound vs Outbound Trend (Last 7 Days)</span>
            </h2>
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Stock In</span>
              </span>
              <span className="flex items-center space-x-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Stock Out</span>
              </span>
            </div>
          </div>

          <div className="h-64 flex items-end justify-between gap-3 pt-8 pb-2 px-2 border-b border-slate-800">
            {charts?.inVsOutTrend?.map((day: any, idx: number) => {
              const maxVal = Math.max(
                ...charts.inVsOutTrend.map((d: any) => Math.max(Number(d.inQuantity), Number(d.outQuantity))),
                10
              );
              const inHeight = Math.max((Number(day.inQuantity) / maxVal) * 180, 4);
              const outHeight = Math.max((Number(day.outQuantity) / maxVal) * 180, 4);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="w-full flex justify-center items-end gap-1 h-48">
                    <div
                      style={{ height: `${inHeight}px` }}
                      title={`In: ${day.inQuantity}`}
                      className="w-1/2 bg-emerald-500 rounded-t-md hover:bg-emerald-400 transition"
                    ></div>
                    <div
                      style={{ height: `${outHeight}px` }}
                      title={`Out: ${day.outQuantity}`}
                      className="w-1/2 bg-amber-500 rounded-t-md hover:bg-amber-400 transition"
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono rotate-0 truncate">
                    {day.period.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 10 Moving Items List */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Flame className="w-5 h-5 text-rose-400" />
            <span>Top Moving Items (Velocity)</span>
          </h2>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {stats?.top10MovingItems?.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No outbound movements recorded yet.</p>
            ) : (
              stats?.top10MovingItems?.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                >
                  <div className="flex items-center space-x-2.5 truncate mr-2">
                    <span className="font-bold text-slate-500 w-4 text-center">{idx + 1}</span>
                    <div className="truncate">
                      <p className="font-semibold text-white truncate">{it.itemName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{it.itemCode}</p>
                    </div>
                  </div>
                  <span className="font-bold text-amber-400 text-sm whitespace-nowrap">
                    {Number(it.totalIssued).toLocaleString()} units
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Category Stock Distribution */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-4">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <span>Stock Distribution by Category</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {charts?.stockByCategory?.map((cat: any, idx: number) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <p className="text-xs font-semibold text-slate-400">{cat.categoryName}</p>
              <p className="text-lg font-bold text-white">
                {Number(cat.totalQuantity).toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">units</span>
              </p>
              <p className="text-[11px] text-brand-400">{cat.itemCount} Registered SKUs</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
