import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { register } from '@/services/auth';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'print_provider' | 'designer'>('designer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validate = () => {
    if (!email || !password || !confirmPassword) return 'All fields are required';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Invalid email format';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    if (role !== 'print_provider' && role !== 'designer') return 'Invalid role';
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const v = validate();
    if (v) return setError(v);
    setLoading(true);
    try {
      await register({
        name,
        email,
        password,
        role,
        associated_provider_id: null
      });
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
            <p className="text-sm text-muted-foreground">Create a designer or print provider account.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Full name" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <Input value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@example.com" type="email" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select value={role} onChange={(e: any) => setRole(e.target.value as any)} className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="designer">Designer</option>
                  <option value="print_provider">Print Provider</option>
                </select>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 relative">
                  <Input
                    value={password}
                    onChange={(e: any) => setPassword(e.target.value)}
                    placeholder="Enter password"
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

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="mt-1 relative">
                  <Input
                    value={confirmPassword}
                    onChange={(e: any) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && <div className="text-sm text-red-600 md:col-span-2">{error}</div>}

              <div className="md:col-span-2 flex items-center justify-between mt-4">
                <Button type="submit" className="px-6 py-2" disabled={loading}>
                  {loading ? 'Registering...' : 'Register'}
                </Button>
                <Link href="/login"><a className="text-sm text-sky-600 hover:underline">Already have an account?</a></Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
 