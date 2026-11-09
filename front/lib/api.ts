export type User = { id: string; email: string; createdAt: string };
export type Project = { id: string; name: string; folderName: string; status: 'CREATING'|'READY'|'FAILED'|'GENERATING'; createdAt: string; updatedAt: string };
export type Generation = { id: string; projectId: string; status: 'QUEUED'|'RUNNING'|'COMPLETED'|'FAILED'; stdout: string|null; stderr: string|null; exitCode: number|null; createdAt: string; completedAt: string|null };

const tokenKey = 'forma.accessToken';
export const tokenStore = {
  get: () => typeof window === 'undefined' ? null : sessionStorage.getItem(tokenKey),
  set: (token: string) => sessionStorage.setItem(tokenKey, token),
  clear: () => sessionStorage.removeItem(tokenKey),
};

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers, cache: 'no-store' });
  if (response.status === 401) { tokenStore.clear(); if (typeof window !== 'undefined' && !location.pathname.startsWith('/auth')) location.assign('/auth/login'); }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(Array.isArray(body?.message) ? body.message.join(', ') : body?.message || 'Something went wrong. Please try again.', response.status);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export const authApi = {
  login: (email: string, password: string) => api<{ accessToken: string; user: User }>('/backend/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string) => api<{ accessToken: string; user: User }>('/backend/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => api<User>('/backend/auth/me'),
};
export const projectsApi = {
  list: () => api<Project[]>('/backend/projects'),
  create: (name: string) => api<Project>('/backend/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  get: (id: string) => api<Project>(`/backend/projects/${id}`),
  generate: (id: string, prompt: string) => api<{ generationId: string; status: string }>(`/backend/projects/${id}/generations`, { method: 'POST', body: JSON.stringify({ prompt }) }),
};
export const generationsApi = {
  get: (id: string) => api<Generation>(`/backend/generations/${id}`),
  list: (projectId?: string) => api<Generation[]>(`/backend/generations${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
};
