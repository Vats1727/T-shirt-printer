import React from 'react';
import { useLoading } from '@/contexts/LoadingContext';

export const Loader: React.FC = () => {
  const { loading } = useLoading();
  if (!loading) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="pointer-events-auto bg-white/90 dark:bg-slate-900/80 p-4 rounded-md shadow-lg flex items-center gap-3">
        <svg className="h-7 w-7 text-sky-600 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Loading…</span>
      </div>
    </div>
  );
};

export default Loader;
