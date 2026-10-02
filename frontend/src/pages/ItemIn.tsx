import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowDownLeft,
  Barcode,
  Search,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Calendar,
  Building2,
  UserCheck,
  MapPin,
  Tag,
  Receipt,
} from 'lucide-react';
import { api } from '../services/api';
import type { Item, Location, StockInResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useNavigate } from 'react-router-dom';
import { getTodayAD, convertADtoBS, formatBSDisplay } from '../services/nepaliDate';

export const ItemIn: React.FC = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Header / Inward Voucher Fields
  const [dateAD, setDateAD] = useState<string>(getTodayAD());
  const [dateBS, setDateBS] = useState<string>(convertADtoBS(getTodayAD()));
  const [supplierName, setSupplierName] = useState('');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('Godown');
  const [locations, setLocations] = useState<Location[]>([]);

  // Item Scanner & Lookup
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Line Item Details
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [remark, setRemark] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [showBatchFields, setShowBatchFields] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // History / Recent Transactions
  const [recentEntries, setRecentEntries] = useState<StockInResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Focus Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Calculate live amount
  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(unitPrice) || 0;
  const calculatedAmount = numQty * numPrice;

  // Handle AD date changes and sync BS date automatically
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
        { id: 1, name: 'Godown' },
        { id: 2, name: 'Floor' },
        { id: 3, name: 'Shop' },
        { id: 4, name: 'Counter' },
      ]);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await api.getStockInHistory({ limit: 20 });
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
      setLookupError('Item not found for this barcode. Please register in Item Master.');
      setActiveItem(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmitStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) {
      showToast('error', 'Select Item', 'Please scan or look up an item first.');
      return;
    }

    if (numQty <= 0) {
      showToast('error', 'Invalid Quantity', 'Please enter a quantity greater than zero.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.stockIn({
        itemId: activeItem.id,
        quantity: numQty,
        dateAD: dateAD || undefined,
        dateBS: dateBS || undefined,
        supplierName: supplierName.trim() || undefined,
        receivedFrom: receivedFrom.trim() || undefined,
        location: selectedLocation || undefined,
        unitPrice: numPrice > 0 ? numPrice : 0,
        amount: calculatedAmount > 0 ? calculatedAmount : 0,
        batchNo: batchNo.trim() || undefined,
        mfgDate: mfgDate || undefined,
        expiryDate: expiryDate || undefined,
        remark: remark.trim() || undefined,
        idempotencyKey: `IN_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });

      showToast(
        'success',
        'Stock Received Successfully!',
        `Added ${numQty} ${activeItem.unitName || 'units'} of ${activeItem.itemName}. Balance: ${result.balanceAfter}`
      );

      // Fast Reset for rapid successive inward workflow
      setScannedBarcode('');
      setActiveItem(null);
      setQuantity('');
      setUnitPrice('');
      setRemark('');
      setBatchNo('');
      setLookupError('');
      fetchHistory();

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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center space-x-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <span>Item In (Stock Receiving & Goods Inward)</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Inward stock receiving with AD / BS date synchronization, supplier details, warehouse location, rate & amount calculation.
        </p>
      </div>

      {/* Main Receiving Form Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* HEADER SECTION: Dates, Supplier, Received From, Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pb-4 border-b border-slate-800/80">
          {/* Date AD (System default) */}
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
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-brand-500"
            />
            <span className="text-[10px] text-slate-500">System AD Date</span>
          </div>

          {/* Date BS (Nepali Bikram Sambat) */}
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

          {/* Supplier Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supplier Name</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Acme Supplies / Factory"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Received From */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Received From</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Carrier / Transporter"
              value={receivedFrom}
              onChange={(e) => setReceivedFrom(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>Storage Location *</span>
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-brand-500"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* SCANNER / ITEM LOOKUP */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Scan Barcode or Type Code (Press Enter)
          </label>
          <form onSubmit={handleBarcodeLookup} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 absolute left-3.5 top-2.5 text-brand-400" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan item barcode with USB reader or type barcode..."
                value={scannedBarcode}
                onChange={(e) => setScannedBarcode(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono text-base tracking-wider"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !scannedBarcode.trim()}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              <span>{isSearching ? 'Searching...' : 'Lookup'}</span>
            </button>
          </form>
        </div>

        {/* Not Found Banner */}
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
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-900 hover:bg-rose-800 text-white text-xs font-bold rounded-lg border border-rose-700 transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Register in Item Master</span>
              </button>
            )}
          </div>
        )}

        {/* Active Item Overview */}
        {activeItem && (
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
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

        {/* LINE ITEM ENTRY & AMOUNT CALCULATION */}
        <form onSubmit={handleSubmitStockIn} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Receiving Qty */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Receiving Qty *
              </label>
              <input
                ref={quantityInputRef}
                type="number"
                required
                min="0.01"
                step="any"
                disabled={!activeItem}
                placeholder={activeItem ? `Qty in ${activeItem.unitName}...` : 'Scan barcode first'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base font-bold focus:outline-none focus:border-emerald-500 disabled:opacity-40"
              />
            </div>

            {/* Unit (Read-only representation) */}
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

            {/* Rate / Unit Price */}
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
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base font-bold focus:outline-none focus:border-emerald-500 disabled:opacity-40"
              />
            </div>

            {/* Total Amount (Auto Calculated) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Total Amount (Qty × Rate)
              </label>
              <div className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-emerald-400 font-extrabold text-base flex items-center justify-between">
                <span>NPR</span>
                <span>{calculatedAmount > 0 ? calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Batch Tracking Toggle & Fields */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowBatchFields(!showBatchFields)}
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center space-x-1.5 font-semibold"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{showBatchFields ? '− Hide Batch & Expiry Tracking' : '+ Add Batch No / MFG / Expiry Date (Optional)'}</span>
            </button>

            {showBatchFields && (
              <div className="mt-3 p-4 bg-slate-900/70 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Batch Number</label>
                  <input
                    type="text"
                    placeholder="e.g. BATCH-2026-A1"
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Manufacturing Date (MFG)</label>
                  <input
                    type="date"
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Remark / Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Remark / Bill / Challan Number (Optional)
            </label>
            <input
              type="text"
              disabled={!activeItem}
              placeholder="e.g. Invoice #INV-8891 / Challan from Factory"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-40"
            />
          </div>

          <button
            type="submit"
            disabled={!activeItem || isSaving || numQty <= 0}
            className="w-full flex items-center justify-center space-x-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition disabled:opacity-40"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isSaving ? 'Processing Inward Transaction...' : 'Confirm Stock Receiving (Inward)'}</span>
          </button>
        </form>
      </div>

      {/* TALA TABLE: S.N, Date, Supplier, Received From, Location, Item Name, Barcode, Qty, Unit, Amount, Remark */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
          <div className="flex items-center space-x-2 text-white font-bold text-base">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <span>Inbound Receipts Table (हालै दाखिला भएको सामानहरू)</span>
          </div>
          <span className="text-xs text-slate-400">Total Entries: {recentEntries.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5 text-center">S.N</th>
                <th className="px-4 py-3.5">Date (AD / BS)</th>
                <th className="px-4 py-3.5">Supplier Name</th>
                <th className="px-4 py-3.5">Received From</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5">Item Name</th>
                <th className="px-4 py-3.5">Barcode</th>
                <th className="px-4 py-3.5 text-right">Qty</th>
                <th className="px-4 py-3.5 text-center">Unit</th>
                <th className="px-4 py-3.5 text-right">Rate</th>
                <th className="px-4 py-3.5 text-right">Amount</th>
                <th className="px-4 py-3.5">Batch</th>
                <th className="px-4 py-3.5">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loadingHistory ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                    Loading inbound receipts...
                  </td>
                </tr>
              ) : recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                    No inbound receipts recorded yet.
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

                    {/* Supplier Name */}
                    <td className="px-4 py-3.5 font-medium text-slate-200">{entry.supplierName || '—'}</td>

                    {/* Received From */}
                    <td className="px-4 py-3.5 text-slate-400">{entry.receivedFrom || '—'}</td>

                    {/* Location */}
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-900 text-slate-300 border border-slate-700">
                        {entry.location || 'Godown'}
                      </span>
                    </td>

                    {/* Item Name */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{entry.itemName}</div>
                      <div className="text-[11px] text-brand-400 font-mono">{entry.itemCode}</div>
                    </td>

                    {/* Barcode */}
                    <td className="px-4 py-3.5 font-mono text-slate-400">{entry.barcode}</td>

                    {/* Qty */}
                    <td className="px-4 py-3.5 text-right font-extrabold text-emerald-400 text-sm">
                      +{Number(entry.quantity).toLocaleString()}
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

                    {/* Batch */}
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-300">{entry.batchNo || '—'}</td>

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
