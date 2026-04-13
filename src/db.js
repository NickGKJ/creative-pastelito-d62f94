// All data is stored in Netlify Blobs via three serverless functions:
//   /.netlify/functions/api    — JSON CRUD (categories, items, settings)
//   /.netlify/functions/upload — binary file upload
//   /.netlify/functions/file   — binary file serve
//
// Cross-device sync is achieved by polling every 10 seconds.
// Any change made on one device will appear on all other devices
// within 10 seconds without a page refresh.

export const DEFAULT_CATEGORIES = [
  { name: 'Food',     emoji: '🍎' },
  { name: 'Play',     emoji: '🎮' },
  { name: 'Feelings', emoji: '😊' },
  { name: 'People',   emoji: '👨‍👩‍👧' },
  { name: 'Places',   emoji: '🏠' },
];

// ── Low-level helpers ──────────────────────────────────────────────────────────

async function apiGet(resource, params = {}) {
  const url = new URL('/.netlify/functions/api', location.origin);
  url.searchParams.set('resource', resource);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${resource} failed (${res.status})`);
  return res.json();
}

async function apiPost(resource, body, params = {}) {
  const url = new URL('/.netlify/functions/api', location.origin);
  url.searchParams.set('resource', resource);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${resource} failed (${res.status})`);
  return res.json();
}

// Uploads a Blob; returns the URL that will serve it.
// If id is provided the upload overwrites the existing file at that id.
async function uploadFile(blob, id) {
  const url = new URL('/.netlify/functions/upload', location.origin);
  if (id) url.searchParams.set('id', id);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-File-Type': blob.type || 'application/octet-stream' },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const { url: fileUrl } = await res.json();
  return fileUrl;
}

async function deleteFile(id) {
  if (!id) return;
  const url = new URL('/.netlify/functions/upload', location.origin);
  url.searchParams.set('id', id);
  await fetch(url, { method: 'DELETE' }).catch(() => {});
}

// ── Categories ─────────────────────────────────────────────────────────────────

export async function getCategories() {
  const cats = await apiGet('categories');
  return Array.isArray(cats) ? cats.sort((a, b) => a.order - b.order) : [];
}

// Calls callback immediately then every 10 seconds.
// Returns an unsubscribe function — matches the Firebase onSnapshot interface
// so AppContext / ChildView don't need to change.
export function subscribeToCategories(callback) {
  let cancelled = false;

  async function poll() {
    if (cancelled) return;
    try {
      callback(await getCategories());
    } catch (e) {
      console.warn('subscribeToCategories:', e.message);
    }
    if (!cancelled) setTimeout(poll, 10_000);
  }

  poll();
  return () => { cancelled = true; };
}

export async function addCategory({ name, emoji }) {
  const existing = await getCategories();
  const order = existing.length
    ? Math.max(...existing.map(c => c.order)) + 1
    : 0;
  const cat = { id: crypto.randomUUID(), name, emoji, order, createdAt: Date.now() };
  await apiPost('categories', [...existing, cat]);
  return cat;
}

export async function updateCategory(category) {
  const existing = await getCategories();
  const updated = existing.map(c => c.id === category.id ? { ...c, ...category } : c);
  await apiPost('categories', updated);
}

export async function deleteCategory(id) {
  // Delete all files belonging to this category's items first
  const items = await getItemsByCategory(id);
  await Promise.all(items.flatMap(item => [
    deleteFile(`img-${item.id}`),
    deleteFile(`aud-${item.id}`),
  ]));
  // Clear the items list for this category
  await apiPost('items', [], { categoryId: id });
  // Remove from categories list
  const existing = await getCategories();
  await apiPost('categories', existing.filter(c => c.id !== id));
}

export async function reorderCategories(orderedIds) {
  const existing = await getCategories();
  const map = Object.fromEntries(existing.map(c => [c.id, c]));
  const reordered = orderedIds
    .map((id, index) => map[id] ? { ...map[id], order: index } : null)
    .filter(Boolean);
  await apiPost('categories', reordered);
}

// ── Items ──────────────────────────────────────────────────────────────────────

export async function getItemsByCategory(categoryId) {
  const items = await apiGet('items', { categoryId });
  return Array.isArray(items) ? items.sort((a, b) => a.createdAt - b.createdAt) : [];
}

// Calls callback immediately then every 10 seconds.
// Returns an unsubscribe function.
export function subscribeToItems(categoryId, callback) {
  let cancelled = false;

  async function poll() {
    if (cancelled) return;
    try {
      callback(await getItemsByCategory(categoryId));
    } catch (e) {
      console.warn('subscribeToItems:', e.message);
    }
    if (!cancelled) setTimeout(poll, 10_000);
  }

  poll();
  return () => { cancelled = true; };
}

export async function addItem({ categoryId, label, imageBlob, audioBlob }) {
  const id = crypto.randomUUID();
  const [imageUrl, audioUrl] = await Promise.all([
    imageBlob ? uploadFile(imageBlob, `img-${id}`) : Promise.resolve(null),
    audioBlob ? uploadFile(audioBlob, `aud-${id}`) : Promise.resolve(null),
  ]);
  const item = { id, categoryId, label, imageUrl, audioUrl, createdAt: Date.now() };
  const existing = await getItemsByCategory(categoryId);
  await apiPost('items', [...existing, item], { categoryId });
  return item;
}

export async function updateItem(item, { newImageBlob, newAudioBlob } = {}) {
  const { id, categoryId } = item;
  let { imageUrl, audioUrl } = item;
  // Overwrite the file at the same stable ID so old URL keeps working
  // (browser and CDN already have it cached; new upload replaces server copy)
  if (newImageBlob) imageUrl = await uploadFile(newImageBlob, `img-${id}`);
  if (newAudioBlob) audioUrl = await uploadFile(newAudioBlob, `aud-${id}`);
  const updated = { ...item, imageUrl, audioUrl };
  const existing = await getItemsByCategory(categoryId);
  await apiPost('items', existing.map(i => i.id === id ? updated : i), { categoryId });
  return updated;
}

// categoryId is required so we can update the right items list in the store.
export async function deleteItem(id, categoryId) {
  await Promise.all([deleteFile(`img-${id}`), deleteFile(`aud-${id}`)]);
  const existing = await getItemsByCategory(categoryId);
  await apiPost('items', existing.filter(i => i.id !== id), { categoryId });
}

// ── Settings ───────────────────────────────────────────────────────────────────

export async function getSetting(key) {
  // Admin PIN stays on-device only (security credential, not synced)
  if (key === 'adminPin') return localStorage.getItem('adminPin') ?? null;
  try {
    return await apiGet('setting', { key });
  } catch {
    return null;
  }
}

export async function setSetting(key, value) {
  if (key === 'adminPin') {
    localStorage.setItem('adminPin', value);
    return;
  }
  if (key === 'iWantAudio' && value instanceof Blob) {
    const url = await uploadFile(value, 'setting-iWantAudio');
    await apiPost('setting', { value: url }, { key });
    return;
  }
  await apiPost('setting', { value }, { key });
}

// ── Init ───────────────────────────────────────────────────────────────────────

export async function initDefaults() {
  const existing = await getCategories();
  if (existing.length === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await addCategory(cat);
    }
  }
}
