import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  AlertTriangle,
  MapPin,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import type { Item, Location, StockOutResponse } from '../types';
import { useToast } from '../components/Toast';

export const ItemOut: React.FC = () => {
  const { showToast } = useToast();

  // Scanner & Item Lookup
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Form Fields
  const [quantity, setQuantity] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('Floor');
  const [remark, setRemark] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // History
  const [recentEntries, setRecentEntries] = useState<StockOutResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Focus Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const fetchLocations = async () => {
    try {
      const locs = await api.getLocations();
      setLocations(locs);
      if (locs.length > 0) {
        setSelectedLocation(locs[0].name);
      }
    } catch {
      // Default fallback
      setLocations([
        { id: 1, name: 'Floor' },
        { id: 2, name: 'Godown' },
        { id: 3, name: 'Shop' },
        { id: 4, name: 'Counter' },
      ]);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await api.getStockOutHistory({ limit: 10 });
      setRecentEntries(data.items);
    } catch {
      // Ignored
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    barcodeInputRef.current?.focus();
    fetchLocations();
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
      // Scanner user optimization: Jump directly to quantity
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

  // Live client-side stock validation
  const currentAvailable = activeItem ? Number(activeItem.quantity) : 0;
  const requestedQty = parseFloat(quantity) || 0;
  const isInsufficient = activeItem !== null && requestedQty > currentAvailable;
  const remainingPreview = currentAvailable - requestedQty;

  const handleSubmitStockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    if (requestedQty <= 0) {
      showToast('error', 'Invalid Quantity', 'Quantity must be greater than zero.');
      return;
    }

    if (isInsufficient) {
      showToast(
        'error',
        'Insufficient Stock',
        `Cannot issue ${requestedQty}. Available stock is only ${currentAvailable}.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.stockOut({
        itemId: activeItem.id,
        quantity: requestedQty,
        location: selectedLocation,
        remark: remark.trim() || undefined,
        idempotencyKey: `OUT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });

      // Show immediate confirmation with updated deducted balance
      showToast(
        'success',
        'Stock Issued Successfully!',
        `Issued ${requestedQty} to ${selectedLocation}. Updated Stock: ${result.balanceAfter}`
      );

      if (result.isLowStockWarning) {
        showToast(
          'warning',
          'Low Stock Warning',
          `${activeItem.itemName} has fallen below minimum stock level (${activeItem.minStockLevel}).`
        );
      }

      // Fast Reset for rapid scanning
      setScannedBarcode('');
      setActiveItem(null);
      setQuantity('');
      setRemark('');
      setLookupError('');
      fetchHistory();

      // Return focus to Barcode scanner input
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      showToast('error', 'Stock Out Failed', err.message || 'Could not complete transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <span>Item Out (Stock Issue & Dispatch)</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Scan item barcode, specify destination location and issue quantity. Stock deductions and ledger movements are computed automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Issue Entry Card */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          {/* Scanner Barcode Bar */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Barcode Scanner Input (Press Enter or Scan)
            </label>
            <form onSubmit={handleBarcodeLookup} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-5 h-5 absolute left-3.5 top-3 text-amber-400" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan barcode for dispatch..."
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-base tracking-wider"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !scannedBarcode.trim()}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                <span>{isSearching ? 'Checking...' : 'Lookup'}</span>
              </button>
            </form>
          </div>

          {/* Error Message */}
          {lookupError && (
            <div className="p-4 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-200 flex items-center space-x-2.5 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{lookupError}</span>
            </div>
          )}

          {/* Active Item Specs Card with Live Available Stock */}
          {activeItem && (
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div>
                  <h3 className="text-base font-bold text-white">{activeItem.itemName}</h3>
                  <div className="text-xs font-mono text-amber-400">{activeItem.itemCode}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Available Stock</div>
                  <div className="text-xl font-extrabold text-emerald-400">
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
                  Min Stock Threshold: <span className="text-slate-200 font-semibold">{activeItem.minStockLevel}</span>
                </div>
              </div>
            </div>
          )}

          {/* Insufficient Stock Real-Time Alert */}
          {isInsufficient && (
            <div className="p-4 bg-rose-950/80 border border-rose-700 rounded-xl text-rose-200 text-sm flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Insufficient stock!</span> You requested {requestedQty} {activeItem?.unitName}, but only {currentAvailable} is available in inventory.
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmitStockOut} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Issue Quantity *
                </label>
                <input
                  ref={quantityInputRef}
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  disabled={!activeItem}
                  placeholder={activeItem ? `Enter quantity (max ${currentAvailable})...` : 'Scan barcode first'}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`w-full px-4 py-3 bg-slate-900 border rounded-xl text-white text-lg font-bold placeholder-slate-600 focus:outline-none disabled:opacity-40 ${
                    isInsufficient
                      ? 'border-rose-500 focus:border-rose-500 text-rose-300'
                      : 'border-slate-700/80 focus:border-amber-500'
                  }`}
                />
                {activeItem && !isInsufficient && requestedQty > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Automatic balance deduction: <strong>{remainingPreview}</strong> remaining after issue
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Destination / Place *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                  <select
                    disabled={!activeItem}
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-40"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                    <option value="Customer Sale">Customer Direct Sale</option>
                    <option value="Damaged / Scrap">Damaged / Scrap Write-off</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Issue Remark / Requisition Note (Optional)
              </label>
              <input
                type="text"
                disabled={!activeItem}
                placeholder="e.g. Dispatched for Retail Floor Display"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-40"
              />
            </div>

            <button
              type="submit"
              disabled={!activeItem || isInsufficient || isSaving || requestedQty <= 0}
              className="w-full flex items-center justify-center space-x-2 py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shadow-lg shadow-amber-600/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isSaving ? 'Executing Transaction...' : 'Confirm Stock Deduction'}</span>
            </button>
          </form>
        </div>

        {/* Live Balance Summary & Recent Outbound Stream */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2 mb-4">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Recent Outbound Issues</span>
            </h2>

            {loadingHistory ? (
              <p className="text-xs text-slate-500 py-8 text-center">Loading outbound stream...</p>
            ) : recentEntries.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No stock issues logged today.</p>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {recentEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl text-xs space-y-1 hover:border-slate-700 transition"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-white truncate max-w-[150px]">{entry.itemName}</span>
                      <span className="font-bold text-amber-400">-{entry.quantity}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Location: {entry.location}</span>
                      <span>Left: {entry.balanceAfter}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {entry.isLowStockWarning && (
                        <span className="text-amber-400 font-bold flex items-center space-x-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          <span>LOW</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Automatic stock deduction & ledger synchronization</span>
          </div>
        </div>
      </div>
    </div>
  );
};
