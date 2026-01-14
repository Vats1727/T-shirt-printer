import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Sign in</h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm">Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded p-2" />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div>
          <button disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">{loading ? 'Signing in...' : 'Sign in'}</button>
        </div>
      </form>
    </div>
  );
}
