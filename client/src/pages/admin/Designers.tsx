import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  Mail, 
  Calendar, 
  UserCircle, 
  ArrowLeft,
  Search,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from 'date-fns';

export default function AdminDesigners() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const [designers, setDesigners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDesigners();
  }, [token]);

  async function fetchDesigners() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/designers', {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error('Failed to load designers');
      const data = await res.json();
      setDesigners(data.designers || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load designers');
    } finally {
      setLoading(false);
    }
  }

  const filteredDesigners = designers.filter(d => 
    d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-8">
        <div>
          <button 
            onClick={() => setLocation('/admin/dashboard')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Associated Designers
          </h1>
          <p className="text-muted-foreground mt-2 text-lg max-w-2xl">
            Overview and management of your creative team. Monitor activity and profile details.
          </p>
        </div>
        
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
          <Input 
            placeholder="Search by name or email..." 
            className="pl-10 h-11 bg-background border-muted-foreground/20 focus-visible:ring-blue-500 rounded-xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse border border-border" />
          ))}
        </div>
      ) : error ? (
        <div className="p-12 text-center bg-red-50/50 border border-red-100 rounded-2xl">
          <p className="text-red-600 font-medium">{error}</p>
          <Button variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-50" onClick={fetchDesigners}>Try Again</Button>
        </div>
      ) : filteredDesigners.length === 0 ? (
        <div className="p-20 text-center border-2 border-dashed rounded-3xl bg-muted/30">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-semibold mb-1">No designers found</h3>
          <p className="text-muted-foreground">Try adjusting your search or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredDesigners.map((designer) => (
            <Card key={designer.id} className="group relative overflow-hidden border-none shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 ring-1 ring-border bg-card/50 backdrop-blur-sm rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <CardHeader className="relative pb-2">
                <div className="flex items-start justify-between">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center mb-2 shadow-inner ring-1 ring-white/20">
                    <UserCircle className="w-9 h-9 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                      designer.status === 'active' 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {designer.status}
                    </span>
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold truncate pr-8">{designer.name || 'Anonymous'}</CardTitle>
                <CardDescription className="flex items-center gap-1.5 font-medium text-xs">
                  <Mail className="w-3 h-3" />
                  {designer.email}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="relative py-4">
                <div className="space-y-3 font-medium">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Member Since
                    </span>
                    <span className="font-semibold">
                      {designer.createdAt ? format(new Date(designer.createdAt), 'MMM dd, yyyy') : 'No date'}
                    </span>
                  </div>
                  <div className="pt-4 flex items-center gap-3">
                     <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="relative flex gap-2 pt-2">
                <Button 
                  variant="secondary" 
                  className="w-full h-11 rounded-xl font-bold bg-secondary hover:bg-secondary/80 text-foreground group"
                >
                  View Profile
                  <ChevronRight className="w-4 h-4 ml-1 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Button>
                <Button 
                   variant="ghost" 
                   size="icon"
                   className="h-11 w-12 rounded-xl border border-muted-foreground/10 hover:bg-blue-500/10 hover:text-blue-600 transition-colors"
                   onClick={() => window.open(`mailto:${designer.email}`)}
                 >
                   <Mail className="w-5 h-5" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
