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
  Boxes,
  X,
  Sparkles,
  Layers,
  Trash2,
  Plus,
} from 'lucide-react';
import { api } from '../services/api';
import type { Item, Location, StockInResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useNavigate } from 'react-router-dom';
import {
  getTodayAD,
  convertADtoBS,
  convertBStoAD,
  formatBSDisplay,
  formatADDisplay,
  isValidBSDate,
  isValidADDate,
} from '../services/nepaliDate';

export const ItemIn: React.FC = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Header / Inward Voucher Fields (Bi-directionally connected AD <-> BS)
  const [dateAD, setDateAD] = useState<string>(getTodayAD());
  const [dateBS, setDateBS] = useState<string>(convertADtoBS(getTodayAD()));
  const [supplierName, setSupplierName] = useState('');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('Godown');
  const [locations, setLocations] = useState<Location[]>([]);

  // Item List Catalog (For dropdown autocomplete by Code & Name)
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Item Separate Inputs: Code, Name, Barcode
  const [inputItemCode, setInputItemCode] = useState('');
  const [inputItemName, setInputItemName] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  // Line Item Details
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [remark, setRemark] = useState('');

  // Batch & Expiry (Bi-directionally connected AD <-> BS)
  const [batchNo, setBatchNo] = useState('');
  const [mfgDateAD, setMfgDateAD] = useState('');
  const [mfgDateBS, setMfgDateBS] = useState('');
  const [expiryDateAD, setExpiryDateAD] = useState('');
  const [expiryDateBS, setExpiryDateBS] = useState('');
  const [showBatchFields, setShowBatchFields] = useState(false);
  const [itemBatches, setItemBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatchMode, setSelectedBatchMode] = useState<'existing' | 'new'>('new');
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // Multi-Batch mode state ("batch anusar farak farak qty aayeu vane")
  const [isMultiBatchMode, setIsMultiBatchMode] = useState(false);
  const [multiBatches, setMultiBatches] = useState<Array<{
    id: string;
    batchNo: string;
    quantity: string;
    mfgDateAD: string;
    mfgDateBS: string;
    expiryDateAD: string;
    expiryDateBS: string;
    existingBatchId: number | null;
  }>>([
    {
      id: 'batch-1',
      batchNo: '',
      quantity: '',
      mfgDateAD: '',
      mfgDateBS: '',
      expiryDateAD: '',
      expiryDateBS: '',
      existingBatchId: null,
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // History / Recent Transactions
  const [recentEntries, setRecentEntries] = useState<StockInResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Focus Refs
  const itemCodeInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Calculate live amount
  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(unitPrice) || 0;
  const calculatedAmount = numQty * numPrice;

  // --- Bi-directional Date Synchronization ---
  // Voucher Date
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

  // MFG Date
  const handleMfgADChange = (newAD: string) => {
    setMfgDateAD(newAD);
    if (newAD && isValidADDate(newAD)) {
      const convertedBS = convertADtoBS(newAD);
      if (convertedBS) setMfgDateBS(convertedBS);
    }
  };

  const handleMfgBSChange = (newBS: string) => {
    setMfgDateBS(newBS);
    if (newBS && isValidBSDate(newBS)) {
      const convertedAD = convertBStoAD(newBS);
      if (convertedAD) setMfgDateAD(convertedAD);
    }
  };

  // Expiry Date
  const handleExpiryADChange = (newAD: string) => {
    setExpiryDateAD(newAD);
    if (newAD && isValidADDate(newAD)) {
      const convertedBS = convertADtoBS(newAD);
      if (convertedBS) setExpiryDateBS(convertedBS);
    }
  };

  const handleExpiryBSChange = (newBS: string) => {
    setExpiryDateBS(newBS);
    if (newBS && isValidBSDate(newBS)) {
      const convertedAD = convertBStoAD(newBS);
      if (convertedAD) setExpiryDateAD(convertedAD);
    }
  };

  // --- Fetch Master Data ---
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
      const data = await api.getStockInHistory({ limit: 20 });
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

  // --- Synchronize Active Item with Separate Inputs ---
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
    setItemBatches([]);
    setSelectedBatchMode('new');
    setSelectedBatchId(null);
    setBatchNo('');
    setMfgDateAD('');
    setMfgDateBS('');
    setExpiryDateAD('');
    setExpiryDateBS('');
    setIsMultiBatchMode(false);
    setMultiBatches([
      {
        id: 'batch-1',
        batchNo: '',
        quantity: '',
        mfgDateAD: '',
        mfgDateBS: '',
        expiryDateAD: '',
        expiryDateBS: '',
        existingBatchId: null,
      },
    ]);
  };

  // Fetch existing batches for the selected item to enable batch top-up
  useEffect(() => {
    if (activeItem?.id) {
      setLoadingBatches(true);
      api
        .getBatches(activeItem.id)
        .then((batches) => {
          setItemBatches(batches || []);
        })
        .catch(() => {
          setItemBatches([]);
        })
        .finally(() => setLoadingBatches(false));
    } else {
      setItemBatches([]);
      setSelectedBatchMode('new');
      setSelectedBatchId(null);
      setBatchNo('');
    }
  }, [activeItem]);

  const selectExistingBatch = (b: any) => {
    setSelectedBatchMode('existing');
    setSelectedBatchId(b.id);
    setBatchNo(b.batchNo);
    if (b.mfgDate) {
      setMfgDateAD(b.mfgDate);
      const bs = convertADtoBS(b.mfgDate);
      if (bs) setMfgDateBS(bs);
    } else {
      setMfgDateAD('');
      setMfgDateBS('');
    }
    if (b.expiryDate) {
      setExpiryDateAD(b.expiryDate);
      const bs = convertADtoBS(b.expiryDate);
      if (bs) setExpiryDateBS(bs);
    } else {
      setExpiryDateAD('');
      setExpiryDateBS('');
    }
  };

  const switchToNewBatch = () => {
    setSelectedBatchMode('new');
    setSelectedBatchId(null);
    setBatchNo('');
    setMfgDateAD('');
    setMfgDateBS('');
    setExpiryDateAD('');
    setExpiryDateBS('');
  };

  const handleSingleBatchDropdownChange = (val: string) => {
    if (val === 'new') {
      switchToNewBatch();
    } else {
      const found = itemBatches.find((b) => String(b.id) === val);
      if (found) {
        selectExistingBatch(found);
      }
    }
  };

  // Multi-Batch Handlers ("batch anusar farak farak qty aayeu vane tesma qty tapne option")
  const handleAddMultiBatchRow = () => {
    setMultiBatches((prev) => [
      ...prev,
      {
        id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        batchNo: '',
        quantity: '',
        mfgDateAD: '',
        mfgDateBS: '',
        expiryDateAD: '',
        expiryDateBS: '',
        existingBatchId: null,
      },
    ]);
  };

  const handleRemoveMultiBatchRow = (id: string) => {
    if (multiBatches.length <= 1) return;
    const updated = multiBatches.filter((b) => b.id !== id);
    setMultiBatches(updated);
    const total = updated.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0);
    setQuantity(total > 0 ? String(total) : '');
  };

  const handleUpdateMultiBatchRow = (id: string, field: string, value: any) => {
    setMultiBatches((prev) => {
      const updated = prev.map((row) => {
        if (row.id !== id) return row;
        const newRow: any = { ...row, [field]: value };
        if (field === 'mfgDateAD' && value && isValidADDate(value)) {
          const bs = convertADtoBS(value);
          if (bs) newRow.mfgDateBS = bs;
        } else if (field === 'mfgDateBS' && value && isValidBSDate(value)) {
          const ad = convertBStoAD(value);
          if (ad) newRow.mfgDateAD = ad;
        } else if (field === 'expiryDateAD' && value && isValidADDate(value)) {
          const bs = convertADtoBS(value);
          if (bs) newRow.expiryDateBS = bs;
        } else if (field === 'expiryDateBS' && value && isValidBSDate(value)) {
          const ad = convertBStoAD(value);
          if (ad) newRow.expiryDateAD = ad;
        }
        return newRow;
      });
      if (field === 'quantity') {
        const total = updated.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0);
        setQuantity(total > 0 ? String(total) : '');
      }
      return updated;
    });
  };

  const handleSelectMultiBatchExisting = (id: string, batchIdVal: string) => {
    if (batchIdVal === 'new') {
      handleUpdateMultiBatchRow(id, 'existingBatchId', null);
      handleUpdateMultiBatchRow(id, 'batchNo', '');
      return;
    }
    const found = itemBatches.find((b) => String(b.id) === batchIdVal);
    if (found) {
      setMultiBatches((prev) =>
        prev.map((row) => {
          if (row.id !== id) return row;
          return {
            ...row,
            existingBatchId: found.id,
            batchNo: found.batchNo,
            mfgDateAD: found.mfgDate || '',
            mfgDateBS: found.mfgDate ? (convertADtoBS(found.mfgDate) || '') : '',
            expiryDateAD: found.expiryDate || '',
            expiryDateBS: found.expiryDate ? (convertADtoBS(found.expiryDate) || '') : '',
          };
        })
      );
    }
  };

  // 1. Separate Item Code Lookup / Selection
  const handleItemCodeSelect = async (code: string) => {
    setInputItemCode(code);
    const trimmed = code.trim();
    if (!trimmed) {
      if (!inputItemName && !scannedBarcode) setActiveItem(null);
      return;
    }

    // Match in cached items first
    const matched = allItems.find((it) => it.itemCode.toLowerCase() === trimmed.toLowerCase());
    if (matched) {
      applySelectedItem(matched);
      return;
    }

    // Otherwise lookup from backend
    setIsSearching(true);
    setLookupError('');
    try {
      const item = await api.lookupItemCode(trimmed);
      applySelectedItem(item);
    } catch {
      setLookupError(`Item Code '${trimmed}' not found in system.`);
      setActiveItem(null);
    } finally {
      setIsSearching(false);
    }
  };

  // 2. Separate Item Name Lookup / Selection
  const handleItemNameSelect = async (name: string) => {
    setInputItemName(name);
    const trimmed = name.trim();
    if (!trimmed) {
      if (!inputItemCode && !scannedBarcode) setActiveItem(null);
      return;
    }

    // Exact or prefix match in cached catalog
    const matched = allItems.find((it) => it.itemName.toLowerCase() === trimmed.toLowerCase());
    if (matched) {
      applySelectedItem(matched);
      return;
    }

    // Otherwise search via API
    setIsSearching(true);
    setLookupError('');
    try {
      const res = await api.getItems({ search: trimmed, limit: 5 });
      if (res.items && res.items.length > 0) {
        // Pick exact match or first result
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

    // Check in cached items first
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
      // Try code lookup fallback in case user scanned/typed item code into barcode scanner
      try {
        const itemByCode = await api.lookupItemCode(code);
        applySelectedItem(itemByCode);
      } catch {
        setLookupError(`Item not found for '${code}'. Please register in Item Master.`);
        setActiveItem(null);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-generate batch number
  const handleGenerateBatchNo = () => {
    const codePrefix = activeItem?.itemCode ? activeItem.itemCode.replace(/[^a-zA-Z0-9]/g, '') : 'BAT';
    const dateStamp = dateAD ? dateAD.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setBatchNo(`${codePrefix}-${dateStamp}-${randomSuffix}`);
  };

  // --- Submit Stock In ---
  const handleSubmitStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) {
      showToast('error', 'Select Item', 'Please select or scan an item first using Code, Name, or Barcode.');
      return;
    }

    if (isMultiBatchMode) {
      const validRows = multiBatches.filter((b) => parseFloat(b.quantity) > 0);
      if (validRows.length === 0) {
        showToast('error', 'Invalid Quantities', 'Please enter receiving quantities for at least one batch row.');
        return;
      }

      setIsSaving(true);
      try {
        let lastResult: any = null;
        let count = 0;
        const totalBatchQty = validRows.reduce((sum, r) => sum + parseFloat(r.quantity), 0);

        for (const row of validRows) {
          const rowQty = parseFloat(row.quantity);
          let rowBatchNo = row.batchNo.trim();
          if (!rowBatchNo && (row.mfgDateAD || row.expiryDateAD)) {
            rowBatchNo = `BAT-${activeItem.itemCode.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;
          }

          const rowAmount = numPrice > 0 ? rowQty * numPrice : 0;
          lastResult = await api.stockIn({
            itemId: activeItem.id,
            quantity: rowQty,
            dateAD: dateAD || undefined,
            dateBS: dateBS || undefined,
            supplierName: supplierName.trim() || undefined,
            receivedFrom: receivedFrom.trim() || undefined,
            location: selectedLocation || undefined,
            unitPrice: numPrice > 0 ? numPrice : 0,
            amount: rowAmount > 0 ? rowAmount : 0,
            batchNo: rowBatchNo || undefined,
            mfgDate: row.mfgDateAD || undefined,
            expiryDate: row.expiryDateAD || undefined,
            remark: remark.trim() || undefined,
            idempotencyKey: `IN_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          });
          count++;
        }

        showToast(
          'success',
          'Stock Received Successfully!',
          `Recorded ${count} batches (${totalBatchQty} ${activeItem.unitName || 'units'}). Balance: ${lastResult?.balanceAfter || ''}`
        );

        handleClearSelectedItem();
        setRemark('');
        fetchHistory();
        fetchItemsCatalog();

        setTimeout(() => {
          itemCodeInputRef.current?.focus();
        }, 50);
      } catch (err: any) {
        showToast('error', 'Stock In Failed', err.message || 'Could not process multi-batch inward.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (numQty <= 0) {
      showToast('error', 'Invalid Quantity', 'Please enter a receiving quantity greater than zero.');
      return;
    }

    // Auto-resolve batch number if user filled dates but left batchNo blank
    let finalBatchNo = batchNo.trim();
    if (showBatchFields && (mfgDateAD || expiryDateAD) && !finalBatchNo) {
      finalBatchNo = `BAT-${activeItem.itemCode.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;
      setBatchNo(finalBatchNo);
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
        batchNo: finalBatchNo || undefined,
        mfgDate: mfgDateAD || undefined,
        expiryDate: expiryDateAD || undefined,
        remark: remark.trim() || undefined,
        idempotencyKey: `IN_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });

      showToast(
        'success',
        'Stock Received Successfully!',
        `Added ${numQty} ${activeItem.unitName || 'units'} of ${activeItem.itemName}. Balance: ${result.balanceAfter}`
      );

      // Fast Reset for rapid successive inward workflow
      handleClearSelectedItem();
      setBatchNo('');
      setMfgDateAD('');
      setMfgDateBS('');
      setExpiryDateAD('');
      setExpiryDateBS('');
      setRemark('');
      fetchHistory();
      fetchItemsCatalog();

      setTimeout(() => {
        itemCodeInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      showToast('error', 'Stock In Failed', err.message || 'Could not process transaction.');
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
            <span>Item In (Stock Receiving & Goods Inward)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Separate Item Code & Name selection, synchronized English (AD) & Nepali (BS) dates, batch and warehouse ledger.
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

      {/* Main Receiving Form Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* HEADER SECTION: Dates (AD & BS Two-Way Connected), Supplier, Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pb-4 border-b border-slate-800/80">
          {/* Date AD (English Date) */}
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

          {/* Date BS (Nepali Bikram Sambat Date - Connected) */}
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

          {/* Supplier Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supplier / Vendor</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Acme Factory Ltd."
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          {/* Received From */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Received By / Carrier</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Delivery Driver / Staff"
              value={receivedFrom}
              onChange={(e) => setReceivedFrom(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          {/* Storage Location */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>Warehouse Location *</span>
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
        </div>

        {/* Empty Catalog Alert Banner */}
        {!loadingItems && allItems.length === 0 && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <span>
                इन्भेन्टरीमा कुनै सामान दर्ता छैन (No items uploaded yet). स्टक इन्ट्री गर्न पहिला Item Master मा Excel वा CSV फाइल अपलोड गर्नुहोस्।
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/items')}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold text-xs shadow transition whitespace-nowrap"
            >
              Go to Item Master / Upload
            </button>
          </div>
        )}

        {/* ITEM SELECTION SECTION: Code Xuttai, Name Xuttai, Barcode Xuttai */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <Boxes className="w-4 h-4 text-brand-400" />
              <span>Select Item (Code, Name वा Barcode बाट खोज्नुहोस्)</span>
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
            {/* 1. Item Code Input (Separate with Autocomplete Datalist) */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Item Code (संकेत कोड)
              </label>
              <div className="relative">
                <input
                  ref={itemCodeInputRef}
                  type="text"
                  list="item-code-list"
                  placeholder="e.g. ITM-0001, ELEC-001..."
                  value={inputItemCode}
                  onChange={(e) => handleItemCodeSelect(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-brand-500/50 rounded-xl text-white text-sm font-mono font-bold focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/30"
                />
                <datalist id="item-code-list">
                  {allItems.map((item) => (
                    <option key={`code-${item.id}`} value={item.itemCode}>
                      {item.itemCode} — {item.itemName}
                    </option>
                  ))}
                </datalist>
              </div>
              <span className="text-[10px] text-slate-500">Type or select code from list</span>
            </div>

            {/* 2. Item Name Input (Separate with Autocomplete Datalist) */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Item Name (सामानको नाम)
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="item-name-list"
                  placeholder="e.g. Wireless Mouse, Tea 500g..."
                  value={inputItemName}
                  onChange={(e) => handleItemNameSelect(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-brand-500/50 rounded-xl text-white text-sm font-semibold focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/30"
                />
                <datalist id="item-name-list">
                  {allItems.map((item) => (
                    <option key={`name-${item.id}`} value={item.itemName}>
                      {item.itemName} ({item.itemCode})
                    </option>
                  ))}
                </datalist>
              </div>
              <span className="text-[10px] text-slate-500">Type or select product name</span>
            </div>

            {/* 3. Barcode Scanner Input (Separate) */}
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
              <span className="text-[10px] text-slate-500">USB reader or manual barcode</span>
            </div>
          </div>
        </div>

        {/* Lookup Error Banner */}
        {lookupError && (
          <div className="p-3.5 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
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

        {/* Active Selected Item Card */}
        {activeItem && (
          <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/50">
                    {activeItem.itemCode}
                  </span>
                  <h3 className="text-base font-extrabold text-white">{activeItem.itemName}</h3>
                </div>
                <div className="text-xs text-slate-400">
                  Barcode: <span className="font-mono text-slate-300 font-semibold">{activeItem.barcode}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Current Balance</div>
                <div className="text-xl font-black text-white">
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
                Decimals:{' '}
                <span className="text-slate-200 font-semibold">
                  {activeItem.allowDecimals ? 'Allowed (0.01)' : 'Integer only'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* LINE ITEM QUANTITY, RATE & AMOUNT */}
        <form onSubmit={handleSubmitStockIn} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Receiving Qty */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Receiving Qty *
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
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-base font-bold focus:outline-none focus:border-emerald-500 disabled:opacity-40"
              />
            </div>

            {/* Unit */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Total Amount (Qty × Rate)
              </label>
              <div className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-emerald-400 font-black text-base flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">NPR</span>
                <span>
                  {calculatedAmount > 0
                    ? calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                    : '0.00'}
                </span>
              </div>
            </div>
          </div>

          {/* BATCH & EXPIRY TRACKING SECTION */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowBatchFields(!showBatchFields)}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center space-x-1.5 font-bold"
              >
                <Tag className="w-4 h-4 text-amber-400" />
                <span>
                  {showBatchFields
                    ? '− Hide Batch & Expiry Tracking'
                    : '+ Add Batch No / MFG Date / Expiry Date (Optional)'}
                </span>
                {itemBatches.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-400">
                    {itemBatches.length} Existing Batch(es)
                  </span>
                )}
              </button>

              {showBatchFields && (
                <div className="flex items-center space-x-2">
                  {/* Mode Toggle: Single Batch vs Multi Batch */}
                  <div className="inline-flex rounded-xl bg-slate-950 p-0.5 border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsMultiBatchMode(false)}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        !isMultiBatchMode
                          ? 'bg-brand-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Single Batch (एउटै ब्याच)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMultiBatchMode(true);
                        // If current quantity is filled, prepopulate first row
                        if (quantity && multiBatches.length === 1 && !multiBatches[0].quantity) {
                          handleUpdateMultiBatchRow(multiBatches[0].id, 'quantity', quantity);
                          if (batchNo) handleUpdateMultiBatchRow(multiBatches[0].id, 'batchNo', batchNo);
                        }
                      }}
                      className={`px-3 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                        isMultiBatchMode
                          ? 'bg-amber-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="फरक-फरक ब्याच अनुसार मात्रा थप्ने"
                    >
                      <Layers className="w-3.5 h-3.5 mr-1" />
                      <span>फरक-फरक ब्याच (Multi-Batch)</span>
                    </button>
                  </div>

                  {!isMultiBatchMode && selectedBatchMode === 'new' && (
                    <button
                      type="button"
                      onClick={handleGenerateBatchNo}
                      className="inline-flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 font-semibold"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto Batch No</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* EXPANDED BATCH CONTROLS */}
            {showBatchFields && (
              <>
                {/* 1. SINGLE BATCH MODE (Default & Same as Before + Existing Batch Top-Up Option) */}
                {!isMultiBatchMode ? (
                  <div className="space-y-4 pt-1">
                    {/* Existing Batch Selector: choose which batch qty is coming for */}
                    {activeItem && itemBatches.length > 0 && (
                      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          कुन ब्याचमा थप्ने? (Top-Up Existing Batch or Create New) {loadingBatches && <span className="text-[10px] text-slate-400 font-normal animate-pulse">(लोड हुँदैछ...)</span>}
                        </label>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <select
                            value={selectedBatchMode === 'existing' && selectedBatchId ? String(selectedBatchId) : 'new'}
                            onChange={(e) => handleSingleBatchDropdownChange(e.target.value)}
                            className="w-full sm:w-auto flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-brand-500"
                          >
                            <option value="new">+ नयाँ ब्याच सिर्जना गर्ने (+ Create New Batch)</option>
                            {itemBatches.map((b) => (
                              <option key={b.id} value={b.id}>
                                पुरानो ब्याच: {b.batchNo} (मौज्दात: {b.quantity} {activeItem?.unitName || 'units'}) {b.expiryDate ? `| म्याद: ${b.expiryDate}` : ''}
                              </option>
                            ))}
                          </select>
                          {selectedBatchMode === 'existing' && selectedBatchId && (
                            <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-800/60">
                              ब्याच <strong className="text-amber-300 font-mono">{batchNo}</strong> मा थपिँदैछ | हालको मौज्दात:{' '}
                              <strong className="text-white font-mono">{itemBatches.find(b => b.id === selectedBatchId)?.quantity || 0}</strong> + नयाँ:{' '}
                              <strong className="text-white font-mono">{numQty}</strong> = नयाँ मौज्दात:{' '}
                              <strong className="text-white font-mono underline">
                                {(Number(itemBatches.find(b => b.id === selectedBatchId)?.quantity || 0) + numQty).toFixed(2)}
                              </strong>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Standard 3 Columns Input (Same as Before) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                      {/* Batch Number */}
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Batch Number (ब्याच नम्बर)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. BATCH-2026-A1"
                          value={batchNo}
                          onChange={(e) => {
                            setBatchNo(e.target.value);
                            setSelectedBatchMode('new');
                            setSelectedBatchId(null);
                          }}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-brand-500"
                        />
                        <span className="text-[10px] text-slate-500 block mt-1">
                          {selectedBatchMode === 'existing'
                            ? 'पुरानो ब्याच छानिएको छ (Top-up mode)'
                            : 'वैकल्पिक: खाली छोडे स्वतः सिर्जना हुन्छ'}
                        </span>
                      </div>

                      {/* Manufacturing Date (Connected AD & BS) */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Manufacturing Date (MFG - उत्पादन मिति)
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <input
                              type="date"
                              value={mfgDateAD}
                              onChange={(e) => handleMfgADChange(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                            />
                            <span className="text-[9px] text-slate-500 block">AD (English)</span>
                          </div>
                          <div>
                            <input
                              type="text"
                              placeholder="2083-01-01"
                              value={mfgDateBS}
                              onChange={(e) => handleMfgBSChange(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-amber-700/60 rounded-xl text-amber-300 text-xs font-mono focus:outline-none focus:border-amber-500"
                            />
                            <span className="text-[9px] text-amber-400/80 block">BS (नेपाली)</span>
                          </div>
                        </div>
                      </div>

                      {/* Expiry Date (Connected AD & BS) */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Expiry Date (समाप्ति मिति)
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <input
                              type="date"
                              value={expiryDateAD}
                              onChange={(e) => handleExpiryADChange(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                            />
                            <span className="text-[9px] text-slate-500 block">AD (English)</span>
                          </div>
                          <div>
                            <input
                              type="text"
                              placeholder="2084-01-01"
                              value={expiryDateBS}
                              onChange={(e) => handleExpiryBSChange(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-amber-700/60 rounded-xl text-amber-300 text-xs font-mono focus:outline-none focus:border-amber-500"
                            />
                            <span className="text-[9px] text-amber-400/80 block">BS (नेपाली)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 2. MULTI-BATCH MODE ("batch anusar farak farak qty aayeu vane tesma qty tapne option") */
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-300">
                        फरक-फरक ब्याच अनुसार मात्रा प्रविष्टि गर्नुहोस् (Enter batch number, quantity and dates per batch):
                      </p>
                      <button
                        type="button"
                        onClick={handleAddMultiBatchRow}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-brand-600/30 hover:bg-brand-600/50 text-brand-300 border border-brand-500/40 rounded-xl text-xs font-bold transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>अर्को ब्याच थप्नुहोस् (+ Add Batch)</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {multiBatches.map((row, idx) => (
                        <div key={row.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-400 font-mono">
                              ब्याच #{idx + 1}
                            </span>
                            {multiBatches.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMultiBatchRow(row.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Batch Selector / Input */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                ब्याच नम्बर (Batch No) *
                              </label>
                              {itemBatches.length > 0 && (
                                <select
                                  value={row.existingBatchId ? String(row.existingBatchId) : 'new'}
                                  onChange={(e) => handleSelectMultiBatchExisting(row.id, e.target.value)}
                                  className="w-full mb-1.5 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-semibold focus:outline-none focus:border-brand-500"
                                >
                                  <option value="new">+ नयाँ ब्याच (New Batch)</option>
                                  {itemBatches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      पुरानो ब्याच: {b.batchNo} (Stock: {b.quantity} {activeItem?.unitName || 'units'})
                                    </option>
                                  ))}
                                </select>
                              )}
                              <input
                                type="text"
                                placeholder="e.g. BATCH-A1"
                                value={row.batchNo}
                                onChange={(e) => handleUpdateMultiBatchRow(row.id, 'batchNo', e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono font-bold focus:outline-none focus:border-brand-500"
                              />
                            </div>

                            {/* Batch Quantity */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                ब्याच मात्रा (Quantity) *
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                required
                                placeholder={`Qty in ${activeItem?.unitName || 'units'}`}
                                value={row.quantity}
                                onChange={(e) => handleUpdateMultiBatchRow(row.id, 'quantity', e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-900 border border-emerald-600/60 rounded-lg text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                              />
                              {row.existingBatchId && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Current Stock: {itemBatches.find(b => b.id === row.existingBatchId)?.quantity || 0}
                                </span>
                              )}
                            </div>

                            {/* MFG Date */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                MFG (उत्पादन मिति)
                              </label>
                              <div className="grid grid-cols-2 gap-1">
                                <input
                                  type="date"
                                  value={row.mfgDateAD}
                                  onChange={(e) => handleUpdateMultiBatchRow(row.id, 'mfgDateAD', e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-[11px] focus:outline-none focus:border-brand-500"
                                />
                                <input
                                  type="text"
                                  placeholder="2083-01-01"
                                  value={row.mfgDateBS}
                                  onChange={(e) => handleUpdateMultiBatchRow(row.id, 'mfgDateBS', e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-amber-700/60 rounded-lg text-amber-300 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                                <span>AD</span>
                                <span>BS</span>
                              </div>
                            </div>

                            {/* Expiry Date */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Expiry (समाप्ति मिति)
                              </label>
                              <div className="grid grid-cols-2 gap-1">
                                <input
                                  type="date"
                                  value={row.expiryDateAD}
                                  onChange={(e) => handleUpdateMultiBatchRow(row.id, 'expiryDateAD', e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-[11px] focus:outline-none focus:border-brand-500"
                                />
                                <input
                                  type="text"
                                  placeholder="2084-01-01"
                                  value={row.expiryDateBS}
                                  onChange={(e) => handleUpdateMultiBatchRow(row.id, 'expiryDateBS', e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-amber-700/60 rounded-lg text-amber-300 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                                <span>AD</span>
                                <span>BS</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        जम्मा ब्याचहरू (Total Batches): <strong className="text-white font-mono">{multiBatches.length}</strong>
                      </span>
                      <span className="text-emerald-400 font-bold">
                        कुल मात्रा (Total Inward Qty):{' '}
                        <strong className="text-white font-mono text-sm underline">
                          {multiBatches.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0).toFixed(2)}{' '}
                          {activeItem?.unitName || 'units'}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Remark / Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Voucher Notes / Bill Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Invoice #1024, received in good condition, loaded into Section B-4..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Submit Action */}
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
              disabled={isSaving || !activeItem || numQty <= 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center space-x-2 transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Processing Stock In...' : 'Receive Stock (दाखिला गर्नुहोस्)'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* RECENT INWARD TRANSACTIONS TABLE */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Stock In Entries</h2>
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
                <th className="px-4 py-3 text-right">Qty Received</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Batch & Expiry</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loadingHistory ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Loading recent inward entries...
                  </td>
                </tr>
              ) : recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No inward transactions recorded yet.
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
                    <td className="px-4 py-3 text-right font-extrabold text-emerald-400 whitespace-nowrap">
                      +{Number(entry.quantity).toLocaleString()}{' '}
                      <span className="text-[10px] font-normal text-slate-400">{entry.unitName || 'pcs'}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white whitespace-nowrap">
                      {Number(entry.balanceAfter).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {entry.batchNo ? (
                        <div>
                          <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                            {entry.batchNo}
                          </span>
                          {entry.expiryDate && (
                            <div className="text-[10px] text-slate-400 mt-0.5">Exp: {entry.expiryDate}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{entry.supplierName || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-700">
                        {entry.location || 'Godown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{entry.createdByUsername || 'admin'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ITEM CATALOG BROWSE MODAL */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Boxes className="w-5 h-5 text-brand-400" />
                <h3 className="text-base font-bold text-white">Item Catalog (वस्तु सूची)</h3>
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
                    key={`modal-${item.id}`}
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
