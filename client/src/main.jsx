import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { resolveApiUrl } from './lib/apiUrl.js';

// Global fetch interceptor to route /api, /uploads, and /attached_assets to VITE_API_URL
const originalFetch = window.fetch;
window.fetch = function (resource, init) {
  if (
    typeof resource === 'string' &&
    (resource.startsWith('/api') || resource.startsWith('/uploads') || resource.startsWith('/attached_assets'))
  ) {
    resource = resolveApiUrl(resource);
  }
  return originalFetch.call(this, resource, init);
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
