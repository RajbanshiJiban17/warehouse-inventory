export type UserRole = 'ADMIN' | 'STAFF' | 'MANAGER';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  failedLogins?: number;
  lockedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface Unit {
  id: number;
  name: string;
  description?: string;
  allowDecimals: boolean;
}

export interface Location {
  id: number;
  name: string;
  description?: string;
}

export interface Item {
  id: number;
  itemCode: string;
  itemName: string;
  barcode: string;
  unitId: number;
  categoryId: number;
  quantity: string | number;
  minStockLevel: string | number;
  isActive: boolean;
  categoryName?: string;
  unitName?: string;
  allowDecimals?: boolean;
  isLowStock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockInResponse {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  barcode: string;
  quantity: string | number;
  unitName?: string;
  balanceAfter: string | number;
  remark?: string;
  dateAD?: string;
  dateBS?: string;
  supplierName?: string;
  receivedFrom?: string;
  location?: string;
  unitPrice?: string | number;
  amount?: string | number;
  batchNo?: string;
  mfgDate?: string;
  expiryDate?: string;
  createdAt: string;
  createdByUsername?: string;
}

export interface StockOutResponse {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  barcode: string;
  quantity: string | number;
  unitName?: string;
  location: string;
  balanceAfter: string | number;
  isLowStockWarning: boolean;
  remark?: string;
  dateAD?: string;
  dateBS?: string;
  receiverName?: string;
  unitPrice?: string | number;
  amount?: string | number;
  batchNo?: string;
  createdAt: string;
  createdByUsername?: string;
}

export interface BatchStockItem {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  barcode: string;
  categoryName?: string;
  unitName?: string;
  batchNo: string;
  mfgDate?: string;
  expiryDate?: string;
  quantity: string | number;
  unitPrice?: string | number;
  supplierName?: string;
  status: string;
}

export interface StockMovement {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  type: 'OPENING' | 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: string | number;
  balanceAfter: string | number;
  referenceId?: string;
  createdAt: string;
  createdByUsername?: string;
}

export interface DashboardStats {
  totalItems: number;
  totalStockQuantity: string | number;
  todayInQuantity: string | number;
  todayOutQuantity: string | number;
  lowStockCount: number;
  top10MovingItems: Array<{
    itemId: number;
    itemCode: string;
    itemName: string;
    totalIssued: string | number;
  }>;
}

export interface AuditLogItem {
  id: number;
  userId?: number;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ip?: string;
  createdAt: string;
}

declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>;
      getServerUrl: () => Promise<string>;
      setServerUrl: (url: string) => Promise<{ success: boolean; serverUrl?: string; error?: string }>;
      checkBackendHealth: () => Promise<{ connected: boolean; data?: any; status?: number; error?: string }>;
      onBackendStatusChange: (callback: (status: any) => void) => void;
    };
  }
}

