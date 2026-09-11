import {
  DeviceBrand,
  DeviceFamily,
  DeviceModel,
  CustomerDevice,
  DeviceType,
  RepairIssueOption,
  RepairIssue,
  RepairRequestDraft,
  RepairRequestAttachment,
  RepairQuote,
  TechnicianInventoryItem,
  InventoryPriceHistoryItem,
} from '../types/index';

const API_BASE = '/api';

export class ApiClient {
  private static getToken(): string | null {
    return localStorage.getItem('fixhub_token');
  }

  public static setToken(token: string) {
    localStorage.setItem('fixhub_token', token);
  }

  public static removeToken() {
    localStorage.removeItem('fixhub_token');
    localStorage.removeItem('fixhub_borrowed_mode');
  }

  public static isBorrowedDevice(): boolean {
    return localStorage.getItem('fixhub_borrowed_mode') === 'true';
  }

  public static setBorrowedDevice(isBorrowed: boolean) {
    if (isBorrowed) {
      localStorage.setItem('fixhub_borrowed_mode', 'true');
    } else {
      localStorage.removeItem('fixhub_borrowed_mode');
    }
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        ApiClient.removeToken();
      }
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }

    return data as T;
  }

  // Auth
  public static login(emailOrPhone: string, password?: string, isBorrowedDevice = false) {
    return this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, password, isBorrowedDevice }),
    });
  }

  public static registerCustomer(data: any) {
    return this.request<any>('/auth/register-customer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static registerTechnician(data: any) {
    return this.request<any>('/auth/register-technician', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static getMe() {
    return this.request<any>('/auth/me');
  }

  // Devices & Catalog
  public static async getBrands(deviceType?: DeviceType): Promise<DeviceBrand[]> {
    try {
      const res = await this.request<any>(`/devices/brands${deviceType ? `?deviceType=${deviceType}` : ''}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static async getFamilies(brandId?: string, deviceType?: DeviceType): Promise<DeviceFamily[]> {
    try {
      const params = new URLSearchParams();
      if (brandId) params.append('brandId', brandId);
      if (deviceType) params.append('deviceType', deviceType);
      const qs = params.toString();
      const res = await this.request<any>(`/devices/families${qs ? `?${qs}` : ''}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static async getModels(params?: {
    brandId?: string;
    familyId?: string;
    deviceType?: DeviceType;
    search?: string;
    popular?: boolean;
  }): Promise<DeviceModel[]> {
    try {
      const query = new URLSearchParams();
      if (params?.brandId) query.append('brandId', params.brandId);
      if (params?.familyId) query.append('familyId', params.familyId);
      if (params?.deviceType) query.append('deviceType', params.deviceType);
      if (params?.search) query.append('search', params.search);
      if (params?.popular) query.append('popular', 'true');
      const qs = query.toString();
      const res = await this.request<any>(`/devices/models${qs ? `?${qs}` : ''}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static async searchDevices(q: string, deviceType?: DeviceType): Promise<{ brands: DeviceBrand[]; models: DeviceModel[] }> {
    try {
      const params = new URLSearchParams({ q });
      if (deviceType) params.append('deviceType', deviceType);
      const res = await this.request<any>(`/devices/search?${params.toString()}`);
      return {
        brands: Array.isArray(res?.brands) ? res.brands : [],
        models: Array.isArray(res?.models) ? res.models : [],
      };
    } catch {
      return { brands: [], models: [] };
    }
  }

  public static async getIssues(): Promise<RepairIssueOption[]> {
    try {
      const res = await this.request<any>('/devices/issues');
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static async getIssuesCatalog(category?: string): Promise<RepairIssue[]> {
    try {
      const qs = category ? `?category=${encodeURIComponent(category)}` : '';
      const res = await this.request<any>(`/repairs/issues${qs}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  // Customer Saved Devices
  public static async getCustomerDevices(): Promise<CustomerDevice[]> {
    try {
      const res = await this.request<any>('/customer/devices');
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static addCustomerDevice(data: {
    brandName: string;
    modelName: string;
    deviceModelId?: string;
    deviceType?: DeviceType;
    nickname?: string;
    color?: string;
    storage?: string;
    isPrimary?: boolean;
    catalogMatch?: boolean;
  }) {
    return this.request<CustomerDevice>('/customer/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static updateCustomerDevice(
    id: string,
    data: {
      nickname?: string;
      color?: string;
      storage?: string;
      isPrimary?: boolean;
    }
  ) {
    return this.request<CustomerDevice>(`/customer/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static setPrimaryCustomerDevice(id: string) {
    return this.request<CustomerDevice>(`/customer/devices/${id}/primary`, {
      method: 'POST',
    });
  }

  public static deleteCustomerDevice(id: string) {
    return this.request<{ success: boolean; message: string }>(`/customer/devices/${id}`, {
      method: 'DELETE',
    });
  }

  // Technicians
  public static async getTechnicians(): Promise<any[]> {
    try {
      const res = await this.request<any>('/technicians');
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static getTechnician(id: string) {
    return this.request<any>(`/technicians/${id}`);
  }

  public static async matchTechnicians(data: any): Promise<any[]> {
    try {
      const res = await this.request<any>('/technicians/match', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static setTechnicianAvailability(status: string) {
    return this.request<any>('/technicians/availability', {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  public static updateCustomerProfile(data: any) {
    return this.request<any>('/customer/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static updateTechnicianProfile(data: any) {
    return this.request<any>('/technicians/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static updateRepairRequestLocation(id: string, customerLocation: any) {
    return this.request<any>(`/repairs/requests/${id}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ customerLocation }),
    });
  }

  // Repair Drafts
  public static getRepairDraft() {
    return this.request<RepairRequestDraft | null>('/repairs/draft');
  }

  public static saveRepairDraft(draft: Partial<RepairRequestDraft>) {
    return this.request<RepairRequestDraft>('/repairs/draft', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
  }

  public static deleteRepairDraft() {
    return this.request<{ success: boolean; message: string }>('/repairs/draft', {
      method: 'DELETE',
    });
  }

  public static uploadAttachment(data: {
    fileData: string;
    type: 'IMAGE' | 'AUDIO';
    mimeType?: string;
    size?: number;
    durationSeconds?: number;
  }) {
    return this.request<RepairRequestAttachment>('/repairs/attachments/upload', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Repair Requests
  public static createRepairRequest(data: any) {
    return this.request<any>('/repairs/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getRepairRequests(): Promise<any[]> {
    try {
      const res = await this.request<any>('/repairs/requests');
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.requests)) return res.requests;
      if (res && Array.isArray(res.data)) return res.data;
      return [];
    } catch {
      return [];
    }
  }

  public static getRepairRequest(id: string) {
    return this.request<any>(`/repairs/requests/${id}`);
  }

  // Quotes
  public static submitQuote(data: any) {
    return this.request<any>('/quotes/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static getQuotesForRequest(requestId: string) {
    return this.request<RepairQuote[]>(`/repairs/requests/${requestId}/quotes`);
  }

  public static getMyQuotes() {
    return this.request<any[]>('/quotes/my-quotes');
  }

  public static withdrawQuote(quoteId: string) {
    return this.request<{ success: boolean; quote: RepairQuote }>(`/quotes/${quoteId}/withdraw`, {
      method: 'POST',
    });
  }

  public static rejectQuote(quoteId: string) {
    return this.request<{ success: boolean; quote: RepairQuote }>(`/quotes/${quoteId}/reject`, {
      method: 'POST',
    });
  }

  public static acceptQuote(requestId: string, quoteId: string) {
    return this.request<any>('/quotes/accept', {
      method: 'POST',
      body: JSON.stringify({ requestId, quoteId }),
    });
  }

  // Payments & Financial Architecture (Phase 5)
  public static initializePayment(repairJobId: string, idempotencyKey: string, paymentMethod = 'CARD') {
    return this.request<{
      success: boolean;
      payment: any;
      authorizationUrl?: string;
      accessCode?: string;
      reference: string;
      isExisting: boolean;
      error?: string;
    }>('/payments/initialize', {
      method: 'POST',
      body: JSON.stringify({ repairJobId, idempotencyKey, paymentMethod }),
    });
  }

  public static verifyPayment(params: { reference?: string; paymentId?: string }) {
    return this.request<{
      success: boolean;
      payment: any;
      alreadyVerified?: boolean;
      error?: string;
    }>('/payments/verify', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  public static recordRefund(paymentId: string, reason: string, amountNaira?: number) {
    return this.request<{ success: boolean; refund?: any; error?: string }>('/payments/refund', {
      method: 'POST',
      body: JSON.stringify({ paymentId, reason, amountNaira }),
    });
  }

  public static getTechnicianEarnings() {
    return this.request<{
      earnings: any[];
      payouts: any[];
      summary: {
        heldEarningsNaira: number;
        availablePayoutNaira: number;
        lockedInProcessingNaira: number;
        totalCompletedPayoutsNaira: number;
        commissionRatePercent: number;
      };
    }>('/technicians/earnings');
  }

  public static getBanks() {
    return this.request<{ name: string; code: string; slug?: string }[]>('/banks');
  }

  public static requestPayout(amountNaira: number, destinationAccount?: any) {
    return this.request<{
      success: boolean;
      payout?: any;
      eligibleBalanceNaira?: number;
      error?: string;
    }>('/technicians/payouts/request', {
      method: 'POST',
      body: JSON.stringify({ amountNaira, destinationAccount }),
    });
  }

  // Jobs
  public static async getJobs(): Promise<any[]> {
    try {
      const res = await this.request<any>('/jobs');
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.jobs)) return res.jobs;
      if (res && Array.isArray(res.data)) return res.data;
      return [];
    } catch {
      return [];
    }
  }

  public static getJob(id: string) {
    return this.request<any>(`/jobs/${id}`);
  }

  public static checkInDevice(jobId: string, report: any) {
    return this.request<any>(`/jobs/${jobId}/check-in`, {
      method: 'POST',
      body: JSON.stringify({ report }),
    });
  }

  public static updateJobStatus(jobId: string, newStatus: string, note?: string) {
    return this.request<any>(`/jobs/${jobId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ newStatus, note }),
    });
  }

  public static addPartUsed(jobId: string, part: any) {
    return this.request<any>(`/jobs/${jobId}/add-part`, {
      method: 'POST',
      body: JSON.stringify(part),
    });
  }

  public static submitAdditionalDiagnosis(jobId: string, data: any) {
    return this.request<any>(`/jobs/${jobId}/additional-diagnosis`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static respondToAdditionalDiagnosis(jobId: string, approved: boolean, reason?: string) {
    return this.request<{ success: boolean; job?: any; error?: string }>(`/jobs/${jobId}/additional-diagnosis/respond`, {
      method: 'POST',
      body: JSON.stringify({ approved, reason }),
    });
  }

  public static verifyDropOff(jobId: string, dropOffCode: string) {
    return this.request<{ success: boolean; job?: any; error?: string }>(`/jobs/${jobId}/verify-dropoff`, {
      method: 'POST',
      body: JSON.stringify({ dropOffCode }),
    });
  }

  public static verifyPickup(jobId: string, pickupCode: string) {
    return this.request<{ success: boolean; job?: any; error?: string }>(`/jobs/${jobId}/verify-pickup`, {
      method: 'POST',
      body: JSON.stringify({ pickupCode }),
    });
  }

  public static confirmJobCompletion(jobId: string) {
    return this.request<any>(`/jobs/${jobId}/confirm-completion`, {
      method: 'POST',
    });
  }

  public static disputeJob(jobId: string, reason: string) {
    return this.request<{ success: boolean; job?: any; error?: string }>(`/jobs/${jobId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public static cancelJob(jobId: string, reason?: string) {
    return this.request<{ success: boolean; job?: any; error?: string }>(`/jobs/${jobId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public static cancelRequest(requestId: string, reason?: string) {
    return this.request<{ success: boolean; request?: any; error?: string }>(`/repairs/requests/${requestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Reviews
  public static submitReview(data: { repairId: string; rating: number; comment: string }) {
    return this.request<any>('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getTechnicianReviews(techId: string): Promise<any[]> {
    try {
      const res = await this.request<any>(`/reviews/technician/${techId}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static async getMyReviews(): Promise<any[]> {
    try {
      const res = await this.request<any>('/reviews/my-reviews');
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  // Parts & Inventory (Phase 7)
  public static async getInventory(params?: {
    search?: string;
    brand?: string;
    category?: string;
    status?: string;
    deviceModel?: string;
  }): Promise<TechnicianInventoryItem[]> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.brand) query.append('brand', params.brand);
      if (params?.category) query.append('category', params.category);
      if (params?.status) query.append('status', params.status);
      if (params?.deviceModel) query.append('deviceModel', params.deviceModel);
      const qs = query.toString();
      const res = await this.request<any>(`/inventory${qs ? `?${qs}` : ''}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static addInventoryItem(data: Partial<TechnicianInventoryItem> & { name?: string; priceNaira?: number }) {
    return this.request<TechnicianInventoryItem>('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static updateInventoryItem(id: string, data: Partial<TechnicianInventoryItem> & { priceChangeReason?: string }) {
    return this.request<TechnicianInventoryItem>(`/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  public static getInventoryItem(id: string) {
    return this.request<TechnicianInventoryItem>(`/inventory/${id}`);
  }

  public static getInventoryPriceHistory(id: string) {
    return this.request<{
      itemId: string;
      partName: string;
      currentPrice: number;
      currentVersion: number;
      priceHistory: InventoryPriceHistoryItem[];
    }>(`/inventory/${id}/price-history`);
  }

  public static async getTechnicianParts(techId: string): Promise<any[]> {
    try {
      const res = await this.request<any>(`/parts/technician/${techId}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static addTechnicianPart(data: any) {
    return this.request<any>('/parts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Warranties
  public static async getMyWarranties(): Promise<any[]> {
    try {
      const res = await this.request<any>('/warranties/my-warranties');
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  // Notifications
  public static async getNotifications(): Promise<any[]> {
    try {
      const res = await this.request<any>('/notifications');
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.notifications)) return res.notifications;
      if (res && Array.isArray(res.data)) return res.data;
      return [];
    } catch {
      return [];
    }
  }

  public static async markNotificationRead(id: string): Promise<{ success: boolean }> {
    try {
      if (!id) return { success: true };
      const res = await this.request<any>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
      return res || { success: true };
    } catch (err) {
      console.warn(`[ApiClient] Failed to mark notification ${id} as read:`, err);
      return { success: false };
    }
  }

  public static async markAllNotificationsRead(): Promise<{ success: boolean; count?: number }> {
    try {
      const res = await this.request<any>('/notifications/read-all', { method: 'POST' });
      return res || { success: true };
    } catch (err) {
      console.warn('[ApiClient] Failed to mark all notifications as read:', err);
      return { success: false, count: 0 };
    }
  }

  // Messages
  public static async getMessages(repairId: string): Promise<any[]> {
    try {
      const res = await this.request<any>(`/messages/${repairId}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  public static sendMessage(repairId: string, text: string, attachmentUrl?: string) {
    return this.request<any>(`/messages/${repairId}`, {
      method: 'POST',
      body: JSON.stringify({ text, attachmentUrl }),
    });
  }

  // Dev
  public static resetSeed() {
    return this.request<any>('/dev/reset-seed', { method: 'POST' });
  }
}
