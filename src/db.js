import { firestoreDb, storage } from './firebase';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  setDoc, getDoc, query, where, writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export const DEFAULT_CATEGORIES = [
  { name: 'Food', emoji: '🍎' },
  { name: 'Play', emoji: '🎮' },
  { name: 'Feelings', emoji: '😊' },
  { name: 'People', emoji: '👨‍👩‍👧' },
  { name: 'Places', emoji: '🏠' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadBlob(path, blob) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

async function tryDeleteStorageFile(path) {
  try { await deleteObject(ref(storage, path)); } catch { /* file may not exist */ }
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories() {
  const snap = await getDocs(collection(firestoreDb, 'categories'));
  const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return cats.sort((a, b) => a.order - b.order);
}

export async function addCategory({ name, emoji }) {
  const existing = await getCategories();
  const maxOrder = existing.length > 0 ? Math.max(...existing.map(c => c.order)) + 1 : 0;
  const data = { name, emoji, order: maxOrder, createdAt: Date.now() };
  const docRef = await addDoc(collection(firestoreDb, 'categories'), data);
  return { id: docRef.id, ...data };
}

export async function updateCategory(category) {
  const { id, ...data } = category;
  await updateDoc(doc(firestoreDb, 'categories', id), data);
}

export async function deleteCategory(id) {
  const items = await getItemsByCategory(id);
  const batch = writeBatch(firestoreDb);
  for (const item of items) {
    await tryDeleteStorageFile(`items/${item.id}/image`);
    await tryDeleteStorageFile(`items/${item.id}/audio`);
    batch.delete(doc(firestoreDb, 'items', item.id));
  }
  batch.delete(doc(firestoreDb, 'categories', id));
  await batch.commit();
}

export async function reorderCategories(orderedIds) {
  const batch = writeBatch(firestoreDb);
  orderedIds.forEach((id, index) => {
    batch.update(doc(firestoreDb, 'categories', id), { order: index });
  });
  await batch.commit();
}

// ── Items ─────────────────────────────────────────────────────────────────────
// Items stored in Firestore with imageUrl / audioUrl (Firebase Storage download URLs)
// instead of blobs. Blobs are uploaded to Storage on add/update.

export async function getItemsByCategory(categoryId) {
  const q = query(collection(firestoreDb, 'items'), where('categoryId', '==', categoryId));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addItem({ categoryId, label, imageBlob, audioBlob }) {
  const id = crypto.randomUUID();
  const [imageUrl, audioUrl] = await Promise.all([
    imageBlob ? uploadBlob(`items/${id}/image`, imageBlob) : Promise.resolve(null),
    audioBlob ? uploadBlob(`items/${id}/audio`, audioBlob) : Promise.resolve(null),
  ]);
  const data = { categoryId, label, imageUrl, audioUrl, createdAt: Date.now() };
  await setDoc(doc(firestoreDb, 'items', id), data);
  return { id, ...data };
}

// Pass newImageBlob / newAudioBlob if the user has chosen a replacement file.
// Leave them undefined to keep the existing URLs.
export async function updateItem(item, { newImageBlob, newAudioBlob } = {}) {
  const { id, ...data } = item;
  if (newImageBlob) {
    data.imageUrl = await uploadBlob(`items/${id}/image`, newImageBlob);
  }
  if (newAudioBlob) {
    data.audioUrl = await uploadBlob(`items/${id}/audio`, newAudioBlob);
  }
  await updateDoc(doc(firestoreDb, 'items', id), data);
  return { id, ...data };
}

export async function deleteItem(id) {
  await tryDeleteStorageFile(`items/${id}/image`);
  await tryDeleteStorageFile(`items/${id}/audio`);
  await deleteDoc(doc(firestoreDb, 'items', id));
}

// ── Settings ──────────────────────────────────────────────────────────────────
// adminPin is stored locally (localStorage) — intentionally not synced so each
// device can have its own PIN protecting the admin screen.
// All other settings sync via Firestore.
// iWantAudio value is a Storage download URL string (not a Blob).

export async function getSetting(key) {
  if (key === 'adminPin') {
    return localStorage.getItem('adminPin') ?? null;
  }
  const snap = await getDoc(doc(firestoreDb, 'settings', key));
  return snap.exists() ? snap.data().value : null;
}

export async function setSetting(key, value) {
  if (key === 'adminPin') {
    localStorage.setItem('adminPin', value);
    return;
  }
  // iWantAudio is saved as a Blob — upload to Storage, store URL
  if (key === 'iWantAudio' && value instanceof Blob) {
    const url = await uploadBlob('settings/iWantAudio', value);
    await setDoc(doc(firestoreDb, 'settings', 'iWantAudio'), { value: url });
    return;
  }
  await setDoc(doc(firestoreDb, 'settings', key), { value });
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initDefaults() {
  const existing = await getCategories();
  if (existing.length === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await addCategory(cat);
    }
  }
}
