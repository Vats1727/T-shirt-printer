import { QueryClient } from '@tanstack/react-query';
import { resolveApiUrl } from './apiUrl.js';

async function throwIfResNotOk(res) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(method, url, data) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(data ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const finalUrl = resolveApiUrl(url);
  const res = await fetch(finalUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include'
  });

  await throwIfResNotOk(res);
  return res;
}

export const getQueryFn =
  ({ on401: unauthorizedBehavior } = { on401: 'throw' }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const rawPath = queryKey.join('/');
    const finalUrl = resolveApiUrl(rawPath);

    const res = await fetch(finalUrl, {
      headers,
      credentials: 'include'
    });

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false
    },
    mutations: {
      retry: false
    }
  }
});

export default queryClient;
