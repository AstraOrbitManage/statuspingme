// API Client for SitRep backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// localStorage keys
const ACCESS_TOKEN_KEY = 'statuspingme_access_token';
const REFRESH_TOKEN_KEY = 'statuspingme_refresh_token';

// Types
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status: number;
}

// Token management
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Custom error class
export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Refresh access token
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken || refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

// Core fetch wrapper
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const accessToken = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 - try to refresh token
  if (response.status === 401 && retry && getRefreshToken()) {
    // Prevent multiple refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken();
    }

    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      // Retry the request with new token
      return apiFetch<T>(endpoint, options, false);
    } else {
      clearTokens();
      throw new ApiRequestError('Session expired. Please log in again.', 401, 'SESSION_EXPIRED');
    }
  }

  // Parse response
  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage = typeof data === 'object' && data && 'message' in data 
      ? (data as { message: string }).message 
      : 'An error occurred';
    const errorCode = typeof data === 'object' && data && 'code' in data 
      ? (data as { code: string }).code 
      : undefined;
    throw new ApiRequestError(errorMessage, response.status, errorCode);
  }

  return data as T;
}

// API methods
export const api = {
  // Auth endpoints
  auth: {
    login: (email: string, password: string) =>
      apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    signup: (email: string, password: string, name?: string) =>
      apiFetch<AuthResponse>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),

    logout: () =>
      apiFetch<{ success: boolean }>('/api/auth/logout', {
        method: 'POST',
      }),

    me: () => apiFetch<User>('/api/auth/me'),

    refresh: () => refreshAccessToken(),
  },

  // Projects endpoints (placeholder for future)
  projects: {
    list: () => apiFetch<{ projects: unknown[] }>('/api/projects'),
    get: (id: string) => apiFetch<unknown>(`/api/projects/${id}`),
    create: (data: { name: string; description?: string }) =>
      apiFetch<unknown>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Generic methods for custom endpoints
  get: <T>(endpoint: string) => apiFetch<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  put: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: <T>(endpoint: string) =>
    apiFetch<T>(endpoint, {
      method: 'DELETE',
    }),
};

// Types for Updates API
export interface CreateUpdateData {
  content: string;
  images?: { url: string; filename: string; sizeBytes?: number }[];
  link?: { url: string; title?: string; description?: string; imageUrl?: string };
}

export interface UpdateResponse {
  update: {
    id: string;
    projectId: string;
    content: string;
    createdAt: string;
    authorId: string;
    authorName?: string;
    images?: { id: string; url: string; filename?: string }[];
    link?: {
      url: string;
      title: string | null;
      description: string | null;
      imageUrl: string | null;
      domain: string;
    };
  };
}

export interface ListUpdatesResponse {
  updates: UpdateResponse['update'][];
  total: number;
  hasMore: boolean;
}

// Updates API
export const updatesApi = {
  create: (projectId: string, data: CreateUpdateData) =>
    apiFetch<UpdateResponse>(`/api/projects/${projectId}/updates`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: (projectId: string, params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    const queryString = searchParams.toString();
    return apiFetch<ListUpdatesResponse>(
      `/api/projects/${projectId}/updates${queryString ? `?${queryString}` : ''}`
    );
  },

  get: (projectId: string, updateId: string) =>
    apiFetch<UpdateResponse>(`/api/projects/${projectId}/updates/${updateId}`),

  update: (projectId: string, updateId: string, data: { content: string }) =>
    apiFetch<UpdateResponse>(`/api/projects/${projectId}/updates/${updateId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (projectId: string, updateId: string) =>
    apiFetch<{ message: string }>(`/api/projects/${projectId}/updates/${updateId}`, {
      method: 'DELETE',
    }),
};

// Types for Subscribers API
export interface Subscriber {
  id: string;
  email: string;
  frequency: 'instant' | 'daily' | 'weekly';
  subscribedAt: string;
  lastSentAt: string | null;
}

export interface ListSubscribersResponse {
  subscribers: Subscriber[];
  total: number;
}

export interface ProjectSettings {
  brandingLogoUrl?: string | null;
  brandingColor?: string | null;
  notificationsEnabled?: boolean;
}

// Subscribers API
export const subscribersApi = {
  list: (projectId: string) =>
    apiFetch<ListSubscribersResponse>(`/api/projects/${projectId}/subscribers`),

  remove: (projectId: string, subscriberId: string) =>
    apiFetch<{ message: string }>(`/api/projects/${projectId}/subscribers/${subscriberId}`, {
      method: 'DELETE',
    }),
};

// Project Settings API
export const projectSettingsApi = {
  update: (projectId: string, settings: ProjectSettings) =>
    apiFetch<{ project: unknown }>(`/api/projects/${projectId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }),
};

export default api;
