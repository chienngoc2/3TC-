import { apiClient } from '@/services/api-client';

export interface CenterManagerUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  role: 'CENTER_MANAGER';
  isActive: boolean;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCenterManagerPayload {
  email: string;
  fullName: string;
  phone: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  password?: string;
}

export interface AuditLogItem {
  id: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface SystemMetrics {
  uptimeSeconds: number;
  cpuUsageMicroseconds: {
    user: number;
    system: number;
  };
  memoryUsageBytes: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  nodeVersion: string;
}

export interface HealthStatus {
  status: 'UP' | 'DOWN';
  database: 'UP' | 'DOWN';
  uptimeSeconds: number;
}

export const consoleApi = {
  getCenterManagers: async (): Promise<CenterManagerUser[]> => {
    const res = await apiClient.get<CenterManagerUser[]>('/users/center-managers');
    return res.data;
  },

  createCenterManager: async (payload: CreateCenterManagerPayload): Promise<CenterManagerUser> => {
    const res = await apiClient.post<CenterManagerUser>('/users/center-managers', payload);
    return res.data;
  },

  disableCenterManager: async (id: string): Promise<CenterManagerUser> => {
    const res = await apiClient.delete<CenterManagerUser>(`/users/center-managers/${id}`);
    return res.data;
  },

  getAuditLogs: async (): Promise<AuditLogItem[]> => {
    const res = await apiClient.get<AuditLogItem[]>('/audit-logs');
    return res.data;
  },

  getSystemMetrics: async (): Promise<SystemMetrics> => {
    const res = await apiClient.get<SystemMetrics>('/analytics/system-metrics');
    return res.data;
  },

  getHealth: async (): Promise<HealthStatus> => {
    const res = await apiClient.get<HealthStatus>('/health');
    return res.data;
  },
};
