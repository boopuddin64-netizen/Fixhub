import React, { useState, useEffect } from 'react';
import { TechnicianPart } from '../../types';
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
  AlertCircle
} from 'lucide-react';

export const PartsCatalogView: React.FC = () => {
  const { user } = useAuth();
  const [parts, setParts] = useState<TechnicianPart[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [deviceBrand, setDeviceBrand] = useState('Apple');
  const [deviceModel, setDeviceModel] = useState('iPhone 13');
  const [partCategory, setPartCategory] = useState('SCREEN');
  const [partName, setPartName] = useState('iPhone 13 Premium Hard OLED Assembly');
  const [quality, setQuality] = useState('PREMIUM_AFTERMARKET');
  const [priceNaira, setPriceNaira] = useState<number>(45000);
  const [stockQuantity, setStockQuantity] = useState<number>(8);
  const [warrantyDays, setWarrantyDays] = useState<number>(90);

  const fetchParts = async () => {
    if (user?.id) {
      try {
        const list = await ApiClient.getTechnicianParts(user.id);
        setParts(list);
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    fetchParts();
  }, [user]);

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      await ApiClient.addTechnicianPart({
        deviceBrand,
        deviceModel,
        partCategory,
        partName,
        quality,
        priceNaira: Number(priceNaira),
        stockQuantity: Number(stockQuantity),
        warrantyDays: Number(warrantyDays),
      });
      setShowAddModal(false);
      fetchParts();
    } finally {
      setIsAdding(false);
    }
  };

  const filteredParts = parts.filter(
    (p) =>
      p.partName.toLowerCase().includes(search.toLowerCase()) ||
      p.deviceModel.toLowerCase().includes(search.toLowerCase()) ||
      p.deviceBrand.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div id="parts-catalog-view" className="space-y-6 pb-8">
      {/* Catalog Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
            <Layers className="w-4 h-4" />
            <span>Shop Inventory Management</span>
          </div>
          <h2 className="text-xl font-black text-white">Parts Catalog & Warranties</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent pricing and authentic stock for quote generation
          </p>
        </div>

        <button
          id="add-new-catalog-part-btn"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Part</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search catalog by model or part name..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        />
      </div>

      {/* Parts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredParts.map((part) => (
          <div
            key={part.id}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {part.deviceBrand} {part.deviceModel}
                </span>
                <h4 className="font-extrabold text-sm text-slate-900 mt-0.5">{part.partName}</h4>
              </div>
              <span className="text-sm font-extrabold text-blue-700">₦{part.priceNaira.toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-100">
              <div className="p-2 bg-slate-50 rounded-lg">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Grade</span>
                <span className="font-bold text-slate-800 text-[11px] truncate block">{part.quality.replace('_', ' ')}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">In Stock</span>
                <span className="font-bold text-slate-800">{part.stockQuantity} units</span>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-900 border border-emerald-200">
                <span className="block text-[10px] text-emerald-700 font-semibold uppercase">Warranty</span>
                <span className="font-bold text-emerald-800">{part.warrantyDays} Days</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Part Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Add Part to Shop Catalog</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddPart} className="space-y-3 text-xs">
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
                  <label className="font-bold block text-slate-700 mb-1">Model</label>
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
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Price (₦)</label>
                  <input
                    type="number"
                    value={priceNaira}
                    onChange={(e) => setPriceNaira(Number(e.target.value))}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Stock</label>
                  <input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold block text-slate-700 mb-1">Warranty (Days)</label>
                  <input
                    type="number"
                    value={warrantyDays}
                    onChange={(e) => setWarrantyDays(Number(e.target.value))}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isAdding}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer mt-2"
              >
                {isAdding ? 'Saving...' : 'Add to Inventory'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
