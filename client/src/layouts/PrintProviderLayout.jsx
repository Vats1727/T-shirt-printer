import React from 'react';
import { PrintProviderNavbar } from './PrintProviderNavbar.jsx';

export function PrintProviderLayout({ children }) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50/50 text-slate-900 font-sans">
      {/* Amazon Storefront Top Navigation Bar (Menus integrated into navbar, no sidebar) */}
      <PrintProviderNavbar />

      {/* Main Content Area - Full width with Amazon storefront maximum container */}
      <main className="flex-1 w-full py-5 px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          {children}
        </div>
      </main>

      {/* Amazon Storefront Subtle Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">PrintPortal</span>
            <span>·</span>
            <span>Print Provider Production & Fulfillment Network</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Storefront Catalog Console
          </p>
        </div>
      </footer>
    </div>
  );
}

export default PrintProviderLayout;
