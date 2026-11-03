import React from 'react';
import { DesignerNavbar } from './DesignerNavbar.jsx';

export function DesignerLayout({ children, onRefresh, isRefreshing, onChangeProvider }) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50/50 text-slate-900 font-sans">
      {/* Top Navigation Bar with Integrated Tabs */}
      <DesignerNavbar
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        onChangeProvider={onChangeProvider}
      />

      {/* Main Content Area - Full width with maximum container */}
      <main className="flex-1 w-full py-5 px-4 sm:px-6 lg:px-8">
        <div className="w-full">
          {children}
        </div>
      </main>

      {/* Designer Studio Subtle Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 px-2 sm:px-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">PrintPortal</span>
            <span>·</span>
            <span>Creator Studio & Merchandising Network</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Designer Storefront & Fulfillment Console
          </p>
        </div>
      </footer>
    </div>
  );
}

export default DesignerLayout;
