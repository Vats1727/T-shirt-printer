import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { register } from '@/services/auth';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

export default function Register() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'supplier'>('supplier');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    if (!email || !password) return 'Email and password are required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (role !== 'admin' && role !== 'supplier') return 'Invalid role';
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) return setError(v);
    setLoading(true);
    try {
      await register({ name, email, password, role });
      // Redirect to login
      setLocation('/login');
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-3xl">
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold">Create an account</h1>
            <p className="text-sm text-muted-foreground">Create a supplier or admin account to manage this store.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <Input value={name} onChange={(e:any) => setName(e.target.value)} placeholder="Full name" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <Input value={email} onChange={(e:any) => setEmail(e.target.value)} placeholder="you@example.com" type="email" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Input value={password} onChange={(e:any) => setPassword(e.target.value)} placeholder="Password" type="password" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select value={role} onChange={(e:any) => setRole(e.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2">
                  <option value="supplier">Supplier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {error && <div className="text-sm text-red-600 md:col-span-2">{error}</div>}

              <div className="md:col-span-2 flex items-center justify-between">
                <Button type="submit" className="px-4 py-2" disabled={loading}>{loading ? 'Registering...' : 'Register'}</Button>
                <Link href="/login"><a className="text-sm text-sky-600">Already have an account?</a></Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 