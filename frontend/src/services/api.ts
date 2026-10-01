let customServerUrl: string | null = null;

export const setCustomApiServer = (url: string) => {
  customServerUrl = url.replace(/\/+$/, '');
};

export const getApiBase = (): string => {
  if (customServerUrl) {
    return `${customServerUrl}/api`;
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'http://localhost:8000/api';
  }
  return '/api';
};

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'XMLHttpRequest');

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getApiBase()}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // sends and receives httpOnly cookies
  });

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || (typeof data === 'string' ? data : 'API Request Failed');
    throw new ApiError(response.status, errorMsg, data);
  }

  return data as T;
}

export const api = {
  checkHealth: () => request<any>('/health'),

  // Auth
  register: (payload: { username: string; email: string; password: string }) =>
    request<any>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  login: (payload: { username: string; password: string }) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

  logout: () =>
    request<any>('/auth/logout', { method: 'POST' }),

  getMe: () =>
    request<any>('/auth/me'),

  // Master Data
  getCategories: () =>
    request<any[]>('/categories'),

  createCategory: (payload: { name: string; description?: string }) =>
    request<any>('/categories', { method: 'POST', body: JSON.stringify(payload) }),

  getUnits: () =>
    request<any[]>('/units'),

  createUnit: (payload: { name: string; description?: string; allowDecimals?: boolean }) =>
    request<any>('/units', { method: 'POST', body: JSON.stringify(payload) }),

  getLocations: () =>
    request<any[]>('/locations'),

  createLocation: (payload: { name: string; description?: string }) =>
    request<any>('/locations', { method: 'POST', body: JSON.stringify(payload) }),

  // Items
  getItems: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<{ total: number; items: any[] }>(`/items?${query.toString()}`);
  },

  getItemById: (id: number) =>
    request<any>(`/items/${id}`),

  lookupBarcode: (barcode: string) =>
    request<any>(`/items/barcode/${encodeURIComponent(barcode)}`),

  lookupItemCode: (code: string) =>
    request<any>(`/items/code/${encodeURIComponent(code)}`),

  createItem: (payload: any) =>
    request<any>('/items', { method: 'POST', body: JSON.stringify(payload) }),

  updateItem: (id: number, payload: any) =>
    request<any>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteItem: (id: number) =>
    request<any>(`/items/${id}`, { method: 'DELETE' }),

  importItemsCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<any>('/items/import', { method: 'POST', body: formData });
  },

  // Stock
  stockIn: (payload: { itemId?: number; barcode?: string; quantity: number | string; remark?: string; idempotencyKey?: string }) =>
    request<any>('/stock/in', { method: 'POST', body: JSON.stringify(payload) }),

  getStockInHistory: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<{ total: number; items: any[] }>(`/stock/in?${query.toString()}`);
  },

  stockOut: (payload: { itemId?: number; barcode?: string; quantity: number | string; location: string; remark?: string; idempotencyKey?: string }) =>
    request<any>('/stock/out', { method: 'POST', body: JSON.stringify(payload) }),

  getStockOutHistory: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<{ total: number; items: any[] }>(`/stock/out?${query.toString()}`);
  },

  getMovements: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<{ total: number; items: any[] }>(`/stock/movements?${query.toString()}`);
  },

  // Dashboard & Reports
  getDashboardStats: () =>
    request<any>('/dashboard/stats'),

  getDashboardCharts: () =>
    request<any>('/dashboard/charts'),

  getReport: (reportName: string, params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<any>(`/reports/${reportName}?${query.toString()}`);
  },

  getReportExportUrl: (reportName: string, format: 'csv' | 'xlsx' | 'pdf', params: Record<string, any> = {}) => {
    const query = new URLSearchParams({ ...params, format });
    return `${getApiBase()}/reports/${reportName}?${query.toString()}`;
  },

  // Users Management (Admin)
  getUsers: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<{ total: number; items: any[] }>(`/users?${query.toString()}`);
  },

  approveUser: (id: number) =>
    request<any>(`/users/${id}/approve`, { method: 'PATCH' }),

  updateUserRole: (id: number, role: string) =>
    request<any>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

  updateUserStatus: (id: number, status: string) =>
    request<any>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  resetUserPassword: (id: number, newPassword: string) =>
    request<any>(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),

  // Audit Logs (Admin)
  getAuditLogs: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<{ total: number; items: any[] }>(`/audit-logs?${query.toString()}`);
  },
};
