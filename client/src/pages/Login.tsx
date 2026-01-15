import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

export default function Login() {
  const { loginWithCredentials } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginWithCredentials(email, password);
      // Redirect based on role if logging in from admin/supplier path
      const curUser = ( (window as any).__USER_OVERRIDE__ ) || null;
      // Use user from context
      const u = await new Promise(resolve => setTimeout(resolve, 50)).then(() => null);
      // Read stored user
      const stored = localStorage.getItem('user');
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.role === 'admin') setLocation('/admin/dashboard');
      else if (parsed?.role === 'supplier') setLocation('/supplier/dashboard');
      else setLocation('/');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-4">Sign in</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2"
            placeholder="you@example.com"
            type="email"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2"
            placeholder="Password"
            type="password"
            required
          />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 rounded bg-blue-600 text-white"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        <div className="pt-4 text-sm">
          Don't have an account? <a href="/register" className="text-primary underline">Register</a>
        </div>
      </form>
    </div>
  );
}
