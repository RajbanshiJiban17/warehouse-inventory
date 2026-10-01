import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowDownLeft,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  PlusCircle,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import type { Item, StockInResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useNavigate } from 'react-router-dom';

export const ItemIn: React.FC = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Inputs
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Form Fields
  const [quantity, setQuantity] = useState('');
  const [remark, setRemark] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // History
  const [recentEntries, setRecentEntries] = useState<StockInResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Focus Refs for Scanner Speed
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async () => {
    try {
      const data = await api.getStockInHistory({ limit: 10 });
      setRecentEntries(data.items);
    } catch {
      // Ignored
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    // Initial autofocus to barcode field
    barcodeInputRef.current?.focus();
    fetchHistory();
  }, []);

  const handleBarcodeLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = scannedBarcode.trim();
    if (!code) return;

    setIsSearching(true);
    setLookupError('');
    setActiveItem(null);

    try {
      const item = await api.lookupBarcode(code);
      setActiveItem(item);
      setLookupError('');
      // Scanner user optimization: Jump focus directly to Quantity!
      setTimeout(() => {
        quantityInputRef.current?.focus();
      }, 50);
    } catch {
      setLookupError('Item not found for this barcode.');
      setActiveItem(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmitStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    const numQty = parseFloat(quantity);
    if (!numQty || numQty <= 0) {
      showToast('error', 'Invalid Quantity', 'Please enter a quantity greater than zero.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.stockIn({
        itemId: activeItem.id,
        quantity: numQty,
        remark: remark.trim() || undefined,
        idempotencyKey: `IN_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });

      showToast(
        'success',
        'Stock Received Successfully!',
        `Added ${numQty} ${activeItem.unitName || 'units'}. New Balance: ${result.balanceAfter}`
      );

      // Fast Reset for rapid barcode scanning workflow
      setScannedBarcode('');
      setActiveItem(null);
      setQuantity('');
      setRemark('');
      setLookupError('');
      fetchHistory();

      // Return focus immediately to Barcode input
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      showToast('error', 'Stock In Failed', err.message || 'Could not process transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <span>Item In (Stock Receiving)</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Scan item barcode with a hardware scanner or type manually to register inbound stock and auto-update inventory balances.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Receiving Entry Card */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          {/* Scanner Barcode Bar */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Barcode Scanner Input (Press Enter or Scan)
            </label>
            <form onSubmit={handleBarcodeLookup} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-5 h-5 absolute left-3.5 top-3 text-brand-400" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan item barcode with USB reader..."
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono text-base tracking-wider"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !scannedBarcode.trim()}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                <span>{isSearching ? 'Looking up...' : 'Lookup'}</span>
              </button>
            </form>
          </div>

          {/* Not Found Banner with One-Click Registration Shortcut */}
          {lookupError && (
            <div className="p-4 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5 text-sm">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                <span>{lookupError}</span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => navigate('/items')}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 text-white text-xs font-bold rounded-lg border border-rose-700 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Register Item in Master</span>
                </button>
              )}
            </div>
          )}

          {/* Active Item Details (Read-Only Specs) */}
          {activeItem && (
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div>
                  <h3 className="text-base font-bold text-white">{activeItem.itemName}</h3>
                  <div className="text-xs font-mono text-brand-400">{activeItem.itemCode}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Current Stock</div>
                  <div className="text-xl font-extrabold text-white">
                    {Number(activeItem.quantity).toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">{activeItem.unitName}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-400 pt-1">
                <div>
                  Category: <span className="text-slate-200 font-semibold">{activeItem.categoryName}</span>
                </div>
                <div>
                  Unit: <span className="text-slate-200 font-semibold">{activeItem.unitName}</span>
                </div>
                <div>
                  Barcode: <span className="text-slate-200 font-mono">{activeItem.barcode}</span>
                </div>
              </div>
            </div>
          )}

          {/* Stock In Quantity & Save Form */}
          <form onSubmit={handleSubmitStockIn} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Receiving Quantity *
                </label>
                <input
                  ref={quantityInputRef}
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  disabled={!activeItem}
                  placeholder={activeItem ? `Enter quantity in ${activeItem.unitName}...` : 'Scan barcode first'}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-lg font-bold placeholder-slate-600 focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Remark / Supplier Note (Optional)
                </label>
                <input
                  type="text"
                  disabled={!activeItem}
                  placeholder="e.g. Shipment #9201 from Factory"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!activeItem || isSaving}
              className="w-full flex items-center justify-center space-x-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition disabled:opacity-40"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isSaving ? 'Processing Transaction...' : 'Confirm Stock Receiving'}</span>
            </button>
          </form>
        </div>

        {/* Live Balance Summary & Recent Inbound Stream */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-4">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Recent Inbound Stock</span>
            </h2>

            {loadingHistory ? (
              <p className="text-xs text-slate-500 py-8 text-center">Loading inbound stream...</p>
            ) : recentEntries.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No stock receiving entries logged today.</p>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {recentEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl text-xs space-y-1 hover:border-slate-700 transition"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-white truncate max-w-[150px]">{entry.itemName}</span>
                      <span className="font-bold text-emerald-400">+{entry.quantity}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>New Stock: {entry.balanceAfter}</span>
                      <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {entry.remark && <div className="text-[10px] text-slate-500 truncate">{entry.remark}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-brand-400" />
            <span>Automatic stock balance ledger recalculation active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
