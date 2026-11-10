export type User = { id: string; email: string; createdAt: string };
export type Project = { id: string; name: string; folderName: string; status: 'CREATING'|'READY'|'FAILED'|'GENERATING'; buildStatus: 'PENDING'|'INSTALLING'|'BUILDING'|'SUCCESS'|'FAILED'; runtimeStatus: 'STOPPED'|'STARTING'|'RUNNING'|'CRASHED'|'FAILED'; previewPort: number|null; previewUrl: string|null; buildStartedAt: string|null; buildCompletedAt: string|null; runtimeStartedAt: string|null; lastBuildError: string|null; createdAt: string; updatedAt: string };
export type Generation = { id: string; projectId: string; prompt: string; status: 'QUEUED'|'RUNNING'|'COMPLETED'|'FAILED'; stdout: string|null; stderr: string|null; exitCode: number|null; createdAt: string; completedAt: string|null };

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

async function downloadBlob(path: string): Promise<Blob> {
  const headers = new Headers({ Accept: 'application/zip' });
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { headers, cache: 'no-store' });
  if (response.status === 401) {
    tokenStore.clear();
    if (typeof window !== 'undefined' && !location.pathname.startsWith('/auth')) location.assign('/auth/login');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(Array.isArray(body?.message) ? body.message.join(', ') : body?.message || 'Could not download this project. Please try again.', response.status);
  }
  const blob = await response.blob();
  if (blob.size === 0) throw new ApiError('The project archive was empty.', response.status);
  return blob;
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
  build: (id: string) => api(`/backend/projects/${id}/build`, { method: 'POST' }),
  start: (id: string) => api(`/backend/projects/${id}/start`, { method: 'POST' }),
  stop: (id: string) => api(`/backend/projects/${id}/stop`, { method: 'POST' }),
  restart: (id: string) => api(`/backend/projects/${id}/restart`, { method: 'POST' }),
  download: (id: string) => downloadBlob(`/backend/projects/${id}/download`),
  preview: (id: string) => api<Project>(`/backend/projects/${id}/preview`),
  logs: (id: string) => api<{ buildStdout:string|null; buildStderr:string|null; installStdout:string|null; installStderr:string|null; runtimeStdout:string; runtimeStderr:string; lastBuildError:string|null }>(`/backend/projects/${id}/logs`),
};
export const generationsApi = {
  get: (id: string) => api<Generation>(`/backend/generations/${id}`),
  list: (projectId?: string) => api<Generation[]>(`/backend/generations${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
};
