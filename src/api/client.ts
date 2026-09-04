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

    const data = await response.json();

    if (!response.ok) {
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

  // Devices
  public static getBrands() {
    return this.request<any[]>('/devices/brands');
  }

  public static getModels(brandId?: string) {
    return this.request<any[]>(`/devices/models${brandId ? `?brandId=${brandId}` : ''}`);
  }

  public static getIssues() {
    return this.request<any[]>('/devices/issues');
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
