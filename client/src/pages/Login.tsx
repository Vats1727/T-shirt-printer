import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="hidden md:flex items-center justify-center rounded-lg bg-gradient-to-br from-sky-600 to-indigo-600 text-white p-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Welcome back</h2>
              <p className="opacity-90">Sign in to manage products, orders and suppliers.</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <h1 className="text-2xl font-bold">Sign in</h1>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <Input value={email} onChange={(e:any) => setEmail(e.target.value)} placeholder="you@example.com" type="email" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <Input value={password} onChange={(e:any) => setPassword(e.target.value)} placeholder="Password" type="password" required />
                </div>

                {error && <div className="text-sm text-red-600">{error}</div>}

                <div className="flex items-center justify-between">
                  <Button type="submit" className="px-4 py-2" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
                  <Link href="/register" className="text-sm text-sky-600">Register</Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 
