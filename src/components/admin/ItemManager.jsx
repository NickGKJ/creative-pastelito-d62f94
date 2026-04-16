import React, { useState, useEffect } from 'react';
import { subscribeToItems, addItem, updateItem, deleteItem } from '../../db';
import AudioRecorder from './AudioRecorder';
import ConfirmDialog from '../ConfirmDialog';

// ── Item card in the admin grid ───────────────────────────────────────────────
function ItemCard({ item, onEdit, onDelete }) {
  return (
    <div className="item-card">
      <div className="item-card-image">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.label} />
          : <div className="placeholder">🖼️</div>
        }
      </div>
      <div className="item-card-info">
        <div className="item-card-label">{item.label}</div>
        <div className="item-card-actions">
          <button className="btn btn-outline btn-sm" onClick={() => onEdit(item)}>Edit</button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(item)}>✕</button>
        </div>
      </div>
    </div>
  );
}

// Compress an image to ≤ 1024px and 85% JPEG quality before uploading.
// Keeps file size well within Netlify's 6 MB function body limit.
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round(height * MAX / width); width = MAX; }
        else                 { width  = Math.round(width  * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    };
    img.onerror = () => resolve(file); // fallback: use original
    img.src = objectUrl;
  });
}

// ── Item editor sheet ─────────────────────────────────────────────────────────
function ItemEditor({ item, categoryId, onSave, onClose }) {
  const [label, setLabel] = useState(item?.label ?? '');
  // Existing Netlify Blobs URLs (cleared if user replaces them)
  const [existingImageUrl, setExistingImageUrl] = useState(item?.imageUrl ?? null);
  const [existingAudioUrl, setExistingAudioUrl] = useState(item?.audioUrl ?? null);
  // New blobs chosen this session (uploaded on Save)
  const [newImageBlob, setNewImageBlob] = useState(null);
  const [newAudioBlob, setNewAudioBlob] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Local preview URL for a newly picked image
  useEffect(() => {
    if (!newImageBlob) { setImgPreview(null); return; }
    const url = URL.createObjectURL(newImageBlob);
    setImgPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [newImageBlob]);

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    setError('');
    const compressed = await compressImage(file);
    setNewImageBlob(compressed);
  };

  const handleAudioChange = (blob) => {
    setNewAudioBlob(blob);
    if (blob) setExistingAudioUrl(null);
  };

  const handleSave = async () => {
    if (!label.trim()) { setError('Please enter a label.'); return; }
    if (!existingImageUrl && !newImageBlob) { setError('Please add an image.'); return; }
    if (!existingAudioUrl && !newAudioBlob) { setError('Please add an audio clip.'); return; }
    setError('');
    setSaving(true);
    try {
      if (item) {
        await updateItem(
          { ...item, label: label.trim() },
          { newImageBlob: newImageBlob ?? undefined, newAudioBlob: newAudioBlob ?? undefined }
        );
      } else {
        await addItem({ categoryId, label: label.trim(), imageBlob: newImageBlob, audioBlob: newAudioBlob });
      }
      onSave();
    } catch {
      setError('Failed to save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const shownImageSrc = imgPreview || existingImageUrl;

  return (
    <div className="item-editor-overlay" onClick={onClose}>
      <div className="item-editor-sheet" onClick={e => e.stopPropagation()}>
        <div className="item-editor-header">
          <h2>{item ? 'Edit Item' : 'Add New Item'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
        </div>

        {/* Image upload */}
        <div className="form-group">
          <label className="form-label">Image</label>
          <div className="image-upload-zone">
            {shownImageSrc && <img src={shownImageSrc} alt="Preview" />}
            {!shownImageSrc && (
              <div className="upload-prompt">
                <span className="icon">📷</span>
                <span>Tap to choose an image</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>from camera roll or files</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleImageFile} />
          </div>
          {shownImageSrc && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }}
              onClick={() => { setNewImageBlob(null); setExistingImageUrl(null); }}>
              Replace image
            </button>
          )}
        </div>

        {/* Label */}
        <div className="form-group">
          <label className="form-label" htmlFor="item-label">Label</label>
          <input
            id="item-label"
            className="form-input"
            type="text"
            placeholder="e.g. Apple, Happy, Park…"
            value={label}
            onChange={e => { setLabel(e.target.value); setError(''); }}
            maxLength={40}
          />
        </div>

        {/* Audio */}
        <div className="form-group">
          {existingAudioUrl && !newAudioBlob ? (
            <div className="audio-recorder">
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--admin-text-secondary)', marginBottom: 10 }}>
                Audio Clip
              </div>
              <div className="audio-duration">
                <span className="audio-icon">🔊</span>
                Saved audio
                <audio controls src={existingAudioUrl} style={{ height: 28, marginLeft: 8, maxWidth: 180 }} />
              </div>
              <div className="audio-controls" style={{ marginTop: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setExistingAudioUrl(null)}>
                  🔄 Replace audio
                </button>
              </div>
            </div>
          ) : (
            <AudioRecorder audioBlob={newAudioBlob} onChange={handleAudioChange} />
          )}
        </div>

        {error && (
          <p style={{ color: 'var(--admin-danger)', fontSize: '0.85rem', fontWeight: 700, marginBottom: 12 }}>
            ⚠️ {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
            {saving ? 'Uploading…' : (item ? 'Save Changes' : 'Add Item')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ItemManager ──────────────────────────────────────────────────────────
export default function ItemManager({ category, onBack }) {
  const [items, setItems] = useState([]);
  const [editingItem, setEditingItem] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [deletingItem, setDeletingItem] = useState(null);

  // Real-time subscription — items update on all devices as soon as any change is made
  useEffect(() => {
    return subscribeToItems(category.id, setItems);
  }, [category.id]);

  const handleSave = () => setEditingItem(undefined);

  const handleDeleteConfirm = async () => {
    await deleteItem(deletingItem.id, deletingItem.categoryId);
    setDeletingItem(null);
  };

  return (
    <div>
      <button className="back-btn btn" onClick={onBack}>← Back to Categories</button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: '1.6rem', marginRight: 8 }}>{category.emoji}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--admin-text)' }}>
            {category.name}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--admin-text-secondary)', marginLeft: 8 }}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <button className="btn btn-primary" onClick={() => setEditingItem(null)}>+ Add Item</button>
      </div>

      {items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          background: 'var(--admin-surface)', borderRadius: 'var(--admin-radius)',
          border: '1.5px dashed var(--admin-border)', color: 'var(--admin-text-secondary)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>No items yet</p>
          <p style={{ fontSize: '0.85rem' }}>Tap "Add Item" to add an image, label, and audio clip.</p>
        </div>
      ) : (
        <div className="item-grid">
          {items.map(item => (
            <ItemCard key={item.id} item={item} onEdit={setEditingItem} onDelete={setDeletingItem} />
          ))}
        </div>
      )}

      {editingItem !== undefined && (
        <ItemEditor
          item={editingItem}
          categoryId={category.id}
          onSave={handleSave}
          onClose={() => setEditingItem(undefined)}
        />
      )}

      {deletingItem && (
        <ConfirmDialog
          title="Delete Item?"
          message={`"${deletingItem.label}" will be permanently deleted.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingItem(null)}
        />
      )}
    </div>
  );
}
