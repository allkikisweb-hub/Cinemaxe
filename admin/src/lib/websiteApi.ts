// ---------------------------------------------------------------------------
// Wires this admin panel to the REAL Cinemax website backend (Express +
// its file-backed database) instead of a separate, disconnected database.
// Since this app runs on its own origin, it authenticates with a Bearer
// token (obtained at login) rather than the website's own session cookie,
// which only that site's origin can read/send.
// ---------------------------------------------------------------------------

const API_BASE = (import.meta.env.VITE_WEBSITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN_KEY = 'cinemax_admin_token';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* noop — sessionStorage unavailable (e.g. private mode edge cases) */
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// AUTH — the admin account signs in exclusively via an emailed one-time
// code, matching the website's own admin sign-in flow exactly.
// ---------------------------------------------------------------------------

export const websiteAuth = {
  login: (email: string, password: string) =>
    request<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  /** Confirms an email belongs to the site's admin account before sending an OTP. */
  checkIsAdmin: (email: string) =>
    request<{ method: 'otp' | 'password' }>('/api/auth/login/method', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  requestOtp: (email: string) =>
    request<{ ok: true }>('/api/auth/otp/request', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyOtp: (email: string, otp: string) =>
    request<{ user: any; token: string }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),
  me: () => request<{ user: any }>('/api/auth/me'),
  /** Converts a short-lived secure handoff token from the website into a panel session. */
  exchangePortal: (token: string) =>
    request<{ user: any; token: string }>('/api/auth/portal/exchange', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  checkConnection: () => request<{ status: string }>('/api/health'),
};

// ---------------------------------------------------------------------------
// ADMIN DATA — every one of these hits the website's real, live database.
// Anything changed here shows up on the actual site immediately.
// ---------------------------------------------------------------------------

export const websiteApi = {
  getStats: () => request('/api/admin/stats'),

  // Users
  getUsers: (params: { search?: string; status?: string; role?: string; page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    if (params.role) qs.set('role', params.role);
    if (params.page) qs.set('page', String(params.page));
    return request(`/api/admin/users?${qs.toString()}`);
  },
  createUser: (body: { name: string; email: string; password: string }) =>
    request('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: { name?: string; email?: string }) =>
    request(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  setUserStatus: (id: string, status: 'active' | 'suspended' | 'banned') =>
    request(`/api/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  setUserRole: (id: string, role: 'user' | 'admin') =>
    request(`/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  setUserSubscription: (id: string, subscription: string) =>
    request(`/api/admin/users/${id}/subscription`, { method: 'PUT', body: JSON.stringify({ subscription }) }),
  getUserData: (id: string) => request(`/api/admin/users/${id}/data`),
  clearUserData: (id: string, kind: string) =>
    request(`/api/admin/users/${id}/data/${kind}`, { method: 'DELETE' }),
  deleteUser: (id: string) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),

  // Homepage & Content (this is what "adding movies" maps to — admin-authored
  // titles that appear in the "Cinemax Originals" row on the homepage)
  getContent: () => request('/api/admin/content'),
  createContent: (body: {
    title: string;
    overview?: string;
    posterUrl: string;
    backdropUrl?: string;
    trailerYoutubeKey?: string;
    mediaType?: 'movie' | 'tv';
    genreNames?: string[];
    releaseDate?: string;
    rating?: number;
    featured?: boolean;
  }) => request('/api/admin/content', { method: 'POST', body: JSON.stringify(body) }),
  updateContent: (id: string, body: Record<string, any>) =>
    request(`/api/admin/content/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteContent: (id: string) => request(`/api/admin/content/${id}`, { method: 'DELETE' }),

  // Categories (TMDB genre overrides — rename or hide a category site-wide)
  getCategoryOverrides: () => request('/api/admin/categories'),
  updateCategoryOverride: (genreId: number, body: { label?: string | null; hidden?: boolean }) =>
    request(`/api/admin/categories/${genreId}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Comments & reviews
  getComments: (status?: string) => request(`/api/admin/comments${status ? `?status=${status}` : ''}`),
  setCommentStatus: (id: string, status: 'pending' | 'approved' | 'rejected') =>
    request(`/api/admin/comments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteComment: (id: string) => request(`/api/admin/comments/${id}`, { method: 'DELETE' }),

  // Live Chat moderation (global feed only — private inbox stays private)
  getChatMessages: (search?: string) =>
    request(`/api/admin/chat${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  deleteChatMessage: (id: string) => request(`/api/admin/chat/${id}`, { method: 'DELETE' }),

  // Direct messaging for admin <> users
  getChatConversations: () => request('/api/chat/conversations'),
  getChatDirectory: () => request('/api/chat/directory'),
  getChatThread: (userId: string) => request(`/api/chat/conversations/${userId}`),
  sendChatMessage: (userId: string, body: { text?: string; mediaUrl?: string; mediaType?: 'image' | 'audio' }) =>
    request(`/api/chat/conversations/${userId}`, { method: 'POST', body: JSON.stringify(body) }),

  // Site settings
  getSettings: () => request('/api/admin/settings'),
  updateSettings: (body: Record<string, any>) =>
    request('/api/admin/settings', { method: 'PUT', body: JSON.stringify(body) }),

  // Activity log
  getLogs: (limit = 100) => request(`/api/admin/logs?limit=${limit}`),

  // Help Desk inquiries
  getInquiries: (params: { status?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    return request(`/api/admin/inquiries?${qs.toString()}`);
  },
  updateInquiry: (id: string, body: { status?: 'open' | 'replied' | 'closed'; adminReply?: string }) =>
    request(`/api/admin/inquiries/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteInquiry: (id: string) => request(`/api/admin/inquiries/${id}`, { method: 'DELETE' }),

  // Advertisements
  getAds: () => request('/api/admin/ads'),
  createAd: (body: { title: string; imageUrl: string; targetUrl: string; placement?: string }) =>
    request('/api/admin/ads', { method: 'POST', body: JSON.stringify(body) }),
  updateAd: (id: string, body: Record<string, unknown>) =>
    request(`/api/admin/ads/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAd: (id: string) => request(`/api/admin/ads/${id}`, { method: 'DELETE' }),

  // Site-wide notification broadcasts
  broadcastNotification: (body: { title: string; message: string; type?: string }) =>
    request<{ recipients: number }>('/api/admin/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  notifyUser: (body: { userId: string; title: string; message: string; type?: string }) =>
    request('/api/admin/notifications/user', { method: 'POST', body: JSON.stringify(body) }),

  /** Secure portal URL — same endpoint the main website uses for admin handoff. */
  getAdminPortalUrl: () => request<{ url: string }>('/api/auth/admin-portal-url'),
};
