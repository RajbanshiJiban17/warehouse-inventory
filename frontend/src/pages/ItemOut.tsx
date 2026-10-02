import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  User,
  Receipt,
} from 'lucide-react';
import { api } from '../services/api';
import type { Item, Location, StockOutResponse } from '../types';
import { useToast } from '../components/Toast';
import { getTodayAD, convertADtoBS, formatBSDisplay } from '../services/nepaliDate';

export const ItemOut: React.FC = () => {
  const { showToast } = useToast();

  // Header / Outward Voucher Info
  const [dateAD, setDateAD] = useState<string>(getTodayAD());
  const [dateBS, setDateBS] = useState<string>(convertADtoBS(getTodayAD()));
  const [selectedLocation, setSelectedLocation] = useState('Floor');
  const [receiverName, setReceiverName] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);

  // Scanner & Item Lookup
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Line Item Details
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [remark, setRemark] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // History
  const [recentEntries, setRecentEntries] = useState<StockOutResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Focus Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Live client-side stock validation & calculation
  const currentAvailable = activeItem ? Number(activeItem.quantity) : 0;
  const requestedQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(unitPrice) || 0;
  const calculatedAmount = requestedQty * numPrice;
  const isInsufficient = activeItem !== null && requestedQty > currentAvailable;
  const remainingPreview = currentAvailable - requestedQty;

  const handleDateADChange = (newAD: string) => {
    setDateAD(newAD);
    const convertedBS = convertADtoBS(newAD);
    if (convertedBS) setDateBS(convertedBS);
  };

  const fetchLocations = async () => {
    try {
      const locs = await api.getLocations();
      setLocations(locs);
      if (locs.length > 0) {
        setSelectedLocation(locs[0].name);
      }
    } catch {
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
      const data = await api.getStockOutHistory({ limit: 20 });
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
        location: selectedLocation.trim(),
        dateAD: dateAD || undefined,
        dateBS: dateBS || undefined,
        receiverName: receiverName.trim() || undefined,
        unitPrice: numPrice > 0 ? numPrice : 0,
        amount: calculatedAmount > 0 ? calculatedAmount : 0,
        remark: remark.trim() || undefined,
        idempotencyKey: `OUT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });

      showToast(
        'success',
        'Stock Issued Successfully!',
        `Issued ${requestedQty} ${activeItem.unitName || 'units'}. Remaining: ${result.balanceAfter}`
      );

      // Fast Reset for successive scanning
      setScannedBarcode('');
      setActiveItem(null);
      setQuantity('');
      setUnitPrice('');
      setRemark('');
      setLookupError('');
      fetchHistory();

      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      showToast('error', 'Stock Out Failed', err.message || 'Could not process deduction.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center space-x-2.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <span>Item Out (Stock Deduction & Dispatch)</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Issue inventory items with real-time stock availability verification, AD / BS date synchronization, and ledger updates.
        </p>
      </div>

      {/* Main Issue Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* HEADER SECTION: Dates, Destination Location, Receiver */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pb-4 border-b border-slate-800/80">
          {/* Date AD */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-brand-400" />
              <span>Date (AD) *</span>
            </label>
            <input
              type="date"
              required
              value={dateAD}
              onChange={(e) => handleDateADChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
            />
            <span className="text-[10px] text-slate-500">System AD Date</span>
          </div>

          {/* Date BS */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Date (BS) *</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 2083-06-16"
              value={dateBS}
              onChange={(e) => setDateBS(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 text-xs font-mono font-semibold focus:outline-none focus:border-amber-500"
            />
            <span className="text-[10px] text-amber-500/80">{formatBSDisplay(dateBS) || 'Nepali Date'}</span>
          </div>

          {/* Destination / Location */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>Destination / Location *</span>
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
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

          {/* Receiver / Issued To */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center space-x-1">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>Issued To / Receiver</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Retail Counter / Customer"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* SCANNER BAR */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Scan Barcode or Type Code (Press Enter)
          </label>
          <form onSubmit={handleBarcodeLookup} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 absolute left-3.5 top-2.5 text-amber-400" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan item barcode with USB reader or type barcode..."
                value={scannedBarcode}
                onChange={(e) => setScannedBarcode(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-base tracking-wider"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !scannedBarcode.trim()}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              <span>{isSearching ? 'Searching...' : 'Lookup'}</span>
            </button>
          </form>
        </div>

        {/* Not Found Banner */}
        {lookupError && (
          <div className="p-4 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-200 flex items-center space-x-2.5 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{lookupError}</span>
          </div>
        )}

        {/* Active Item Specs & Live Balance */}
        {activeItem && (
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div>
                <h3 className="text-base font-bold text-white">{activeItem.itemName}</h3>
                <div className="text-xs font-mono text-amber-400">{activeItem.itemCode}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Available Stock</div>
                <div
                  className={`text-xl font-extrabold ${
                    currentAvailable <= 0
                      ? 'text-rose-400'
                      : currentAvailable <= Number(activeItem.minStockLevel)
                      ? 'text-amber-400'
                      : 'text-white'
                  }`}
                >
                  {currentAvailable.toLocaleString()} <span className="text-xs font-normal text-slate-400">{activeItem.unitName}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-400 pt-1">
              <div>
                Category: <span className="text-slate-200 font-semibold">{activeItem.categoryName}</span>
              </div>
              <div>
                Unit: <span className="text-slate-200 font-semibold">{activeItem.unitName}</span>
              </div>
              <div>
                Barcode: <span className="text-slate-200 font-mono">{activeItem.barcode}</span>
              </div>
              <div>
                Min Alert: <span className="text-slate-200 font-mono">{activeItem.minStockLevel}</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Insufficient Stock Alert */}
        {isInsufficient && (
          <div className="p-4 bg-rose-950/80 border border-rose-700 rounded-xl text-rose-200 text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Insufficient stock!</span> You requested {requestedQty} {activeItem?.unitName}, but only{' '}
              {currentAvailable} is available in warehouse inventory.
            </div>
          </div>
        )}

        {/* LINE ITEM ENTRY & AMOUNT FORM */}
        <form onSubmit={handleSubmitStockOut} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Issue Quantity */}
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
                placeholder={activeItem ? `Max ${currentAvailable}...` : 'Scan barcode first'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-full px-4 py-2.5 bg-slate-900 border rounded-xl text-white text-base font-bold focus:outline-none disabled:opacity-40 ${
                  isInsufficient ? 'border-rose-500 text-rose-300' : 'border-slate-700 focus:border-amber-500'
                }`}
              />
              {activeItem && !isInsufficient && requestedQty > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Remaining after issue: <strong>{remainingPreview}</strong> {activeItem.unitName}
                </p>
              )}
            </div>

            {/* Unit */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Unit of Measure
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={activeItem?.unitName || '—'}
                className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-300 text-sm font-semibold focus:outline-none"
              />
            </div>

            {/* Rate / Valuation Price */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Rate / Unit Price (NPR)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                disabled={!activeItem}
                placeholder="Rate per unit..."
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base font-bold focus:outline-none focus:border-amber-500 disabled:opacity-40"
              />
            </div>

            {/* Total Amount */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Total Amount (Qty × Rate)
              </label>
              <div className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-amber-400 font-extrabold text-base flex items-center justify-between">
                <span>NPR</span>
                <span>{calculatedAmount > 0 ? calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Remark */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Issue Remark / Requisition Note (Optional)
            </label>
            <input
              type="text"
              disabled={!activeItem}
              placeholder="e.g. Dispatched for Floor Display / Sale to Client"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-40"
            />
          </div>

          <button
            type="submit"
            disabled={!activeItem || isInsufficient || isSaving || requestedQty <= 0}
            className="w-full flex items-center justify-center space-x-2 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold shadow-lg shadow-amber-600/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isSaving ? 'Processing Deduction...' : 'Confirm Stock Deduction (Issue)'}</span>
          </button>
        </form>
      </div>

      {/* TALA TABLE: S.N, Date, Item Name, Barcode, Qty, Unit, Rate, Amount, Location, Receiver, Balance After, Remark */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
          <div className="flex items-center space-x-2 text-white font-bold text-base">
            <Receipt className="w-5 h-5 text-amber-400" />
            <span>Outbound Issues Table (हालै निकासी भएको सामानहरू)</span>
          </div>
          <span className="text-xs text-slate-400">Total Entries: {recentEntries.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5 text-center">S.N</th>
                <th className="px-4 py-3.5">Date (AD / BS)</th>
                <th className="px-4 py-3.5">Item Name</th>
                <th className="px-4 py-3.5">Barcode</th>
                <th className="px-4 py-3.5 text-right">Qty</th>
                <th className="px-4 py-3.5 text-center">Unit</th>
                <th className="px-4 py-3.5 text-right">Rate</th>
                <th className="px-4 py-3.5 text-right">Amount</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5">Issued To</th>
                <th className="px-4 py-3.5 text-right">Left Stock</th>
                <th className="px-4 py-3.5">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loadingHistory ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    Loading outbound issues...
                  </td>
                </tr>
              ) : recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    No outbound issues recorded yet.
                  </td>
                </tr>
              ) : (
                recentEntries.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-slate-900/50 transition">
                    {/* S.N automatic 1, 2, 3... */}
                    <td className="px-4 py-3.5 text-center font-bold text-slate-400">{idx + 1}</td>

                    {/* Date AD / BS */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">
                        {entry.dateAD || new Date(entry.createdAt).toISOString().split('T')[0]}
                      </div>
                      {entry.dateBS && <div className="text-[11px] text-amber-400 font-mono">{entry.dateBS}</div>}
                    </td>

                    {/* Item Name */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{entry.itemName}</div>
                      <div className="text-[11px] text-amber-400 font-mono">{entry.itemCode}</div>
                    </td>

                    {/* Barcode */}
                    <td className="px-4 py-3.5 font-mono text-slate-400">{entry.barcode}</td>

                    {/* Qty */}
                    <td className="px-4 py-3.5 text-right font-extrabold text-amber-400 text-sm">
                      -{Number(entry.quantity).toLocaleString()}
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-3.5 text-center text-slate-400">{entry.unitName || 'pcs'}</td>

                    {/* Rate */}
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      {entry.unitPrice ? Number(entry.unitPrice).toLocaleString() : '—'}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3.5 text-right font-bold text-white">
                      {entry.amount ? Number(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-900 text-slate-300 border border-slate-700">
                        {entry.location}
                      </span>
                    </td>

                    {/* Issued To */}
                    <td className="px-4 py-3.5 text-slate-300">{entry.receiverName || '—'}</td>

                    {/* Balance Left */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-200">
                      {entry.balanceAfter}
                      {entry.isLowStockWarning && (
                        <span className="ml-1 text-[10px] text-amber-400 font-bold">(LOW)</span>
                      )}
                    </td>

                    {/* Remark */}
                    <td className="px-4 py-3.5 text-slate-400 truncate max-w-[150px]">{entry.remark || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
