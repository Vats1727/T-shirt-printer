export async function request(endpoint, options = {}, retries = 2) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers
    });

    if (!res.ok) {
      if (res.status === 503 && retries > 0) {
        await new Promise((r) => setTimeout(r, 600));
        return request(endpoint, options, retries - 1);
      }
      const data = await res.json().catch(() => ({}));
      const message = data.message || `HTTP Error ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return res.json().catch(() => ({}));
  } catch (err) {
    if (retries > 0 && (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('network'))) {
      await new Promise((r) => setTimeout(r, 600));
      return request(endpoint, options, retries - 1);
    }
    throw err;
  }
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
