import { api } from "@shared/routes";

export async function fetchDesigns(all?: boolean) {
  const url = all ? `${api.designs.list.path}?all=1` : api.designs.list.path;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch designs');
  return api.designs.list.responses[200].parse(await res.json());
}

export async function createDesign(data: any) {
  const validated = api.designs.create.input.parse(data);
  const res = await fetch(api.designs.create.path, {
    method: api.designs.create.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validated),
  });
  if (!res.ok) {
    if (res.status === 400) {
      const error = api.designs.create.responses[400].parse(await res.json());
      throw new Error(error.message);
    }
    throw new Error('Failed to create design');
  }
  return api.designs.create.responses[201].parse(await res.json());
}
