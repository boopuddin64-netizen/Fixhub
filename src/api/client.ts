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
  public static getBrands(deviceType?: DeviceType) {
    return this.request<DeviceBrand[]>(`/devices/brands${deviceType ? `?deviceType=${deviceType}` : ''}`);
  }

  public static getFamilies(brandId?: string, deviceType?: DeviceType) {
    const params = new URLSearchParams();
    if (brandId) params.append('brandId', brandId);
    if (deviceType) params.append('deviceType', deviceType);
    const qs = params.toString();
    return this.request<DeviceFamily[]>(`/devices/families${qs ? `?${qs}` : ''}`);
  }

  public static getModels(params?: {
    brandId?: string;
    familyId?: string;
    deviceType?: DeviceType;
    search?: string;
    popular?: boolean;
  }) {
    const query = new URLSearchParams();
    if (params?.brandId) query.append('brandId', params.brandId);
    if (params?.familyId) query.append('familyId', params.familyId);
    if (params?.deviceType) query.append('deviceType', params.deviceType);
    if (params?.search) query.append('search', params.search);
    if (params?.popular) query.append('popular', 'true');
    const qs = query.toString();
    return this.request<DeviceModel[]>(`/devices/models${qs ? `?${qs}` : ''}`);
  }

  public static searchDevices(q: string, deviceType?: DeviceType) {
    const params = new URLSearchParams({ q });
    if (deviceType) params.append('deviceType', deviceType);
    return this.request<{ brands: DeviceBrand[]; models: DeviceModel[] }>(`/devices/search?${params.toString()}`);
  }

  public static getIssues() {
    return this.request<RepairIssueOption[]>('/devices/issues');
  }

  public static getIssuesCatalog(category?: string) {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request<RepairIssue[]>(`/repairs/issues${qs}`);
  }

  // Customer Saved Devices
  public static getCustomerDevices() {
    return this.request<CustomerDevice[]>('/customer/devices');
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
  public static getTechnicians() {
    return this.request<any[]>('/technicians');
  }

  public static getTechnician(id: string) {
    return this.request<any>(`/technicians/${id}`);
  }

  public static matchTechnicians(data: any) {
    return this.request<any[]>('/technicians/match', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static setTechnicianAvailability(status: string) {
    return this.request<any>('/technicians/availability', {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  public static updateTechnicianProfile(data: any) {
    return this.request<any>('/technicians/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
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

  public static getRepairRequests() {
    return this.request<any[]>('/repairs/requests');
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

  public static acceptQuote(requestId: string, quoteId: string) {
    return this.request<any>('/quotes/accept', {
      method: 'POST',
      body: JSON.stringify({ requestId, quoteId }),
    });
  }

  // Payments
  public static createPaymentIntent(repairJobId: string, idempotencyKey: string, paymentMethod = 'CARD') {
    return this.request<any>('/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ repairJobId, idempotencyKey, paymentMethod }),
    });
  }

  public static verifyMockPayment(paymentId: string, transactionRef: string) {
    return this.request<any>('/payments/verify-mock', {
      method: 'POST',
      body: JSON.stringify({ paymentId, transactionRef }),
    });
  }

  // Jobs
  public static getJobs() {
    return this.request<any[]>('/jobs');
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

  public static confirmJobCompletion(jobId: string) {
    return this.request<any>(`/jobs/${jobId}/confirm-completion`, {
      method: 'POST',
    });
  }

  // Reviews
  public static submitReview(data: { repairId: string; rating: number; comment: string }) {
    return this.request<any>('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static getTechnicianReviews(techId: string) {
    return this.request<any[]>(`/reviews/technician/${techId}`);
  }

  // Parts
  public static getTechnicianParts(techId: string) {
    return this.request<any[]>(`/parts/technician/${techId}`);
  }

  public static addTechnicianPart(data: any) {
    return this.request<any>('/parts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Warranties
  public static getMyWarranties() {
    return this.request<any[]>('/warranties/my-warranties');
  }

  // Notifications
  public static getNotifications() {
    return this.request<any[]>('/notifications');
  }

  public static markNotificationRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, { method: 'POST' });
  }

  public static markAllNotificationsRead() {
    return this.request<any>('/notifications/read-all', { method: 'POST' });
  }

  // Messages
  public static getMessages(repairId: string) {
    return this.request<any[]>(`/messages/${repairId}`);
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
