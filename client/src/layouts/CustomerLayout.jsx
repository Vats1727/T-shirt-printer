import React from 'react';
import { CustomerNavbar } from './CustomerNavbar.jsx';

export function CustomerLayout({ children }) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50/50 text-slate-900 font-sans">
      {/* Top Customer Navigation */}
      <CustomerNavbar />

      {/* Main Content Area */}
      <main className="flex-1 w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl w-full">
          {children}
        </div>
      </main>

      {/* Customer Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">PrintPortal</span>
            <span>·</span>
            <span>Customer Marketplace & Storefront Network</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Official Creator Merchandising Hub
          </p>
        </div>
      </footer>
    </div>
  );
}

export default CustomerLayout;

