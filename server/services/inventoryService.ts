import { db } from '../db';
import {
  TechnicianInventoryItem,
  QuoteLineItem,
  PartsQuality,
  InventoryPriceHistoryItem,
  InventoryItemStatus,
  RepairQuote,
  PartUsedRecord,
  RepairRequest,
} from '../../src/types';
import { AuditService } from './auditService';
import { sanitizeString, validateNumber, isNonEmptyString } from '../utils/validation';

export class InventoryService {
  /**
   * Helper to ensure an item has normalized and calculated properties
   */
  private static normalizeItem(item: any): TechnicianInventoryItem {
    const unitPrice = typeof item.unitPriceNaira === 'number' ? item.unitPriceNaira : (item.priceNaira || 0);
    const onHand = typeof item.quantityOnHand === 'number' ? item.quantityOnHand : (typeof item.inStockCount === 'number' ? item.inStockCount : (item.stockQuantity || 0));
    const reserved = typeof item.quantityReserved === 'number' ? item.quantityReserved : 0;
    const available = Math.max(0, onHand - reserved);

    let status: InventoryItemStatus = item.status || 'IN_STOCK';
    if (onHand <= 0 || available <= 0) {
      status = 'OUT_OF_STOCK';
    } else if (available <= 2) {
      status = 'LOW_STOCK';
    } else {
      status = 'IN_STOCK';
    }

    const priceVersion = typeof item.priceVersion === 'number' && item.priceVersion >= 1 ? item.priceVersion : 1;
    const priceHistory: InventoryPriceHistoryItem[] = Array.isArray(item.priceHistory) && item.priceHistory.length > 0
      ? item.priceHistory
      : [
          {
            priceNaira: unitPrice,
            version: priceVersion,
            changedAt: item.createdAt || new Date().toISOString(),
            reason: 'Initial inventory registration',
          },
        ];

    const compatibleModels: string[] = Array.isArray(item.compatibleModels)
      ? item.compatibleModels
      : (item.deviceModel ? [item.deviceModel] : ['All Models']);

    const brand = item.brand || item.deviceBrand || 'General';
    const partName = item.partName || item.name || 'Repair Part';
    const sku = item.sku || `SKU-${brand.slice(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Mutate back for consistency
    item.unitPriceNaira = unitPrice;
    item.priceNaira = unitPrice;
    item.quantityOnHand = onHand;
    item.inStockCount = onHand;
    item.stockQuantity = onHand;
    item.quantityReserved = reserved;
    item.quantityAvailable = available;
    item.status = status;
    item.priceVersion = priceVersion;
    item.priceHistory = priceHistory;
    item.compatibleModels = compatibleModels;
    item.brand = brand;
    item.deviceBrand = brand;
    item.partName = partName;
    item.name = partName;
    item.sku = sku;
    item.currency = 'NGN';

    return item as TechnicianInventoryItem;
  }

  /**
   * Retrieve all inventory items belonging to a technician
   */
  public static getInventoryByTechnician(
    technicianId: string,
    filters?: {
      search?: string;
      brand?: string;
      category?: string;
      status?: string;
      deviceModel?: string;
    }
  ): TechnicianInventoryItem[] {
    let items = db.technicianParts.filter((p) => p.technicianId === technicianId);

    // Normalize all items
    items = items.map((i) => this.normalizeItem(i));

    if (!filters) return items;

    if (isNonEmptyString(filters.search)) {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (i) =>
          i.partName.toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.compatibleModels.some((m) => m.toLowerCase().includes(q))
      );
    }

    if (isNonEmptyString(filters.brand) && filters.brand !== 'ALL') {
      items = items.filter((i) => i.brand.toLowerCase() === filters.brand!.toLowerCase() || i.brand === 'All');
    }

    if (isNonEmptyString(filters.category) && filters.category !== 'ALL') {
      items = items.filter((i) => i.category.toLowerCase() === filters.category!.toLowerCase());
    }

    if (isNonEmptyString(filters.status) && filters.status !== 'ALL') {
      items = items.filter((i) => i.status === filters.status);
    }

    if (isNonEmptyString(filters.deviceModel) && filters.deviceModel !== 'ALL') {
      const targetModel = filters.deviceModel.toLowerCase();
      items = items.filter(
        (i) =>
          i.compatibleModels.some((m) => m.toLowerCase() === targetModel || m.toLowerCase() === 'all models' || m.toLowerCase() === 'all') ||
          targetModel.includes(i.brand.toLowerCase())
      );
    }

    return items;
  }

  /**
   * Get single inventory item by ID
   */
  public static getInventoryItemById(id: string): TechnicianInventoryItem | null {
    const item = db.technicianParts.find((p) => p.id === id);
    if (!item) return null;
    return this.normalizeItem(item);
  }

  /**
   * Create a new inventory item for a technician
   */
  public static createInventoryItem(
    technicianId: string,
    data: {
      partName?: string;
      name?: string;
      category?: string;
      brand?: string;
      deviceBrand?: string;
      compatibleModels?: string[] | string;
      deviceModel?: string;
      quality?: PartsQuality;
      sku?: string;
      unitPriceNaira?: number;
      priceNaira?: number;
      quantityOnHand?: number;
      inStockCount?: number;
      stockQuantity?: number;
      warrantyDays?: number;
      supplier?: string;
      photoUrl?: string;
      notes?: string;
    }
  ): { success: true; item: TechnicianInventoryItem } | { success: false; error: string } {
    const rawName = data.partName || data.name;
    if (!isNonEmptyString(rawName)) {
      return { success: false, error: 'Part name is required.' };
    }

    const priceInput = data.unitPriceNaira !== undefined ? data.unitPriceNaira : data.priceNaira;
    const priceVal = validateNumber(priceInput, 'Unit price', { min: 0, max: 10_000_000 });
    if (priceVal.valid === false) return { success: false, error: priceVal.error };

    const stockInput = data.quantityOnHand !== undefined ? data.quantityOnHand : (data.inStockCount !== undefined ? data.inStockCount : data.stockQuantity);
    const stockVal = validateNumber(stockInput !== undefined ? stockInput : 1, 'Quantity on hand', { min: 0, max: 10_000, integerOnly: true });
    if (stockVal.valid === false) return { success: false, error: stockVal.error };

    const warrantyVal = validateNumber(data.warrantyDays !== undefined ? data.warrantyDays : 60, 'Warranty days', { min: 0, max: 365, integerOnly: true });
    if (warrantyVal.valid === false) return { success: false, error: warrantyVal.error };

    const allowedQualities: PartsQuality[] = [
      'ORIGINAL_MANUFACTURER',
      'ORIGINAL_OEM',
      'OEM',
      'PREMIUM_AFTERMARKET',
      'STANDARD_AFTERMARKET',
      'USED_REFURBISHED',
      'REFURBISHED',
      'UNKNOWN',
    ];
    const quality: PartsQuality = data.quality && allowedQualities.includes(data.quality) ? data.quality : 'PREMIUM_AFTERMARKET';

    const brand = sanitizeString(data.brand || data.deviceBrand || 'General', 80);
    const category = sanitizeString(data.category || 'Display / Screen', 80);
    const supplier = data.supplier ? sanitizeString(data.supplier, 120) : undefined;
    const notes = data.notes ? sanitizeString(data.notes, 500) : undefined;
    const photoUrl = data.photoUrl ? sanitizeString(data.photoUrl, 500) : undefined;

    let models: string[] = [];
    if (Array.isArray(data.compatibleModels)) {
      models = data.compatibleModels.map((m) => sanitizeString(m, 80)).filter(Boolean);
    } else if (typeof data.compatibleModels === 'string' && data.compatibleModels.trim().length > 0) {
      models = data.compatibleModels.split(',').map((m) => sanitizeString(m.trim(), 80)).filter(Boolean);
    } else if (data.deviceModel) {
      models = [sanitizeString(data.deviceModel, 80)];
    }
    if (models.length === 0) models = ['All Models'];

    const skuPrefix = brand.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PART';
    const categoryPrefix = category.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'GEN';
    const autoSku = data.sku && isNonEmptyString(data.sku)
      ? sanitizeString(data.sku, 40).toUpperCase()
      : `SKU-${skuPrefix}-${categoryPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    const now = new Date().toISOString();
    const itemId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newItem: TechnicianInventoryItem = {
      id: itemId,
      inventoryItemId: itemId,
      technicianId,
      partName: sanitizeString(rawName, 150),
      name: sanitizeString(rawName, 150),
      category,
      brand,
      deviceBrand: brand,
      compatibleModels: models,
      deviceModel: models[0] || 'All Models',
      quality,
      sku: autoSku,
      unitPriceNaira: priceVal.value,
      priceNaira: priceVal.value,
      currency: 'NGN',
      quantityOnHand: stockVal.value,
      inStockCount: stockVal.value,
      stockQuantity: stockVal.value,
      quantityReserved: 0,
      quantityAvailable: stockVal.value,
      warrantyDays: warrantyVal.value,
      status: stockVal.value > 0 ? (stockVal.value <= 2 ? 'LOW_STOCK' : 'IN_STOCK') : 'OUT_OF_STOCK',
      priceVersion: 1,
      priceHistory: [
        {
          priceNaira: priceVal.value,
          version: 1,
          changedAt: now,
          reason: 'Initial inventory registration',
          changedBy: technicianId,
        },
      ],
      partsUsedCount: 0,
      supplier,
      photoUrl,
      notes,
      createdAt: now,
      updatedAt: now,
    };

    db.technicianParts.push(newItem);

    AuditService.log({
      actorId: technicianId,
      actorRole: 'technician',
      action: 'INVENTORY_ITEM_CREATED',
      resourceType: 'TECHNICIAN_INVENTORY',
      resourceId: itemId,
      details: {
        partName: newItem.partName,
        sku: newItem.sku,
        unitPriceNaira: newItem.unitPriceNaira,
        quantityOnHand: newItem.quantityOnHand,
        quality: newItem.quality,
      },
    });

    db.save();
    return { success: true, item: newItem };
  }

  /**
   * Update an existing inventory item (handles price changes, stock changes, etc.)
   */
  public static updateInventoryItem(
    itemId: string,
    technicianId: string,
    updates: {
      partName?: string;
      category?: string;
      brand?: string;
      compatibleModels?: string[] | string;
      quality?: PartsQuality;
      sku?: string;
      unitPriceNaira?: number;
      priceNaira?: number;
      priceChangeReason?: string;
      quantityOnHand?: number;
      inStockCount?: number;
      warrantyDays?: number;
      supplier?: string;
      notes?: string;
      photoUrl?: string;
      status?: InventoryItemStatus;
    }
  ): { success: true; item: TechnicianInventoryItem } | { success: false; error: string } {
    const rawIndex = db.technicianParts.findIndex((p) => p.id === itemId);
    if (rawIndex === -1) {
      return { success: false, error: 'Inventory item not found.' };
    }

    const existing = this.normalizeItem(db.technicianParts[rawIndex]);
    if (existing.technicianId !== technicianId) {
      return { success: false, error: 'Forbidden: You do not own this inventory record.' };
    }

    const now = new Date().toISOString();

    // 1. Check for price update
    const newPriceInput = updates.unitPriceNaira !== undefined ? updates.unitPriceNaira : updates.priceNaira;
    if (newPriceInput !== undefined) {
      const priceVal = validateNumber(newPriceInput, 'Unit price', { min: 0, max: 10_000_000 });
      if (priceVal.valid === false) return { success: false, error: priceVal.error };

      if (priceVal.value !== existing.unitPriceNaira) {
        const nextVersion = (existing.priceVersion || 1) + 1;
        const historyEntry: InventoryPriceHistoryItem = {
          priceNaira: priceVal.value,
          version: nextVersion,
          changedAt: now,
          reason: sanitizeString(updates.priceChangeReason || 'Price adjusted by technician', 200),
          changedBy: technicianId,
        };

        existing.priceVersion = nextVersion;
        existing.priceHistory.push(historyEntry);

        AuditService.log({
          actorId: technicianId,
          actorRole: 'technician',
          action: 'INVENTORY_PRICE_UPDATED',
          resourceType: 'TECHNICIAN_INVENTORY',
          resourceId: existing.id,
          details: {
            partName: existing.partName,
            sku: existing.sku,
            previousPrice: existing.unitPriceNaira,
            newPrice: priceVal.value,
            version: nextVersion,
            reason: historyEntry.reason,
          },
        });

        existing.unitPriceNaira = priceVal.value;
        existing.priceNaira = priceVal.value;
      }
    }

    // 2. Check for stock changes
    const newStockInput = updates.quantityOnHand !== undefined ? updates.quantityOnHand : updates.inStockCount;
    if (newStockInput !== undefined) {
      const stockVal = validateNumber(newStockInput, 'Quantity on hand', { min: 0, max: 10_000, integerOnly: true });
      if (stockVal.valid === false) return { success: false, error: stockVal.error };

      if (stockVal.value < existing.quantityReserved) {
        return {
          success: false,
          error: `Cannot reduce stock to ${stockVal.value}: ${existing.quantityReserved} unit(s) are currently reserved for active bookings.`,
        };
      }

      existing.quantityOnHand = stockVal.value;
      existing.inStockCount = stockVal.value;
      existing.stockQuantity = stockVal.value;
    }

    // 3. Update descriptive fields if provided
    if (isNonEmptyString(updates.partName)) {
      existing.partName = sanitizeString(updates.partName, 150);
      existing.name = existing.partName;
    }
    if (isNonEmptyString(updates.category)) existing.category = sanitizeString(updates.category, 80);
    if (isNonEmptyString(updates.brand)) {
      existing.brand = sanitizeString(updates.brand, 80);
      existing.deviceBrand = existing.brand;
    }
    if (updates.quality) existing.quality = updates.quality;
    if (isNonEmptyString(updates.sku)) existing.sku = sanitizeString(updates.sku, 40).toUpperCase();
    if (updates.warrantyDays !== undefined) {
      const wVal = validateNumber(updates.warrantyDays, 'Warranty days', { min: 0, max: 365, integerOnly: true });
      if (wVal.valid) existing.warrantyDays = wVal.value;
    }
    if (updates.supplier !== undefined) existing.supplier = sanitizeString(updates.supplier, 120);
    if (updates.notes !== undefined) existing.notes = sanitizeString(updates.notes, 500);
    if (updates.photoUrl !== undefined) existing.photoUrl = sanitizeString(updates.photoUrl, 500);

    if (updates.compatibleModels !== undefined) {
      if (Array.isArray(updates.compatibleModels)) {
        existing.compatibleModels = updates.compatibleModels.map((m) => sanitizeString(m, 80)).filter(Boolean);
      } else if (typeof updates.compatibleModels === 'string') {
        existing.compatibleModels = updates.compatibleModels.split(',').map((m) => sanitizeString(m.trim(), 80)).filter(Boolean);
      }
      if (existing.compatibleModels.length === 0) existing.compatibleModels = ['All Models'];
      existing.deviceModel = existing.compatibleModels[0];
    }

    // 4. Recalculate available stock and status
    existing.quantityAvailable = Math.max(0, existing.quantityOnHand - existing.quantityReserved);
    if (existing.quantityOnHand <= 0 || existing.quantityAvailable <= 0) {
      existing.status = 'OUT_OF_STOCK';
    } else if (existing.quantityAvailable <= 2) {
      existing.status = 'LOW_STOCK';
    } else {
      existing.status = updates.status && updates.status !== 'OUT_OF_STOCK' ? updates.status : 'IN_STOCK';
    }

    existing.updatedAt = now;
    db.technicianParts[rawIndex] = existing;
    db.save();

    return { success: true, item: existing };
  }

  /**
   * Server-authoritative quote validation and snapshot creation.
   * Converts requested inventory items into immutable QuoteLineItem snapshots.
   */
  public static validateAndBuildQuoteLineItems(
    technicianId: string,
    rawItems: Array<{ inventoryItemId?: string; id?: string; quantity?: number }>,
    request: RepairRequest
  ):
    | {
        valid: true;
        items: QuoteLineItem[];
        totalPartsCost: number;
        predominantQuality: PartsQuality;
        maxWarrantyDays: number;
        priceAuditMetadata: {
          requestCreatedAt: string;
          quoteCreatedAt: string;
          flaggedForPriceManipulation: boolean;
          priceDeltas?: Array<{
            inventoryItemId: string;
            partName: string;
            previousPrice: number;
            quotedPrice: number;
            priceChangedAt: string;
          }>;
        };
      }
    | { valid: false; error: string } {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return { valid: false, error: 'At least one inventory part must be selected for the quote.' };
    }

    const lineItems: QuoteLineItem[] = [];
    let totalPartsCost = 0;
    let maxWarrantyDays = 30;
    const qualities: PartsQuality[] = [];
    const priceDeltas: Array<{
      inventoryItemId: string;
      partName: string;
      previousPrice: number;
      quotedPrice: number;
      priceChangedAt: string;
    }> = [];
    let flaggedForPriceManipulation = false;

    const reqCreatedTime = new Date(request.createdAt).getTime();

    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      const targetId = raw.inventoryItemId || raw.id;

      if (!isNonEmptyString(targetId)) {
        return { valid: false, error: `Line item #${i + 1} is missing an inventoryItemId.` };
      }

      const invItem = this.getInventoryItemById(targetId!);
      if (!invItem) {
        return { valid: false, error: `Inventory item ${targetId} was not found in database.` };
      }

      if (invItem.technicianId !== technicianId) {
        return {
          valid: false,
          error: `Security Violation: Inventory item "${invItem.partName}" (${invItem.sku}) does not belong to your technician profile.`,
        };
      }

      const qty = typeof raw.quantity === 'number' && raw.quantity >= 1 ? Math.floor(raw.quantity) : 1;
      const available = Math.max(0, invItem.quantityOnHand - invItem.quantityReserved);

      if (qty > available) {
        return {
          valid: false,
          error: `Insufficient stock for "${invItem.partName}". Requested: ${qty}, currently available: ${available} (On hand: ${invItem.quantityOnHand}, Reserved: ${invItem.quantityReserved}).`,
        };
      }

      // Check for price manipulation: Was the price changed after the customer requested the repair?
      if (Array.isArray(invItem.priceHistory) && invItem.priceHistory.length > 1) {
        for (const history of invItem.priceHistory) {
          const changeTime = new Date(history.changedAt).getTime();
          if (changeTime > reqCreatedTime && history.version === invItem.priceVersion) {
            // Price was adjusted after request was published
            const previous = invItem.priceHistory.find((h) => h.version === history.version - 1);
            if (previous && invItem.unitPriceNaira > previous.priceNaira) {
              flaggedForPriceManipulation = true;
              priceDeltas.push({
                inventoryItemId: invItem.id,
                partName: invItem.partName,
                previousPrice: previous.priceNaira,
                quotedPrice: invItem.unitPriceNaira,
                priceChangedAt: history.changedAt,
              });
            }
          }
        }
      }

      const subtotal = invItem.unitPriceNaira * qty;
      totalPartsCost += subtotal;
      qualities.push(invItem.quality);
      if (invItem.warrantyDays > maxWarrantyDays) {
        maxWarrantyDays = invItem.warrantyDays;
      }

      const lineItem: QuoteLineItem = {
        id: `qli_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        inventoryItemId: invItem.id,
        partNameSnapshot: invItem.partName,
        qualitySnapshot: invItem.quality,
        unitPriceSnapshot: invItem.unitPriceNaira,
        priceVersion: invItem.priceVersion || 1,
        quantity: qty,
        subtotal,
        skuSnapshot: invItem.sku,
        brandSnapshot: invItem.brand,
        categorySnapshot: invItem.category,
        warrantyDaysSnapshot: invItem.warrantyDays,
      };

      lineItems.push(lineItem);
    }

    // Determine predominant parts quality
    let predominantQuality: PartsQuality = 'PREMIUM_AFTERMARKET';
    if (qualities.includes('ORIGINAL_OEM') || qualities.includes('ORIGINAL_MANUFACTURER')) {
      predominantQuality = 'ORIGINAL_OEM';
    } else if (qualities.includes('OEM')) {
      predominantQuality = 'OEM';
    } else if (qualities.includes('PREMIUM_AFTERMARKET')) {
      predominantQuality = 'PREMIUM_AFTERMARKET';
    } else if (qualities.includes('STANDARD_AFTERMARKET')) {
      predominantQuality = 'STANDARD_AFTERMARKET';
    } else if (qualities.includes('REFURBISHED') || qualities.includes('USED_REFURBISHED')) {
      predominantQuality = 'REFURBISHED';
    }

    if (flaggedForPriceManipulation) {
      AuditService.log({
        actorId: technicianId,
        actorRole: 'technician',
        action: 'PRICE_MANIPULATION_FLAGGED',
        resourceType: 'REPAIR_QUOTE',
        resourceId: request.id,
        details: {
          requestId: request.id,
          requestCreatedAt: request.createdAt,
          priceDeltas,
        },
      });
    }

    return {
      valid: true,
      items: lineItems,
      totalPartsCost,
      predominantQuality,
      maxWarrantyDays,
      priceAuditMetadata: {
        requestCreatedAt: request.createdAt,
        quoteCreatedAt: new Date().toISOString(),
        flaggedForPriceManipulation,
        priceDeltas: priceDeltas.length > 0 ? priceDeltas : undefined,
      },
    };
  }

  /**
   * Reserve stock in technician inventory when a customer accepts a quote
   */
  public static reserveStockForQuote(quote: RepairQuote, jobId: string): void {
    if (!Array.isArray(quote.items) || quote.items.length === 0) return;

    for (const item of quote.items) {
      const rawIndex = db.technicianParts.findIndex((p) => p.id === item.inventoryItemId && p.technicianId === quote.technicianId);
      if (rawIndex !== -1) {
        const inv = this.normalizeItem(db.technicianParts[rawIndex]);
        inv.quantityReserved = (inv.quantityReserved || 0) + item.quantity;
        inv.quantityAvailable = Math.max(0, inv.quantityOnHand - inv.quantityReserved);
        if (inv.quantityAvailable <= 0) {
          inv.status = 'OUT_OF_STOCK';
        } else if (inv.quantityAvailable <= 2) {
          inv.status = 'LOW_STOCK';
        }

        inv.updatedAt = new Date().toISOString();
        db.technicianParts[rawIndex] = inv;

        AuditService.log({
          actorId: quote.technicianId,
          actorRole: 'technician',
          action: 'INVENTORY_RESERVED',
          resourceType: 'TECHNICIAN_INVENTORY',
          resourceId: inv.id,
          details: {
            jobId,
            quoteId: quote.id,
            sku: inv.sku,
            partName: inv.partName,
            reservedQuantity: item.quantity,
            totalReserved: inv.quantityReserved,
            remainingAvailable: inv.quantityAvailable,
          },
        });
      }
    }
    db.save();
  }

  /**
   * Release reserved stock when a quote is rejected, cancelled, or refunded
   */
  public static releaseStockForQuote(quote: RepairQuote, jobId?: string, reason = 'Quote declined / cancelled'): void {
    if (!Array.isArray(quote.items) || quote.items.length === 0) return;

    for (const item of quote.items) {
      const rawIndex = db.technicianParts.findIndex((p) => p.id === item.inventoryItemId && p.technicianId === quote.technicianId);
      if (rawIndex !== -1) {
        const inv = this.normalizeItem(db.technicianParts[rawIndex]);
        inv.quantityReserved = Math.max(0, (inv.quantityReserved || 0) - item.quantity);
        inv.quantityAvailable = Math.max(0, inv.quantityOnHand - inv.quantityReserved);
        if (inv.quantityOnHand <= 0 || inv.quantityAvailable <= 0) {
          inv.status = 'OUT_OF_STOCK';
        } else if (inv.quantityAvailable <= 2) {
          inv.status = 'LOW_STOCK';
        } else {
          inv.status = 'IN_STOCK';
        }

        inv.updatedAt = new Date().toISOString();
        db.technicianParts[rawIndex] = inv;

        AuditService.log({
          actorId: quote.technicianId,
          actorRole: 'technician',
          action: 'INVENTORY_RESERVATION_RELEASED',
          resourceType: 'TECHNICIAN_INVENTORY',
          resourceId: inv.id,
          details: {
            jobId,
            quoteId: quote.id,
            sku: inv.sku,
            releasedQuantity: item.quantity,
            remainingReserved: inv.quantityReserved,
            remainingAvailable: inv.quantityAvailable,
            reason,
          },
        });
      }
    }
    db.save();
  }

  /**
   * Deduct on-hand inventory and release reservation when technician installs part on bench
   */
  public static deductStockForInstalledPart(
    partRecord: PartUsedRecord,
    jobId: string,
    technicianId: string
  ): PartUsedRecord {
    const targetId = partRecord.inventoryItemId || partRecord.partId;
    const qty = partRecord.quantity || 1;

    if (targetId) {
      const rawIndex = db.technicianParts.findIndex((p) => p.id === targetId && p.technicianId === technicianId);
      if (rawIndex !== -1) {
        const inv = this.normalizeItem(db.technicianParts[rawIndex]);

        // Deduct from on hand
        inv.quantityOnHand = Math.max(0, inv.quantityOnHand - qty);
        inv.inStockCount = inv.quantityOnHand;
        inv.stockQuantity = inv.quantityOnHand;

        // Deduct reservation if it was reserved
        if (inv.quantityReserved > 0) {
          inv.quantityReserved = Math.max(0, inv.quantityReserved - qty);
        }

        inv.partsUsedCount = (inv.partsUsedCount || 0) + qty;
        inv.quantityAvailable = Math.max(0, inv.quantityOnHand - inv.quantityReserved);

        if (inv.quantityOnHand <= 0 || inv.quantityAvailable <= 0) {
          inv.status = 'OUT_OF_STOCK';
        } else if (inv.quantityAvailable <= 2) {
          inv.status = 'LOW_STOCK';
        }

        inv.updatedAt = new Date().toISOString();
        db.technicianParts[rawIndex] = inv;

        // Enrich part record with authoritative snapshot details
        partRecord.inventoryItemId = inv.id;
        partRecord.sku = inv.sku;
        partRecord.priceNaira = inv.unitPriceNaira;
        partRecord.unitPriceSnapshot = inv.unitPriceNaira;
        partRecord.warrantyDays = inv.warrantyDays;
        partRecord.quality = inv.quality;
        partRecord.supplier = inv.supplier || inv.brand;
        partRecord.technicianId = technicianId;

        AuditService.log({
          actorId: technicianId,
          actorRole: 'technician',
          action: 'PART_INSTALLED',
          resourceType: 'TECHNICIAN_INVENTORY',
          resourceId: inv.id,
          details: {
            jobId,
            partUsedId: partRecord.id,
            sku: inv.sku,
            installedQuantity: qty,
            remainingOnHand: inv.quantityOnHand,
            remainingAvailable: inv.quantityAvailable,
          },
        });
      }
    }

    db.save();
    return partRecord;
  }
}
