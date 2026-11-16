import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { resolveApiUrl } from './lib/apiUrl.js';

// Non-invasive URL resolution for relative /api and asset paths.
// External URLs (e.g. Razorpay, CDNs, Google Fonts, S3), File Uploads (FormData), 
// Headers, Cookies, and WebSocket connections remain 100% native and untouched.
const originalFetch = window.fetch;
window.fetch = function (resource, init) {
  try {
    if (typeof resource === 'string') {
      // Strictly rewrite internal relative endpoints only (do not touch external or protocol URLs)
      if (
        resource.startsWith('/api/') ||
        resource === '/api' ||
        resource.startsWith('/uploads/') ||
        resource === '/uploads' ||
        resource.startsWith('/attached_assets/') ||
        resource === '/attached_assets'
      ) {
        resource = resolveApiUrl(resource);
      }
    } else if (resource && typeof resource === 'object' && resource.url) {
      const url = String(resource.url);
      try {
        const parsed = new URL(url, window.location.origin);
        // Only rewrite if strictly targeting same-origin internal paths
        if (
          parsed.origin === window.location.origin &&
          (parsed.pathname.startsWith('/api') ||
           parsed.pathname.startsWith('/uploads') ||
           parsed.pathname.startsWith('/attached_assets'))
        ) {
          const resolved = resolveApiUrl(parsed.pathname + parsed.search);
          resource = new Request(resolved, resource);
        }
      } catch {}
    }
  } catch (e) {
    // Fail-safe: fall back to original resource if any URL inspection exception occurs
  }
  return originalFetch.call(this, resource, init);
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
