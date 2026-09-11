import React, { useState, useEffect, useMemo } from 'react';
import { TechnicianInventoryItem, PartsQuality, InventoryPriceHistoryItem } from '../../types';
import { ApiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Layers,
  Plus,
  ShieldCheck,
  Package,
  Search,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Clock,
  History,
  Tag,
  Edit2,
  Lock,
  Boxes,
  TrendingUp,
  X,
} from 'lucide-react';
import { CONTROLLED_PARTS_QUALITIES } from './QuoteBuilderModal';

export const PartsCatalogView: React.FC = () => {
  const { user } = useAuth();
  const [parts, setParts] = useState<TechnicianInventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addPartError, setAddPartError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Price History Drawer
  const [selectedPartHistory, setSelectedPartHistory] = useState<{
    item: TechnicianInventoryItem;
    history: InventoryPriceHistoryItem[];
  } | null>(null);

  // Price Edit Modal
  const [editingPart, setEditingPart] = useState<TechnicianInventoryItem | null>(null);
  const [newPriceNaira, setNewPriceNaira] = useState<number>(0);
  const [priceChangeReason, setPriceChangeReason] = useState<string>('');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [priceUpdateError, setPriceUpdateError] = useState<string | null>(null);

  // Add Form State
  const [deviceBrand, setDeviceBrand] = useState('Apple');
  const [deviceModel, setDeviceModel] = useState('iPhone 13');
  const [partCategory, setPartCategory] = useState('Display / Screen');
  const [partName, setPartName] = useState('iPhone 13 Premium Hard OLED Screen');
  const [quality, setQuality] = useState<PartsQuality>('PREMIUM_AFTERMARKET');
  const [priceNaira, setPriceNaira] = useState<number>(48000);
  const [stockQuantity, setStockQuantity] = useState<number>(8);
  const [warrantyDays, setWarrantyDays] = useState<number>(90);
  const [supplier, setSupplier] = useState('JK Global Parts Hub');
  const [sku, setSku] = useState('');

  const fetchParts = async () => {
    setIsLoading(true);
    try {
      const list = await ApiClient.getInventory();
      setParts(list);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
  }, [user]);

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setAddPartError(null);
    try {
      await ApiClient.addInventoryItem({
        partName,
        name: partName,
        brand: deviceBrand,
        deviceBrand,
        compatibleModels: [deviceModel],
        category: partCategory,
        quality,
        unitPriceNaira: Number(priceNaira),
        priceNaira: Number(priceNaira),
        quantityOnHand: Number(stockQuantity),
        inStockCount: Number(stockQuantity),
        stockQuantity: Number(stockQuantity),
        warrantyDays: Number(warrantyDays),
        supplier: supplier || undefined,
        sku: sku || undefined,
      });
      setShowAddModal(false);
      fetchParts();
    } catch (err: any) {
      setAddPartError(err.message || 'Failed to add inventory item');
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenPriceEdit = (part: TechnicianInventoryItem) => {
    setEditingPart(part);
    setNewPriceNaira(part.unitPriceNaira || part.priceNaira);
    setPriceChangeReason('');
    setPriceUpdateError(null);
  };

  const handleSavePriceUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPart) return;
    setIsUpdatingPrice(true);
    setPriceUpdateError(null);
    try {
      await ApiClient.updateInventoryItem(editingPart.id, {
        unitPriceNaira: Number(newPriceNaira),
        priceNaira: Number(newPriceNaira),
        priceChangeReason: priceChangeReason || 'Technician price adjustment',
      });
      setEditingPart(null);
      fetchParts();
    } catch (err: any) {
      setPriceUpdateError(err.message || 'Failed to update price');
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const handleViewPriceHistory = async (part: TechnicianInventoryItem) => {
    try {
      const res = await ApiClient.getInventoryPriceHistory(part.id);
      setSelectedPartHistory({
        item: part,
        history: res.priceHistory || part.priceHistory || [],
      });
    } catch (err) {
      setSelectedPartHistory({
        item: part,
        history: part.priceHistory || [],
      });
    }
  };

  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const matchesSearch =
        (p.partName || p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.brand || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.compatibleModels || []).some((m) => m.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [parts, search, selectedCategory, selectedStatus]);

  const totalInventoryValue = useMemo(() => {
    return parts.reduce((sum, p) => sum + (p.unitPriceNaira || p.priceNaira) * p.quantityOnHand, 0);
  }, [parts]);

  const totalReservedParts = useMemo(() => {
    return parts.reduce((sum, p) => sum + (p.quantityReserved || 0), 0);
  }, [parts]);

  return (
    <div id="parts-catalog-view" className="space-y-6 pb-8">
      {/* Catalog Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            <span>Technician Inventory & Transparent Pricing (Phase 7)</span>
          </div>
          <h2 className="text-xl font-black text-white mt-1">Shop Parts Inventory Catalog</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified stock, immutable price versioning, and quote reservation management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="add-new-catalog-part-btn"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Part</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Registered Items</span>
          <p className="text-xl font-black text-slate-900 mt-1">{parts.length}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Catalog Value</span>
          <p className="text-xl font-black text-blue-700 mt-1">₦{totalInventoryValue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Reserved in Quotes</span>
          <p className="text-xl font-black text-amber-600 mt-1">{totalReservedParts} units</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Price Protection</span>
          <p className="text-xs font-bold text-emerald-700 mt-1.5 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> Immutable Lock
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parts by name, brand, model or SKU..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Categories</option>
          <option value="Display / Screen">Display / Screen</option>
          <option value="Battery / Power">Battery / Power</option>
          <option value="Charging Port / Flex">Charging Port / Flex</option>
          <option value="Camera Assembly">Camera Assembly</option>
          <option value="Speaker / Mic">Speaker / Mic</option>
          <option value="Housing / Back Glass">Housing / Back Glass</option>
          <option value="Motherboard Component">Motherboard Component</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Stock Statuses</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>
      </div>

      {/* Parts Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading inventory catalog...</div>
      ) : filteredParts.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
          <Package className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="font-bold text-sm text-slate-800">No Inventory Items Found</h4>
          <p className="text-xs text-slate-500">Register new components to use authoritative pricing in quotes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredParts.map((part) => {
            const unitPrice = part.unitPriceNaira || part.priceNaira;
            const available = Math.max(0, part.quantityOnHand - (part.quantityReserved || 0));
            const reserved = part.quantityReserved || 0;

            return (
              <div
                key={part.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {part.brand} • {part.category}
                        </span>
                        {part.sku && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                            {part.sku}
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900 mt-0.5">{part.partName || part.name}</h4>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-blue-700">₦{unitPrice.toLocaleString()}</span>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span className="text-[10px] font-semibold text-slate-400">v{part.priceVersion || 1}</span>
                        <button
                          type="button"
                          onClick={() => handleOpenPriceEdit(part)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                          title="Edit unit price (creates audit trail)"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                      {(part.quality || 'STANDARD').replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        available === 0
                          ? 'bg-rose-100 text-rose-800'
                          : available <= 2
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {available === 0 ? 'Out of Stock' : `${available} Available`}
                    </span>
                    {reserved > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {reserved} Reserved in Quote(s)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-3 border-t border-slate-100">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">On Hand</span>
                    <span className="font-bold text-slate-800">{part.quantityOnHand} units</span>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-900 border border-emerald-200">
                    <span className="block text-[10px] text-emerald-700 font-semibold uppercase">Warranty</span>
                    <span className="font-bold text-emerald-800">{part.warrantyDays} Days</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewPriceHistory(part)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-600 flex flex-col items-center justify-center cursor-pointer transition-colors"
                  >
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">History</span>
                    <span className="font-bold text-blue-600 text-[11px] flex items-center gap-1">
                      <History className="w-3 h-3" /> Audit Log
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Price Modal */}
      {editingPart && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Update Inventory Unit Price</h3>
              <button onClick={() => setEditingPart(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Price Protection Notice
              </p>
              <p className="text-[11px] leading-relaxed">
                Updating this price will increment the price version (current: v{editingPart.priceVersion || 1}).
                Existing submitted quotes will remain locked at their original quoted price.
              </p>
            </div>

            {priceUpdateError && (
              <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {priceUpdateError}
              </p>
            )}

            <form onSubmit={handleSavePriceUpdate} className="space-y-3 text-xs">
              <div>
                <label className="font-bold block text-slate-700 mb-1">Part</label>
                <p className="p-2 bg-slate-100 rounded-lg text-slate-800 font-semibold">
                  {editingPart.partName || editingPart.name}
                </p>
              </div>

              <div>
                <label className="font-bold block text-slate-700 mb-1">New Unit Price (₦)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={newPriceNaira}
                  onChange={(e) => setNewPriceNaira(Number(e.target.value))}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold block text-slate-700 mb-1">Reason for Price Adjustment</label>
                <input
                  type="text"
                  value={priceChangeReason}
                  onChange={(e) => setPriceChangeReason(e.target.value)}
                  placeholder="e.g. Supplier component cost increase"
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPart(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPrice}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingPrice ? 'Saving...' : 'Save & Record Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price History Drawer */}
      {selectedPartHistory && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Price History & Audit Trail</h3>
                <p className="text-xs text-slate-500">{selectedPartHistory.item.partName || selectedPartHistory.item.name}</p>
              </div>
              <button onClick={() => setSelectedPartHistory(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {selectedPartHistory.history.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-4 text-center">No previous price revisions recorded.</p>
              ) : (
                selectedPartHistory.history.map((h, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">₦{h.priceNaira.toLocaleString()}</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                          v{h.version}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{h.reason || 'Price adjustment'}</p>
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(h.changedAt).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setSelectedPartHistory(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Part Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Register Inventory Component</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPart} className="space-y-3 text-xs">
              {addPartError && (
                <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {addPartError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={deviceBrand}
                    onChange={(e) => setDeviceBrand(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Compatible Model</label>
                  <input
                    type="text"
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block text-slate-700 mb-1">Part Description</label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Category</label>
                  <select
                    value={partCategory}
                    onChange={(e) => setPartCategory(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Display / Screen">Display / Screen</option>
                    <option value="Battery / Power">Battery / Power</option>
                    <option value="Charging Port / Flex">Charging Port / Flex</option>
                    <option value="Camera Assembly">Camera Assembly</option>
                    <option value="Speaker / Mic">Speaker / Mic</option>
                    <option value="Housing / Back Glass">Housing / Back Glass</option>
                    <option value="Motherboard Component">Motherboard Component</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Quality Grade</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as PartsQuality)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    {CONTROLLED_PARTS_QUALITIES.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Price (₦)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={priceNaira}
                    onChange={(e) => setPriceNaira(Number(e.target.value))}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Stock</label>
                  <input
                    type="number"
                    min="1"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Warranty (Days)</label>
                  <input
                    type="number"
                    min="14"
                    max="365"
                    value={warrantyDays}
                    onChange={(e) => setWarrantyDays(Number(e.target.value))}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-emerald-800 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block text-slate-700 mb-1">Supplier / Sourcing (Optional)</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  placeholder="e.g. Authorized Carlcare or OEM Direct"
                />
              </div>

              <button
                type="submit"
                disabled={isAdding}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer mt-2"
              >
                {isAdding ? 'Registering Part...' : 'Register to Inventory'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
