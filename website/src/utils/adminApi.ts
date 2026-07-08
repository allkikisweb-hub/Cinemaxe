const API_BASE = ""; // same-origin

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const adminApi = {
  getStats: () => request("/api/admin/stats"),

  getUsers: (params: { search?: string; status?: string; role?: string; page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    if (params.role) qs.set("role", params.role);
    if (params.page) qs.set("page", String(params.page));
    return request(`/api/admin/users?${qs.toString()}`);
  },
  createUser: (body: { name: string; email: string; password: string }) =>
    request("/api/admin/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: { name?: string; email?: string }) =>
    request(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setUserStatus: (id: string, status: "active" | "suspended" | "banned") =>
    request(`/api/admin/users/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  setUserRole: (id: string, role: "user" | "admin") =>
    request(`/api/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
  deleteUser: (id: string) => request(`/api/admin/users/${id}`, { method: "DELETE" }),

  getComments: (status?: string) => request(`/api/admin/comments${status ? `?status=${status}` : ""}`),
  setCommentStatus: (id: string, status: "pending" | "approved" | "rejected") =>
    request(`/api/admin/comments/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  deleteComment: (id: string) => request(`/api/admin/comments/${id}`, { method: "DELETE" }),

  getChatMessages: (search?: string) => request(`/api/admin/chat${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  deleteChatMessage: (id: string) => request(`/api/admin/chat/${id}`, { method: "DELETE" }),

  getAds: () => request("/api/admin/ads"),
  createAd: (body: { title: string; imageUrl: string; targetUrl: string; placement: string }) =>
    request("/api/admin/ads", { method: "POST", body: JSON.stringify(body) }),
  updateAd: (id: string, body: Partial<{ title: string; imageUrl: string; targetUrl: string; placement: string; active: boolean }>) =>
    request(`/api/admin/ads/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAd: (id: string) => request(`/api/admin/ads/${id}`, { method: "DELETE" }),

  broadcastNotification: (body: { title: string; message: string; type?: string }) =>
    request("/api/admin/notifications/broadcast", { method: "POST", body: JSON.stringify(body) }),

  getCategoryOverrides: () => request("/api/admin/categories"),
  updateCategoryOverride: (genreId: number, body: { label?: string | null; hidden?: boolean }) =>
    request(`/api/admin/categories/${genreId}`, { method: "PUT", body: JSON.stringify(body) }),

  getSettings: () => request("/api/admin/settings"),
  updateSettings: (body: Record<string, any>) =>
    request("/api/admin/settings", { method: "PUT", body: JSON.stringify(body) }),

  getLogs: (limit = 100) => request(`/api/admin/logs?limit=${limit}`),

  getContent: () => request("/api/admin/content"),
  createContent: (body: {
    title: string;
    overview?: string;
    posterUrl: string;
    backdropUrl?: string;
    trailerYoutubeKey?: string;
    mediaType?: "movie" | "tv";
    genreNames?: string[];
    releaseDate?: string;
    rating?: number;
    featured?: boolean;
  }) => request("/api/admin/content", { method: "POST", body: JSON.stringify(body) }),
  updateContent: (id: string, body: Partial<Parameters<typeof adminApi.createContent>[0]>) =>
    request(`/api/admin/content/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteContent: (id: string) => request(`/api/admin/content/${id}`, { method: "DELETE" }),
};
