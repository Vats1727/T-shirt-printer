export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data.message || `HTTP Error ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return res.json().catch(() => ({}));
}

export async function fetchDesigns(all = false) {
  const url = all ? '/api/designs?all=1' : '/api/designs';
  return request(url);
}

export async function createDesign(data) {
  return request('/api/designs', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export default { request, fetchDesigns, createDesign };
