import React, { useState, useEffect, useMemo } from 'react';
import { RepairRequest, PartsQuality, TechnicianInventoryItem } from '../../types';
import { ApiClient } from '../../api/client';
import {
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
  X,
  Plus,
  Trash2,
  Package,
  Search,
  CheckCircle2,
  Info,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface QuoteBuilderModalProps {
  request: RepairRequest;
  onClose: () => void;
  onQuoteSubmitted: () => void;
}

interface SelectedQuotePart {
  item: TechnicianInventoryItem;
  quantity: number;
}

export const CONTROLLED_PARTS_QUALITIES: { id: PartsQuality; label: string; desc: string }[] = [
  { id: 'ORIGINAL_MANUFACTURER', label: 'Original / Manufacturer', desc: 'Direct OEM unit or authentic service pack' },
  { id: 'ORIGINAL_OEM', label: 'Original OEM', desc: 'Original factory component' },
  { id: 'OEM', label: 'OEM Specification', desc: 'Manufactured to OEM specifications' },
  { id: 'PREMIUM_AFTERMARKET', label: 'Premium Aftermarket', desc: 'High-grade replacement part with tested reliability' },
  { id: 'STANDARD_AFTERMARKET', label: 'Standard Aftermarket', desc: 'Standard replacement part' },
  { id: 'USED_REFURBISHED', label: 'Used / Refurbished', desc: 'Tested working pulled or refurbished unit' },
  { id: 'UNKNOWN', label: 'Unknown / To Be Inspected', desc: 'Grade unknown until physical inspection' },
];

export const QuoteBuilderModal: React.FC<QuoteBuilderModalProps> = ({
  request,
  onClose,
  onQuoteSubmitted,
}) => {
  const [inventory, setInventory] = useState<TechnicianInventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [selectedParts, setSelectedParts] = useState<SelectedQuotePart[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [laborCost, setLaborCost] = useState<number>(12000);
  const [diagnosticCost, setDiagnosticCost] = useState<number>(0);
  const [otherCost, setOtherCost] = useState<number>(0);
  const [estimatedHours, setEstimatedHours] = useState<number>(2);
  const [warrantyDays, setWarrantyDays] = useState<number>(60);
  const [validityDays, setValidityDays] = useState<number>(7);
  const [notes, setNotes] = useState<string>(`Certified repair for ${request.deviceBrand} ${request.deviceModel} with genuine bench testing and warranty protection.`);
  const [limitationsOrConditions, setLimitationsOrConditions] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick Add Inventory Form State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickPartName, setQuickPartName] = useState(`${request.deviceBrand} ${request.deviceModel} Replacement Screen`);
  const [quickCategory, setQuickCategory] = useState('Display / Screen');
  const [quickQuality, setQuickQuality] = useState<PartsQuality>('PREMIUM_AFTERMARKET');
  const [quickPriceNaira, setQuickPriceNaira] = useState<number>(45000);
  const [quickQuantityOnHand, setQuickQuantityOnHand] = useState<number>(5);
  const [quickWarrantyDays, setQuickWarrantyDays] = useState<number>(90);
  const [quickSupplier, setQuickSupplier] = useState('');
  const [isSavingQuickPart, setIsSavingQuickPart] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  // Fetch technician inventory
  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const items = await ApiClient.getInventory();
      setInventory(items);

      // Auto-suggest: If an inventory item matches device brand and model, pre-select it
      const match = items.find(
        (p) =>
          (p.brand.toLowerCase() === request.deviceBrand.toLowerCase() || p.deviceBrand?.toLowerCase() === request.deviceBrand.toLowerCase()) &&
          (p.compatibleModels?.some((m) => m.toLowerCase().includes(request.deviceModel.toLowerCase())) ||
            p.partName.toLowerCase().includes(request.deviceModel.toLowerCase())) &&
          (p.quantityAvailable > 0 || p.quantityOnHand > 0)
      );

      if (match) {
        setSelectedParts([{ item: match, quantity: 1 }]);
        if (match.warrantyDays && match.warrantyDays > 60) {
          setWarrantyDays(match.warrantyDays);
        }
      }
    } catch (err: any) {
      console.error('Failed to load inventory:', err);
    } finally {
      setIsLoadingInventory(false);
    }
  };

  // Authoritative parts total computed from selected inventory items
  const partsCost = useMemo(() => {
    return selectedParts.reduce((sum, p) => sum + (p.item.unitPriceNaira || p.item.priceNaira) * p.quantity, 0);
  }, [selectedParts]);

  const maxPartWarranty = useMemo(() => {
    return selectedParts.reduce((max, p) => Math.max(max, p.item.warrantyDays || 60), 60);
  }, [selectedParts]);

  // Keep warranty days aligned with selected parts
  useEffect(() => {
    if (maxPartWarranty > warrantyDays) {
      setWarrantyDays(maxPartWarranty);
    }
  }, [maxPartWarranty]);

  const totalAmount = partsCost + Number(laborCost || 0) + Number(diagnosticCost || 0) + Number(otherCost || 0);
  const platformFee = Math.round(totalAmount * 0.085);
  const netEarnings = totalAmount - platformFee;

  // Filter available inventory items
  const filteredInventory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return inventory.filter((item) => {
      const isAlreadySelected = selectedParts.some((p) => p.item.id === item.id);
      if (isAlreadySelected) return false;

      if (!q) return true;
      return (
        item.partName.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.compatibleModels.some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [inventory, selectedParts, searchQuery]);

  const handleSelectPart = (item: TechnicianInventoryItem) => {
    const available = Math.max(0, item.quantityOnHand - (item.quantityReserved || 0));
    if (available <= 0) {
      setErrorMsg(`Cannot select "${item.partName}": Out of available stock.`);
      return;
    }
    setErrorMsg(null);
    setSelectedParts((prev) => [...prev, { item, quantity: 1 }]);
  };

  const handleRemovePart = (id: string) => {
    setSelectedParts((prev) => prev.filter((p) => p.item.id !== id));
  };

  const handleQuantityChange = (id: string, newQty: number) => {
    setSelectedParts((prev) =>
      prev.map((p) => {
        if (p.item.id !== id) return p;
        const available = Math.max(1, p.item.quantityOnHand - (p.item.quantityReserved || 0));
        const clamped = Math.max(1, Math.min(newQty, available));
        return { ...p, quantity: clamped };
      })
    );
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAddError(null);
    setIsSavingQuickPart(true);

    try {
      const res = await ApiClient.addInventoryItem({
        partName: quickPartName,
        category: quickCategory,
        brand: request.deviceBrand,
        compatibleModels: [request.deviceModel],
        quality: quickQuality,
        unitPriceNaira: Number(quickPriceNaira),
        priceNaira: Number(quickPriceNaira),
        quantityOnHand: Number(quickQuantityOnHand),
        inStockCount: Number(quickQuantityOnHand),
        warrantyDays: Number(quickWarrantyDays),
        supplier: quickSupplier || undefined,
      });

      if (res) {
        setInventory((prev) => [res, ...prev]);
        setSelectedParts((prev) => [...prev, { item: res, quantity: 1 }]);
        setShowQuickAdd(false);
        setQuickPartName(`${request.deviceBrand} ${request.deviceModel} Repair Part`);
      }
    } catch (err: any) {
      setQuickAddError(err.message || 'Failed to register inventory part.');
    } finally {
      setIsSavingQuickPart(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    // Strict Business Rule Validation
    if (selectedParts.length === 0 && Number(laborCost) <= 0) {
      setErrorMsg('A quote must either include registered parts or a labor fee.');
      setIsSubmitting(false);
      return;
    }

    try {
      const itemsPayload = selectedParts.map((p) => ({
        inventoryItemId: p.item.id,
        quantity: p.quantity,
      }));

      await ApiClient.submitQuote({
        requestId: request.id,
        items: itemsPayload,
        laborCost: Number(laborCost),
        diagnosticCost: Number(diagnosticCost || 0),
        otherCost: Number(otherCost || 0),
        estimatedTimeHours: Number(estimatedHours),
        warrantyDays: Number(warrantyDays),
        validityDays: Number(validityDays),
        notes,
        limitationsOrConditions,
      });

      onQuoteSubmitted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit quote');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="quote-builder-modal"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900">Prepare Transparent Quote</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Inventory Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              For {request.deviceBrand} {request.deviceModel} ({(request.issues || []).join(', ')})
            </p>
          </div>
          <button
            id="close-quote-builder-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Authoritative Parts & Inventory Selector */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Quoted Replacement Parts (From Registered Inventory)
                </label>
                <p className="text-[11px] text-slate-500">
                  Parts pricing is locked to your verified stock catalog. Arbitrary free-text pricing is disallowed.
                </p>
              </div>
              <button
                type="button"
                id="quick-add-part-btn"
                onClick={() => setShowQuickAdd(!showQuickAdd)}
                className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showQuickAdd ? 'Close' : 'Register New Part'}</span>
              </button>
            </div>

            {/* Quick Add Part Sub-Form */}
            {showQuickAdd && (
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600" />
                    Register Component to Technician Inventory
                  </h4>
                  <span className="text-[10px] text-blue-700 font-medium">Auto-populates Quote</span>
                </div>

                {quickAddError && (
                  <p className="text-[11px] text-rose-600 font-medium bg-white p-2 rounded-lg border border-rose-200">
                    {quickAddError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Part Name</label>
                    <input
                      type="text"
                      value={quickPartName}
                      onChange={(e) => setQuickPartName(e.target.value)}
                      required
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. iPhone 13 OLED Display Panel (Hard OLED)"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Category</label>
                    <select
                      value={quickCategory}
                      onChange={(e) => setQuickCategory(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Quality Grade</label>
                    <select
                      value={quickQuality}
                      onChange={(e) => setQuickQuality(e.target.value as PartsQuality)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    >
                      {CONTROLLED_PARTS_QUALITIES.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Unit Price (₦)</label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={quickPriceNaira}
                      onChange={(e) => setQuickPriceNaira(Number(e.target.value))}
                      required
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Quantity On Hand</label>
                    <input
                      type="number"
                      min="1"
                      value={quickQuantityOnHand}
                      onChange={(e) => setQuickQuantityOnHand(Number(e.target.value))}
                      required
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowQuickAdd(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickAddSubmit}
                    disabled={isSavingQuickPart}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSavingQuickPart ? 'Registering...' : 'Save & Add to Quote'}
                  </button>
                </div>
              </div>
            )}

            {/* Selected Parts List */}
            {selectedParts.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>Selected Parts ({selectedParts.length})</span>
                  <span className="text-emerald-700 font-extrabold">Subtotal: ₦{partsCost.toLocaleString()}</span>
                </div>
                <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {selectedParts.map((sp) => {
                    const available = Math.max(1, sp.item.quantityOnHand - (sp.item.quantityReserved || 0));
                    const unitPrice = sp.item.unitPriceNaira || sp.item.priceNaira;
                    return (
                      <div key={sp.item.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 truncate">{sp.item.partName || sp.item.name}</p>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                              {sp.item.sku}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-medium text-blue-700">{(sp.item.quality || 'PREMIUM_AFTERMARKET').replace(/_/g, ' ')}</span>
                            <span>•</span>
                            <span>{sp.item.warrantyDays} Days Warranty</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-600">
                              <Lock className="w-3 h-3 text-slate-400" /> ₦{unitPrice.toLocaleString()} / unit
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1">
                            <label className="text-[10px] text-slate-500">Qty:</label>
                            <input
                              type="number"
                              min="1"
                              max={available}
                              value={sp.quantity}
                              onChange={(e) => handleQuantityChange(sp.item.id, Number(e.target.value))}
                              className="w-12 p-1 bg-slate-50 border border-slate-200 rounded text-center text-xs font-bold"
                            />
                          </div>
                          <div className="text-right min-w-[70px]">
                            <p className="font-extrabold text-slate-900">₦{(unitPrice * sp.quantity).toLocaleString()}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePart(sp.item.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                            title="Remove part"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">No parts currently selected.</p>
                  <p className="text-[11px] text-amber-800">
                    If this repair requires hardware components, pick from your stock below or register new inventory. If this is a labor-only repair (e.g. software flash, cleaning), parts cost will be ₦0.
                  </p>
                </div>
              </div>
            )}

            {/* Inventory Browser / Picker */}
            {filteredInventory.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-slate-700">Add from Stock Catalog:</p>
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search parts..."
                      className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {filteredInventory.slice(0, 6).map((item) => {
                    const available = Math.max(0, item.quantityOnHand - (item.quantityReserved || 0));
                    const isOutOfStock = available <= 0;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        disabled={isOutOfStock}
                        onClick={() => handleSelectPart(item)}
                        className={`p-2 rounded-xl border text-left flex items-start justify-between gap-2 transition-all ${
                          isOutOfStock
                            ? 'opacity-40 border-slate-200 bg-slate-100 cursor-not-allowed'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer shadow-2xs'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-xs truncate">{item.partName || item.name}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700">{item.brand}</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-bold">₦{(item.unitPriceNaira || item.priceNaira).toLocaleString()}</span>
                          </div>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : available <= 2
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOutOfStock ? 'Out of Stock' : `${available} Avail`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Labor & Additional Fees */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. Labor & Diagnostic Fees
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Labor Fee (₦) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="quote-labor-cost-input"
                  type="number"
                  min="0"
                  step="500"
                  value={laborCost}
                  onChange={(e) => setLaborCost(Number(e.target.value))}
                  required
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Bench / Diagnostic (₦)
                </label>
                <input
                  id="quote-diagnostic-cost-input"
                  type="number"
                  min="0"
                  step="500"
                  value={diagnosticCost}
                  onChange={(e) => setDiagnosticCost(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Other / Misc Fee (₦)
                </label>
                <input
                  id="quote-other-cost-input"
                  type="number"
                  min="0"
                  step="500"
                  value={otherCost}
                  onChange={(e) => setOtherCost(Number(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Turnaround & Warranty Guarantee */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Turnaround (Hrs)
              </label>
              <input
                id="quote-hours-input"
                type="number"
                min="1"
                max="72"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                required
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Warranty (Days)
              </label>
              <input
                id="quote-warranty-input"
                type="number"
                min="14"
                max="365"
                value={warrantyDays}
                onChange={(e) => setWarrantyDays(Number(e.target.value))}
                required
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Valid For
              </label>
              <select
                id="quote-validity-select"
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500"
              >
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>
          </div>

          {/* 4. Notes and Conditions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Shop Advice & Repair Notes
            </label>
            <textarea
              id="quote-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Precision screen fitting and touch recalibration included."
            />
          </div>

          {/* 5. Authoritative Financial Summary */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Verified Parts Subtotal:</span>
              <span className="font-semibold text-white">₦{partsCost.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Labor & Services:</span>
              <span className="font-semibold text-white">
                ₦{(Number(laborCost || 0) + Number(diagnosticCost || 0) + Number(otherCost || 0)).toLocaleString()}
              </span>
            </div>
            <div className="h-px bg-slate-800 my-1" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-200">Customer Total Quote:</span>
              <span className="font-extrabold text-emerald-400 text-base">₦{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Fix Hub Fee (8.5%): ₦{platformFee.toLocaleString()}</span>
              <span className="font-bold text-emerald-300">Your Net Payout: ₦{netEarnings.toLocaleString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-quote-btn"
              disabled={isSubmitting || totalAmount <= 0}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Send Transparent Quote'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
