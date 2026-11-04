export function resolveApiUrl(path) {
  if (!path || typeof path !== 'string') return path;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }

  let baseUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl) {
    return path;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If path is for static uploads or attached_assets, route to host base without /api suffix
  if (cleanPath.startsWith('/uploads') || cleanPath.startsWith('/attached_assets')) {
    const rootBase = baseUrl.replace(/\/api(\/v1)?$/, '');
    return `${rootBase}${cleanPath}`;
  }

  // If baseUrl already ends with /api/v1 (e.g. https://.../t-shirt-printer/api/v1)
  if (baseUrl.endsWith('/api/v1')) {
    if (cleanPath.startsWith('/api/v1/')) {
      return `${baseUrl}${cleanPath.slice('/api/v1'.length)}`;
    }
    if (cleanPath.startsWith('/api/')) {
      return `${baseUrl}${cleanPath.slice('/api'.length)}`;
    }
    return `${baseUrl}${cleanPath}`;
  }

  // If baseUrl ends with /api
  if (baseUrl.endsWith('/api')) {
    if (cleanPath.startsWith('/api/')) {
      return `${baseUrl}${cleanPath.slice('/api'.length)}`;
    }
    return `${baseUrl}${cleanPath}`;
  }

  // Generic base URL (e.g. https://domain.com/t-shirt-printer)
  return `${baseUrl}${cleanPath}`;
}

export default resolveApiUrl;

