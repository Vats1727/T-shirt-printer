import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { loginWithCredentials } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await loginWithCredentials(email, password);
      const role = res?.user?.role;
      if (role === 'portal_admin') {
        window.location.replace('/portal/dashboard');
      } else if (role === 'print_provider' || role === 'admin') {
        window.location.replace('/admin/dashboard');
      } else if (role === 'designer' || role === 'supplier') {
        window.location.replace('/supplier/dashboard');
      } else {
        window.location.replace('/');
      }
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
              <p className="opacity-90">Sign in to manage products, orders and designs.</p>
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
                  <Input value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@example.com" type="email" required />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <div className="mt-1 relative">
                    <Input
                      value={password}
                      onChange={(e: any) => setPassword(e.target.value)}
                      placeholder="Password"
                      type={showPassword ? "text" : "password"}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && <div className="text-sm text-red-600">{error}</div>}

                <div className="flex items-center justify-between">
                  <Button type="submit" className="px-4 py-2" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
                  <Link href="/register" className="text-sm text-sky-600 hover:underline cursor-pointer">Register</Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 
