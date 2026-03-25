import { api } from "@shared/routes";

export async function login(email: string, password: string) {
  const res = await fetch(api.auth.login.path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json && json.message) || 'Login failed');
  }
  return api.auth.login.responses[200].parse(await res.json());
}

export async function register(payload: { name?: string; email: string; password: string; role: 'print_provider' | 'designer' | 'portal_admin'; associated_provider_id?: number | null; }) {
  const res = await fetch(api.auth.register.path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json && json.message) || 'Register failed');
  }
  return api.auth.register.responses[201].parse(await res.json());
}
