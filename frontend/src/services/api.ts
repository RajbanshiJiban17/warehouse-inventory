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

  // Attach JWT Bearer token from localStorage if available (robust across cross-origin/proxies)
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

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
    let errorMsg = data?.detail || data?.message || (typeof data === 'string' ? data : 'API Request Failed');
    if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      errorMsg = `${errorMsg} (${data.errors.join('; ')})`;
    }
    // If unauthorized, clear stale token
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
    throw new ApiError(response.status, errorMsg, data);
  }

  return data as T;
}

export const api = {
  checkHealth: () => request<any>('/health'),

  // Auth
  register: (payload: { username: string; email: string; password: string }) =>
    request<any>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  login: async (payload: { username: string; password: string }) => {
    const res = await request<any>('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    if (res?.accessToken && typeof window !== 'undefined') {
      localStorage.setItem('access_token', res.accessToken);
    }
    return res;
  },

  logout: async () => {
    try {
      await request<any>('/auth/logout', { method: 'POST' });
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
      }
    }
  },

  getMe: () =>
    request<any>('/auth/me'),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<any>('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }),

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

  getNextItemCode: () =>
    request<{ nextCode: string }>('/items/next-code'),

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

  importItemsFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<any>('/items/import', { method: 'POST', body: formData });
  },

  resetInventory: () =>
    request<{ message: string; wipedCount: number }>('/items/reset-inventory', { method: 'POST' }),

  downloadImportTemplateUrl: (format: 'xlsx' | 'csv' = 'xlsx') =>
    `${getApiBase()}/items/import/template?format=${format}`,

  // Stock
  stockIn: (payload: {
    itemId?: number;
    barcode?: string;
    quantity: number | string;
    remark?: string;
    dateAD?: string;
    dateBS?: string;
    supplierName?: string;
    receivedFrom?: string;
    location?: string;
    unitPrice?: number | string;
    amount?: number | string;
    batchNo?: string;
    mfgDate?: string;
    expiryDate?: string;
    idempotencyKey?: string;
  }) => request<any>('/stock/in', { method: 'POST', body: JSON.stringify(payload) }),

  getStockInHistory: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<{ total: number; items: any[] }>(`/stock/in?${query.toString()}`);
  },

  stockOut: (payload: {
    itemId?: number;
    barcode?: string;
    quantity: number | string;
    location: string;
    remark?: string;
    dateAD?: string;
    dateBS?: string;
    receiverName?: string;
    unitPrice?: number | string;
    amount?: number | string;
    batchNo?: string;
    idempotencyKey?: string;
  }) => request<any>('/stock/out', { method: 'POST', body: JSON.stringify(payload) }),

  getStockOutHistory: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return request<{ total: number; items: any[] }>(`/stock/out?${query.toString()}`);
  },

  getBatches: (itemId?: number) => {
    const q = itemId ? `?item_id=${itemId}` : '';
    return request<any[]>(`/stock/batches${q}`);
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

  createUser: (payload: { username: string; email: string; password: string; role?: string; status?: string }) =>
    request<any>('/users', { method: 'POST', body: JSON.stringify(payload) }),

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
