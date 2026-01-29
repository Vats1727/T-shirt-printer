import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const base = 'http://localhost:5000';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const designsFile = path.join(__dirname, '..', 'designs.json');

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${base}/api/designs`);
      if (res.ok) return;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not become available');
}

async function run() {
  console.log('Waiting for server...');
  await waitForServer();
  console.log('Server is up — running smoke tests');

  // check health and readiness
  const health = await fetch(`${base}/healthz`);
  if (health.status !== 200) throw new Error('/healthz failed');
  const ready = await fetch(`${base}/ready`);
  if (ready.status !== 200) throw new Error('/ready failed');

  // read initial designs count
  const before = JSON.parse(await fs.readFile(designsFile, 'utf-8')) as any[];

  // create
  const createRes = await fetch(`${base}/api/designs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slogan: 'smoke test', color: '#ff0000' }),
  });
  if (createRes.status !== 201) throw new Error('POST failed');
  const created = (await createRes.json()) as { id: number };
  console.log('Created', created);

  // get by id
  const getRes = await fetch(`${base}/api/designs/${created.id}`);
  if (getRes.status !== 200) throw new Error('GET by id failed');
  const got = await getRes.json();
  console.log('Fetched by id', got);

  // update
  const updRes = await fetch(`${base}/api/designs/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ color: '#00ff00', slogan: 'updated' }),
  });
  if (updRes.status !== 200) throw new Error('PUT failed');
  const updated = (await updRes.json()) as { color?: string };
  console.log('Updated', updated);
  if (updated.color !== '#00ff00') throw new Error('PUT did not update color');

  // delete
  const delRes = await fetch(`${base}/api/designs/${created.id}`, { method: 'DELETE' });
  if (delRes.status !== 204) throw new Error('DELETE failed');
  console.log('Deleted', created.id);

  // verify designs file
  const after = JSON.parse(await fs.readFile(designsFile, 'utf-8')) as any[];
  if (after.length !== before.length) {
    console.log('before length', before.length, 'after', after.length);
    throw new Error('Expected designs.json to be back to original length');
  }

  // Corruption recovery test: write invalid JSON to disk and confirm the server recovers
  console.log('Testing corruption recovery...');
  await fs.writeFile(designsFile, 'INVALID JSON');
  // call list endpoint which will trigger readData and recovery
  const listAfterCorrupt = await fetch(`${base}/api/designs`);
  if (listAfterCorrupt.status !== 200) throw new Error('GET after corruption failed');
  const parsed = await listAfterCorrupt.json();
  if (!Array.isArray(parsed)) throw new Error('Expected designs to be an array after recovery');
  // ensure a backup corrupt file exists
  const dir = path.dirname(designsFile);
  const files = await fs.readdir(dir);
  const corruptExists = files.some((f) => f.startsWith('designs.json.corrupt-'));
  if (!corruptExists) throw new Error('Expected a corrupt backup file to be created');

  console.log('Corruption recovery OK');

  console.log('Smoke tests passed');
}

run().catch((err) => {
  console.error('Smoke tests failed:', err);
  (process as any).exitCode = 1;
  return;
});