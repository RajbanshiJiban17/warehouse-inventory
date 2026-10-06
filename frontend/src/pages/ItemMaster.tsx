import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Barcode,
  RefreshCw,
  Wand2,
  ShieldAlert,
} from 'lucide-react';
import type { Item, Category, Unit } from '../types';
import { api, getApiBase } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export const ItemMaster: React.FC = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 15;

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Code Generation Mode (Auto vs Manual)
  const [isAutoCode, setIsAutoCode] = useState(true);
  const [isFetchingCode, setIsFetchingCode] = useState(false);

  // Secure Delete Confirmation Modal
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset Inventory State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    itemCode: '',
    itemName: '',
    barcode: '',
    categoryId: '',
    unitId: '',
    openingQuantity: '0',
    minStockLevel: '0',
  });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await api.getItems({
        search: search || undefined,
        category_id: selectedCategory ? Number(selectedCategory) : undefined,
        is_low_stock: lowStockOnly ? true : undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setItems(data.items);
      setTotalCount(data.total);
    } catch (e: any) {
      showToast('error', 'Error Loading Items', e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [cats, uns] = await Promise.all([api.getCategories(), api.getUnits()]);
      setCategories(cats);
      setUnits(uns);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [search, selectedCategory, lowStockOnly, page]);

  const fetchNextCode = async () => {
    setIsFetchingCode(true);
    try {
      const res = await api.getNextItemCode();
      setFormData((prev) => ({ ...prev, itemCode: res.nextCode }));
    } catch {
      setFormData((prev) => ({ ...prev, itemCode: `ITM-${Date.now().toString().slice(-4)}` }));
    } finally {
      setIsFetchingCode(false);
    }
  };

  const handleGenerateBarcode = () => {
    // Generate a clean 12-digit EAN-style barcode format: 890 + 9 random digits
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
    setFormData((prev) => ({ ...prev, barcode: `890${randomDigits}` }));
  };

  const resetForm = () => {
    setFormData({
      itemCode: '',
      itemName: '',
      barcode: '',
      categoryId: categories[0]?.id ? String(categories[0].id) : '',
      unitId: units[0]?.id ? String(units[0].id) : '',
      openingQuantity: '0',
      minStockLevel: '0',
    });
    setFormError('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsAutoCode(true);
    fetchNextCode();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      itemCode: item.itemCode,
      itemName: item.itemName,
      barcode: item.barcode,
      categoryId: String(item.categoryId),
      unitId: String(item.unitId),
      openingQuantity: String(item.quantity),
      minStockLevel: String(item.minStockLevel),
    });
    setFormError('');
    setIsEditOpen(true);
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError('');

    try {
      await api.createItem({
        itemCode: formData.itemCode.trim(),
        itemName: formData.itemName.trim(),
        barcode: formData.barcode.trim(),
        categoryId: Number(formData.categoryId),
        unitId: Number(formData.unitId),
        openingQuantity: Number(formData.openingQuantity) || 0,
        minStockLevel: Number(formData.minStockLevel) || 0,
      });
      showToast('success', 'Item Registered', `Item ${formData.itemCode} created with opening stock.`);
      setIsCreateOpen(false);
      fetchItems();
    } catch (err: any) {
      setFormError(err.message || 'Failed to register item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSaving(true);
    setFormError('');

    try {
      await api.updateItem(editingItem.id, {
        itemCode: formData.itemCode.trim(),
        itemName: formData.itemName.trim(),
        barcode: formData.barcode.trim(),
        categoryId: Number(formData.categoryId),
        unitId: Number(formData.unitId),
        minStockLevel: Number(formData.minStockLevel) || 0,
      });
      showToast('success', 'Item Updated', `Item ${formData.itemCode} updated successfully.`);
      setIsEditOpen(false);
      fetchItems();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDelete = (item: Item) => {
    setDeletingItem(item);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    if (Number(deletingItem.quantity) > 0) {
      showToast(
        'error',
        'Cannot Delete Active Stock',
        `Item has ${deletingItem.quantity} ${deletingItem.unitName || 'units'} in inventory. Please issue or adjust to 0 first.`
      );
      return;
    }
    setIsDeleting(true);
    try {
      await api.deleteItem(deletingItem.id);
      showToast('info', 'Item Archived', `${deletingItem.itemName} (${deletingItem.itemCode}) has been safely archived.`);
      setDeletingItem(null);
      fetchItems();
    } catch (err: any) {
      showToast('error', 'Delete Failed', err.message || 'Could not archive item.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImportFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setIsImporting(true);
    setImportResult(null);

    try {
      const res = await api.importItemsFile(importFile);
      setImportResult(res);
      showToast('success', 'Import Completed', `Imported ${res.importedCount} items.`);
      fetchItems();
    } catch (err: any) {
      showToast('error', 'Import Failed', err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetInventory = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      showToast('error', 'Confirmation Mismatch', 'Please type RESET to confirm.');
      return;
    }
    setIsResetting(true);
    try {
      const res = await api.resetInventory();
      showToast('success', 'Inventory Reset', res.message || 'All items and transactions cleared.');
      setIsResetModalOpen(false);
      setResetConfirmText('');
      fetchItems();
    } catch (err: any) {
      showToast('error', 'Reset Failed', err.message || 'Could not reset inventory.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Boxes className="w-7 h-7 text-brand-400" />
            <span>Item Master Directory</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Registered goods, barcode bindings, real-time stock balances, and threshold alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => window.open(`${getApiBase()}/items/export/data?format=csv`, '_blank')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 hover:bg-slate-700 transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => window.open(`${getApiBase()}/items/export/data?format=xlsx`, '_blank')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 hover:bg-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                setImportFile(null);
                setImportResult(null);
                setIsImportOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 hover:bg-slate-700 transition"
            >
              <Upload className="w-4 h-4 text-brand-400" />
              <span>Bulk Import</span>
            </button>
          )}
          {isAdmin && totalCount > 0 && (
            <button
              onClick={() => {
                setResetConfirmText('');
                setIsResetModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-950/40 text-rose-300 hover:text-white hover:bg-rose-900/60 rounded-xl text-xs font-semibold border border-rose-800/60 transition"
              title="Wipe existing inventory items and batches to upload a clean spreadsheet"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Reset Inventory</span>
            </button>
          )}
          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Item</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Item Name, Code, or scan Barcode..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center">
          <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-300">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
              className="w-4 h-4 rounded text-brand-600 focus:ring-0 bg-slate-900 border-slate-700"
            />
            <span className="flex items-center space-x-1 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Low Stock Only</span>
            </span>
          </label>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Item Code</th>
                <th className="px-6 py-3.5">Item Name</th>
                <th className="px-6 py-3.5">Barcode</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5 text-right">Current Stock</th>
                <th className="px-6 py-3.5 text-right">Min Stock</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    Loading items from database...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                        <Boxes className="w-6 h-6" />
                      </div>
                      <p className="text-base font-semibold text-white">No Inventory Items Found</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Your warehouse catalog is currently empty. Upload an Excel (.xlsx) spreadsheet to import all items, or register items manually.
                      </p>
                      <div className="flex items-center space-x-3 pt-2">
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setImportFile(null);
                              setImportResult(null);
                              setIsImportOpen(true);
                            }}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-brand-400 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 transition"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Bulk Import (Excel / CSV)</span>
                          </button>
                        )}
                        <button
                          onClick={handleOpenCreate}
                          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-brand-600/30 transition"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Register New Item</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/50 transition">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-brand-400 bg-brand-950/70 px-2 py-1 rounded-md border border-brand-800/60 inline-block">
                        {item.itemCode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white text-sm">{item.itemName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-300">
                        <Barcode className="w-4 h-4 text-slate-500" />
                        <span>{item.barcode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs">{item.categoryName || '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-white text-base">
                        {Number(item.quantity).toLocaleString()}
                      </span>{' '}
                      <span className="text-xs text-slate-400">{item.unitName}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-slate-400">
                      {Number(item.minStockLevel).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.isLowStock ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800/80">
                          <AlertTriangle className="w-3 h-3" />
                          <span>LOW STOCK</span>
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                          IN STOCK
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-brand-400 hover:bg-slate-900 rounded-lg transition"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleOpenDelete(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition"
                            title="Protected Soft Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <div>
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} items
          </div>
          <div className="flex space-x-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-800 text-white"
            >
              Previous
            </button>
            <button
              disabled={page * limit >= totalCount}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-800 text-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* CREATE ITEM MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Register New Warehouse Item</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCreate} className="mt-4 space-y-4">
              {/* Code Mode Selector: Auto vs Manual */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Item Code (सामान कोड) *
                  </label>
                  <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoCode(true);
                        fetchNextCode();
                      }}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        isAutoCode ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Auto Generate
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAutoCode(false)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        !isAutoCode ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Manual Input
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder={isAutoCode ? 'Fetching next code...' : 'Enter manual item code (e.g. ELEC-007)'}
                    value={formData.itemCode}
                    onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                    readOnly={isAutoCode && isFetchingCode}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-brand-500"
                  />
                  {isAutoCode && (
                    <button
                      type="button"
                      onClick={fetchNextCode}
                      disabled={isFetchingCode}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs flex items-center space-x-1 border border-slate-700 transition"
                      title="Generate next code"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetchingCode ? 'animate-spin text-brand-400' : ''}`} />
                      <span>Next</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {isAutoCode
                    ? '✓ Automatically generates sequential code (ITM-0001, ITM-0002) from database sequence.'
                    : '✎ Type manual custom SKU, part number, or code.'}
                </p>
              </div>

              {/* Distinct Item Name */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Item Name (सामानको पुरा नाम) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basmati Rice 25kg / Ergonomic Office Mouse / LED Bulb 9W"
                  value={formData.itemName}
                  onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-sm font-medium focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Barcode with Auto Generator helper */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Item Barcode (बारकोड) *</label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center space-x-1 font-semibold"
                    title="Generate barcode automatically"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Auto Generate Barcode</span>
                  </button>
                </div>
                <div className="relative">
                  <Barcode className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Scan with USB reader or enter barcode..."
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Category *</label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Unit of Measure *</label>
                  <select
                    required
                    value={formData.unitId}
                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Select Unit</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Opening Stock Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.openingQuantity}
                    onChange={(e) => setFormData({ ...formData, openingQuantity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Creates initial OPENING ledger entry</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Min Alert Stock Level</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Triggers low-stock warning threshold</p>
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-600/30"
                >
                  {isSaving ? 'Registering...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ITEM MODAL */}
      {isEditOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Edit Item: {editingItem.itemCode}</h2>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Item Code</label>
                  <input
                    type="text"
                    required
                    value={formData.itemCode}
                    onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Barcode</label>
                  <input
                    type="text"
                    required
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={formData.itemName}
                  onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Min Alert Level</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold"
                >
                  {isSaving ? 'Updating...' : 'Update Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL / CSV BULK IMPORT MODAL */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Upload className="w-5 h-5 text-brand-400" />
                <span>Bulk Import Items (Excel / CSV)</span>
              </h2>
              <button onClick={() => setIsImportOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Accepted formats: <strong className="text-emerald-400">.xlsx, .xls, .csv</strong></span>
                <a
                  href={`${getApiBase()}/items/import/template?format=xlsx`}
                  download="inventory_import_template.xlsx"
                  className="text-brand-400 hover:text-brand-300 font-semibold underline flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5 inline mr-1" />
                  <span>Download Excel Template</span>
                </a>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Columns: <code className="text-brand-300">Item Code, Item Name, Barcode, Category, Unit, Opening Stock, Min Stock Level</code>. Categories and Units will be auto-created if they don't exist.
              </p>
            </div>

            <form onSubmit={handleImportFile} className="mt-4 space-y-4">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                required
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
              />

              {importResult && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Successfully Imported: {importResult.importedCount} items</span>
                  </div>
                  {importResult.failedCount > 0 && (
                    <div className="text-rose-400 font-semibold">
                      Failed Rows: {importResult.failedCount}
                      <ul className="mt-1 list-disc list-inside text-rose-300 font-normal space-y-0.5 max-h-32 overflow-y-auto">
                        {importResult.errors.map((err: any, idx: number) => (
                          <li key={idx}>Row {err.rowNumber}: {err.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importFile}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-lg shadow-brand-600/30"
                >
                  {isImporting ? 'Processing File...' : 'Start Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECURE DELETE PROTECTION MODAL */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Item Deletion Protection</h3>
                <p className="text-xs text-slate-400">Database stock & ledger integrity check</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Item Name:</span>
                  <span className="font-semibold text-white">{deletingItem.itemName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Item Code:</span>
                  <span className="font-mono text-brand-400">{deletingItem.itemCode}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Current Inventory Stock:</span>
                  <span className={`font-bold text-sm ${Number(deletingItem.quantity) > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {Number(deletingItem.quantity).toLocaleString()} {deletingItem.unitName || 'units'}
                  </span>
                </div>
              </div>

              {Number(deletingItem.quantity) > 0 ? (
                <div className="p-3.5 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs space-y-1.5">
                  <div className="font-bold flex items-center space-x-1.5 text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Deletion Blocked by System</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-200">
                    This item currently has positive stock in the warehouse ({deletingItem.quantity} {deletingItem.unitName || 'units'}). Deleting active goods causes financial & stock ledger reconciliation mismatch. Please issue or adjust stock to <strong>0</strong> first.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-300">
                    Stock is 0. To protect against accidental deletions, please type the item code{' '}
                    <strong className="text-brand-400 font-mono">{deletingItem.itemCode}</strong> or{' '}
                    <strong className="text-rose-400 font-mono">DELETE</strong> below:
                  </p>
                  <input
                    type="text"
                    placeholder={`Type ${deletingItem.itemCode} or DELETE...`}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={
                  isDeleting ||
                  Number(deletingItem.quantity) > 0 ||
                  (deleteConfirmText.trim() !== deletingItem.itemCode && deleteConfirmText.trim().toUpperCase() !== 'DELETE')
                }
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/30"
              >
                {isDeleting ? 'Archiving...' : 'Confirm Delete / Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET INVENTORY CONFIRMATION MODAL */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <ShieldAlert className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-white">Reset Entire Inventory Catalog?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This action will permanently wipe all <strong className="text-white">{totalCount} items</strong>, 
              stock movements, transactions, and batches from the database. Categories, units, and user accounts will be kept.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-200">
              <p className="font-semibold mb-1.5">To confirm this action, type <span className="font-mono font-bold text-white">RESET</span> below:</p>
              <input
                type="text"
                placeholder="Type RESET..."
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-rose-700/60 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="mt-5 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetInventory}
                disabled={isResetting || resetConfirmText.trim().toUpperCase() !== 'RESET'}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/30"
              >
                {isResetting ? 'Wiping...' : 'Confirm Reset All Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
