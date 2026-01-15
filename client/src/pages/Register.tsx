import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { register } from '@/services/auth';

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
      // Redirect to role-specific login page
      if (role === 'admin') setLocation('/admin/login');
      else setLocation('/supplier/login');
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as any)} className="mt-1 block w-full rounded-md border px-3 py-2">
            <option value="supplier">Supplier</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Registering...' : 'Register'}</Button>
        </div>
      </form>
    </div>
  );
}