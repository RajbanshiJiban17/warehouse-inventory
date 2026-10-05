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
  Boxes,
  X,
  Tag,
} from 'lucide-react';
import { api } from '../services/api';
import type { Item, Location, StockOutResponse } from '../types';
import { useToast } from '../components/Toast';
import {
  getTodayAD,
  convertADtoBS,
  convertBStoAD,
  formatBSDisplay,
  formatADDisplay,
  isValidBSDate,
  isValidADDate,
} from '../services/nepaliDate';

export const ItemOut: React.FC = () => {
  const { showToast } = useToast();

  // Header / Outward Voucher Info (Connected AD <-> BS)
  const [dateAD, setDateAD] = useState<string>(getTodayAD());
  const [dateBS, setDateBS] = useState<string>(convertADtoBS(getTodayAD()));
  const [selectedLocation, setSelectedLocation] = useState('Floor');
  const [receiverName, setReceiverName] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);

  // Item List Catalog (For dropdown autocomplete by Code & Name)
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Separate Inputs: Code, Name, Barcode
  const [inputItemCode, setInputItemCode] = useState('');
  const [inputItemName, setInputItemName] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  // Item Batches
  const [itemBatches, setItemBatches] = useState<any[]>([]);
  const [selectedBatchNo, setSelectedBatchNo] = useState('');

  // Line Item Details
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [remark, setRemark] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // History
  const [recentEntries, setRecentEntries] = useState<StockOutResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Focus Refs
  const itemCodeInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Live client-side stock validation & calculation
  const currentAvailable = activeItem ? Number(activeItem.quantity) : 0;
  const requestedQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(unitPrice) || 0;
  const calculatedAmount = requestedQty * numPrice;
  const isInsufficient = activeItem !== null && requestedQty > currentAvailable;
  const remainingPreview = currentAvailable - requestedQty;

  // --- Bi-directional Date Synchronization ---
  const handleDateADChange = (newAD: string) => {
    setDateAD(newAD);
    if (newAD && isValidADDate(newAD)) {
      const convertedBS = convertADtoBS(newAD);
      if (convertedBS) setDateBS(convertedBS);
    }
  };

  const handleDateBSChange = (newBS: string) => {
    setDateBS(newBS);
    if (newBS && isValidBSDate(newBS)) {
      const convertedAD = convertBStoAD(newBS);
      if (convertedAD) setDateAD(convertedAD);
    }
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

  const fetchItemsCatalog = async () => {
    setLoadingItems(true);
    try {
      const res = await api.getItems({ limit: 100, is_active: true });
      setAllItems(res.items || []);
    } catch {
      // Ignored
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await api.getStockOutHistory({ limit: 20 });
      setRecentEntries(data.items || []);
    } catch {
      // Ignored
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchItemsCatalog();
    fetchHistory();
  }, []);

  // Fetch batches when active item changes
  useEffect(() => {
    if (activeItem?.id) {
      api
        .getBatches(activeItem.id)
        .then((batches) => {
          setItemBatches(batches || []);
          if (batches && batches.length > 0) {
            setSelectedBatchNo(batches[0].batchNo);
          } else {
            setSelectedBatchNo('');
          }
        })
        .catch(() => {
          setItemBatches([]);
          setSelectedBatchNo('');
        });
    } else {
      setItemBatches([]);
      setSelectedBatchNo('');
    }
  }, [activeItem]);

  const applySelectedItem = (item: Item) => {
    setActiveItem(item);
    setInputItemCode(item.itemCode);
    setInputItemName(item.itemName);
    setScannedBarcode(item.barcode);
    setLookupError('');
    setTimeout(() => {
      quantityInputRef.current?.focus();
    }, 50);
  };

  const handleClearSelectedItem = () => {
    setActiveItem(null);
    setInputItemCode('');
    setInputItemName('');
    setScannedBarcode('');
    setLookupError('');
    setQuantity('');
    setUnitPrice('');
    setItemBatches([]);
    setSelectedBatchNo('');
  };

  // 1. Separate Item Code Lookup
  const handleItemCodeSelect = async (code: string) => {
    setInputItemCode(code);
    const trimmed = code.trim();
    if (!trimmed) {
      if (!inputItemName && !scannedBarcode) setActiveItem(null);
      return;
    }

    const matched = allItems.find((it) => it.itemCode.toLowerCase() === trimmed.toLowerCase());
    if (matched) {
      applySelectedItem(matched);
      return;
    }

    setIsSearching(true);
    setLookupError('');
    try {
      const item = await api.lookupItemCode(trimmed);
      applySelectedItem(item);
    } catch {
      setLookupError(`Item Code '${trimmed}' not found.`);
      setActiveItem(null);
    } finally {
      setIsSearching(false);
    }
  };

  // 2. Separate Item Name Lookup
  const handleItemNameSelect = async (name: string) => {
    setInputItemName(name);
    const trimmed = name.trim();
    if (!trimmed) {
      if (!inputItemCode && !scannedBarcode) setActiveItem(null);
      return;
    }

    const matched = allItems.find((it) => it.itemName.toLowerCase() === trimmed.toLowerCase());
    if (matched) {
      applySelectedItem(matched);
      return;
    }

    setIsSearching(true);
    setLookupError('');
    try {
      const res = await api.getItems({ search: trimmed, limit: 5 });
      if (res.items && res.items.length > 0) {
        const exact = res.items.find((it: Item) => it.itemName.toLowerCase() === trimmed.toLowerCase()) || res.items[0];
        applySelectedItem(exact);
      } else {
        setLookupError(`Item Name '${trimmed}' not found.`);
        setActiveItem(null);
      }
    } catch {
      setLookupError(`Error searching for '${trimmed}'.`);
      setActiveItem(null);
    } finally {
      setIsSearching(false);
    }
  };

  // 3. Separate Barcode Lookup
  const handleBarcodeLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = scannedBarcode.trim();
    if (!code) return;

    const matched = allItems.find(
      (it) => it.barcode.toLowerCase() === code.toLowerCase() || it.itemCode.toLowerCase() === code.toLowerCase()
    );
    if (matched) {
      applySelectedItem(matched);
      return;
    }

    setIsSearching(true);
    setLookupError('');
    try {
      const item = await api.lookupBarcode(code);
      applySelectedItem(item);
    } catch {
      try {
        const itemByCode = await api.lookupItemCode(code);
        applySelectedItem(itemByCode);
      } catch {
        setLookupError(`Item not found for barcode '${code}'.`);
        setActiveItem(null);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmitStockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) {
      showToast('error', 'Select Item', 'Please select or scan an item first.');
      return;
    }

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
        dateAD: dateAD || undefined,
        dateBS: dateBS || undefined,
        receiverName: receiverName.trim() || undefined,
        unitPrice: numPrice > 0 ? numPrice : 0,
        amount: calculatedAmount > 0 ? calculatedAmount : 0,
        batchNo: selectedBatchNo.trim() || undefined,
        remark: remark.trim() || undefined,
        idempotencyKey: `OUT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });

      if (result.isLowStockWarning) {
        showToast(
          'warning',
          'Low Stock Warning!',
          `Remaining balance for ${activeItem.itemName} is now ${result.balanceAfter} (At or below threshold).`
        );
      } else {
        showToast(
          'success',
          'Stock Issued Successfully!',
          `Issued ${requestedQty} ${activeItem.unitName || 'units'} to ${selectedLocation}. Balance: ${result.balanceAfter}`
        );
      }

      handleClearSelectedItem();
      setRemark('');
      fetchHistory();
      fetchItemsCatalog();

      setTimeout(() => {
        itemCodeInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      showToast('error', 'Dispatch Failed', err.message || 'Could not process dispatch.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCatalogItems = allItems.filter(
    (it) =>
      it.itemName.toLowerCase().includes(modalSearch.toLowerCase()) ||
      it.itemCode.toLowerCase().includes(modalSearch.toLowerCase()) ||
      it.barcode.toLowerCase().includes(modalSearch.toLowerCase()) ||
      (it.categoryName && it.categoryName.toLowerCase().includes(modalSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <span>Item Out (Stock Dispatch & Goods Issue)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Issue stock by Item Code, Name, or Barcode with synchronized AD/BS dates and real-time inventory checks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowItemModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-brand-400 border border-slate-700 rounded-xl text-xs font-bold transition shadow-md"
        >
          <Boxes className="w-4 h-4" />
          <span>Browse Item Catalog</span>
        </button>
      </div>

      {/* Main Issue Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* HEADER SECTION: Dates (Connected AD & BS), Destination, Receiver */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pb-4 border-b border-slate-800/80">
          {/* Date AD */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-400" />
              <span>Date (AD - English) *</span>
            </label>
            <input
              type="date"
              required
              value={dateAD}
              onChange={(e) => handleDateADChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-brand-500 transition"
            />
            <span className="text-[10px] text-slate-500">{formatADDisplay(dateAD) || 'System Date'}</span>
          </div>

          {/* Date BS (Connected) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Date (BS - नेपाली मिति) *</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 2083-06-19"
              value={dateBS}
              onChange={(e) => handleDateBSChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-amber-600/60 rounded-xl text-amber-300 text-xs font-mono font-bold focus:outline-none focus:border-amber-400 transition"
            />
            <span className="text-[10px] text-amber-400 font-medium block truncate">
              {formatBSDisplay(dateBS) || 'Nepali BS Date'}
            </span>
          </div>

          {/* Destination Location */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>Issued To (Location) *</span>
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-brand-500 transition"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Receiver / Department */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>Receiver / Department</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Counter Staff, Ram K."
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500 transition"
            />
          </div>
        </div>

        {/* SEPARATE ITEM INPUTS: Code Xuttai, Name Xuttai, Barcode Xuttai */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <Boxes className="w-4 h-4 text-brand-400" />
              <span>Select Item to Issue (Code, Name वा Barcode बाट खोज्नुहोस्)</span>
            </span>
            {activeItem && (
              <button
                type="button"
                onClick={handleClearSelectedItem}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1 font-semibold"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear / Select Another Item</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Item Code Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Item Code (संकेत कोड)
              </label>
              <input
                ref={itemCodeInputRef}
                type="text"
                list="out-item-code-list"
                placeholder="e.g. ITM-0001, ELEC-001..."
                value={inputItemCode}
                onChange={(e) => handleItemCodeSelect(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-brand-500/50 rounded-xl text-white text-sm font-mono font-bold focus:outline-none focus:border-brand-400"
              />
              <datalist id="out-item-code-list">
                {allItems.map((item) => (
                  <option key={`out-code-${item.id}`} value={item.itemCode}>
                    {item.itemCode} — {item.itemName} (Stock: {item.quantity})
                  </option>
                ))}
              </datalist>
            </div>

            {/* 2. Item Name Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Item Name (सामानको नाम)
              </label>
              <input
                type="text"
                list="out-item-name-list"
                placeholder="e.g. Wireless Mouse, Sugar..."
                value={inputItemName}
                onChange={(e) => handleItemNameSelect(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-brand-500/50 rounded-xl text-white text-sm font-semibold focus:outline-none focus:border-brand-400"
              />
              <datalist id="out-item-name-list">
                {allItems.map((item) => (
                  <option key={`out-name-${item.id}`} value={item.itemName}>
                    {item.itemName} ({item.itemCode}) — Stock: {item.quantity}
                  </option>
                ))}
              </datalist>
            </div>

            {/* 3. Barcode Scanner Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Barcode (बारकोड स्क्यानर)
              </label>
              <form onSubmit={handleBarcodeLookup} className="flex gap-1.5">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan with reader..."
                    value={scannedBarcode}
                    onChange={(e) => setScannedBarcode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !scannedBarcode.trim()}
                  className="px-3.5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {lookupError && (
          <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-200 text-xs font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{lookupError}</span>
          </div>
        )}

        {/* Active Item Card */}
        {activeItem && (
          <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-brand-500/30 rounded-2xl shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-brand-400 bg-brand-950/80 px-2 py-0.5 rounded-md border border-brand-800/50">
                    {activeItem.itemCode}
                  </span>
                  <h3 className="text-base font-extrabold text-white">{activeItem.itemName}</h3>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Barcode: <span className="font-mono text-slate-300 font-semibold">{activeItem.barcode}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Available Stock</div>
                <div className="text-xl font-black text-emerald-400">
                  {Number(activeItem.quantity).toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-400">{activeItem.unitName || 'units'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-400 pt-0.5">
              <div>
                Category: <span className="text-slate-200 font-semibold">{activeItem.categoryName || '—'}</span>
              </div>
              <div>
                Unit: <span className="text-slate-200 font-semibold">{activeItem.unitName || 'pcs'}</span>
              </div>
              <div>
                Min Alert Level: <span className="text-slate-200 font-mono">{activeItem.minStockLevel}</span>
              </div>
              <div>
                Active Batches: <span className="text-amber-400 font-bold">{itemBatches.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* LINE ITEM QUANTITY, BATCH & AMOUNT */}
        <form onSubmit={handleSubmitStockOut} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Quantity */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Issue Quantity *
              </label>
              <input
                ref={quantityInputRef}
                type="number"
                required
                min="0.01"
                step="any"
                disabled={!activeItem}
                placeholder={activeItem ? `Qty in ${activeItem.unitName || 'units'}...` : 'Select item first'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-full px-4 py-2.5 bg-slate-900 border rounded-xl text-white text-base font-bold focus:outline-none transition disabled:opacity-40 ${
                  isInsufficient
                    ? 'border-rose-500 focus:border-rose-400 ring-1 ring-rose-500/30'
                    : 'border-slate-700 focus:border-brand-500'
                }`}
              />
              {isInsufficient && (
                <span className="text-[11px] text-rose-400 font-bold block mt-1">
                  Exceeds warehouse stock ({currentAvailable})!
                </span>
              )}
            </div>

            {/* Batch Selector (if batches exist) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Select Batch (Optional)</span>
              </label>
              {itemBatches.length > 0 ? (
                <select
                  value={selectedBatchNo}
                  onChange={(e) => setSelectedBatchNo(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-amber-600/50 rounded-xl text-amber-300 text-xs font-mono font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value="">General (No Batch Assigned)</option>
                  {itemBatches.map((b) => (
                    <option key={`batch-${b.id}`} value={b.batchNo}>
                      {b.batchNo} (Qty: {b.quantity}{b.expiryDate ? ` | Exp: ${b.expiryDate}` : ''})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. BATCH-01"
                  value={selectedBatchNo}
                  onChange={(e) => setSelectedBatchNo(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-brand-500"
                />
              )}
            </div>

            {/* Rate / Unit Price */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Issue Rate (NPR)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                disabled={!activeItem}
                placeholder="Rate per unit..."
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base font-bold focus:outline-none focus:border-brand-500 disabled:opacity-40"
              />
            </div>

            {/* Total Amount */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Total Valuation (Qty × Rate)
              </label>
              <div className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-rose-400 font-black text-base flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">NPR</span>
                <span>
                  {calculatedAmount > 0
                    ? calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                    : '0.00'}
                </span>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Issue Voucher Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Requisition #305, issued for retail counter display..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Stock Balance Preview Banner */}
          {activeItem && requestedQty > 0 && !isInsufficient && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl flex items-center justify-between text-xs">
              <span className="text-emerald-300">
                Current: <strong>{currentAvailable}</strong> → Remaining After Issue:{' '}
                <strong>{remainingPreview}</strong> {activeItem.unitName}
              </span>
              {remainingPreview <= Number(activeItem.minStockLevel) && (
                <span className="text-amber-400 font-bold">⚠️ Warning: Will trigger low stock alert!</span>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={handleClearSelectedItem}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={isSaving || !activeItem || requestedQty <= 0 || isInsufficient}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-sm font-extrabold rounded-xl shadow-lg shadow-rose-600/30 flex items-center space-x-2 transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Issuing Stock...' : 'Issue Stock (निकासी गर्नुहोस्)'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* RECENT OUTWARD TRANSACTIONS */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-rose-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Stock Out Entries</h2>
          </div>
          <span className="text-xs text-slate-400">Total Recorded: {recentEntries.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Voucher Date</th>
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3 text-right">Qty Issued</th>
                <th className="px-4 py-3 text-right">Remaining Balance</th>
                <th className="px-4 py-3">Batch No</th>
                <th className="px-4 py-3">Issued To</th>
                <th className="px-4 py-3">Receiver</th>
                <th className="px-4 py-3">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loadingHistory ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Loading recent outward entries...
                  </td>
                </tr>
              ) : recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No outward dispatches recorded yet.
                  </td>
                </tr>
              ) : (
                recentEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-900/40 transition">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-white">{entry.dateAD || '—'}</div>
                      <div className="text-[10px] text-amber-400 font-mono">{entry.dateBS || '—'}</div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-brand-400 whitespace-nowrap">
                      {entry.itemCode}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{entry.itemName}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-rose-400 whitespace-nowrap">
                      -{Number(entry.quantity).toLocaleString()}{' '}
                      <span className="text-[10px] font-normal text-slate-400">{entry.unitName || 'pcs'}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white whitespace-nowrap">
                      {Number(entry.balanceAfter).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {entry.batchNo ? (
                        <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                          {entry.batchNo}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-700">
                        {entry.location}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{entry.receiverName || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{entry.createdByUsername || 'admin'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CATALOG BROWSE MODAL */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Boxes className="w-5 h-5 text-brand-400" />
                <h3 className="text-base font-bold text-white">Select Item to Issue (वस्तु चयन)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search items by code, name, category, or barcode..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-800/60 p-2">
              {loadingItems ? (
                <div className="p-8 text-center text-slate-500 text-sm">Loading catalog items...</div>
              ) : filteredCatalogItems.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No matching items found.</div>
              ) : (
                filteredCatalogItems.map((item) => (
                  <div
                    key={`out-modal-${item.id}`}
                    onClick={() => {
                      applySelectedItem(item);
                      setShowItemModal(false);
                    }}
                    className="p-3 hover:bg-slate-900/80 rounded-xl cursor-pointer flex items-center justify-between transition group"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-brand-400 bg-brand-950/80 px-2 py-0.5 rounded border border-brand-800/40">
                          {item.itemCode}
                        </span>
                        <span className="font-semibold text-white group-hover:text-brand-300 transition">
                          {item.itemName}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center space-x-3">
                        <span>Barcode: {item.barcode}</span>
                        <span>Category: {item.categoryName || 'General'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">
                        {Number(item.quantity).toLocaleString()}{' '}
                        <span className="text-xs text-slate-400 font-normal">{item.unitName}</span>
                      </div>
                      <span className="text-[11px] text-brand-400 group-hover:underline">Click to Select</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
