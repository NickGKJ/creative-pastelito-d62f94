import React, { useState, useRef } from 'react';
import { addCategory, updateCategory, deleteCategory, reorderCategories } from '../../db';
import ConfirmDialog from '../ConfirmDialog';
import { useApp } from '../../AppContext';

const DEFAULT_EMOJI = '📁';

// ── Single category row ───────────────────────────────────────────────────────
function CategoryRow({ cat, index, total, onSelect, onMoveUp, onMoveDown, onEditStart, onDelete, dragHandlers }) {
  return (
    <div
      className="cat-row"
      draggable
      {...dragHandlers(cat.id)}
    >
      {/* Drag handle */}
      <div className="drag-handle" title="Drag to reorder">
        <span /><span /><span />
      </div>

      {/* Tap area → open items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }} onClick={() => onSelect(cat)}>
        <span className="cat-emoji">{cat.emoji}</span>
        <span className="cat-name">{cat.name}</span>
      </div>

      <div className="cat-actions" onClick={e => e.stopPropagation()}>
        {/* Up/down for accessibility on touch */}
        <button
          className="icon-btn"
          title="Move up"
          disabled={index === 0}
          onClick={() => onMoveUp(index)}
          style={{ opacity: index === 0 ? 0.3 : 1 }}
        >▲</button>
        <button
          className="icon-btn"
          title="Move down"
          disabled={index === total - 1}
          onClick={() => onMoveDown(index)}
          style={{ opacity: index === total - 1 ? 0.3 : 1 }}
        >▼</button>
        <button className="icon-btn" title="Edit" onClick={() => onEditStart(cat)}>✏️</button>
        <button className="icon-btn danger" title="Delete" onClick={() => onDelete(cat)}>🗑️</button>
      </div>
    </div>
  );
}

// ── Inline edit row ───────────────────────────────────────────────────────────
function EditRow({ cat, onSave, onCancel }) {
  const [name, setName] = useState(cat.name);
  const [emoji, setEmoji] = useState(cat.emoji);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ ...cat, name: name.trim(), emoji: emoji || DEFAULT_EMOJI });
  };

  return (
    <div className="cat-row" style={{ background: '#EBF4FF' }}>
      <input
        className="form-input emoji-input"
        value={emoji}
        onChange={e => setEmoji(e.target.value)}
        maxLength={2}
        placeholder="😀"
        style={{ width: 60, textAlign: 'center', fontSize: '1.4rem', padding: '7px 4px' }}
      />
      <input
        className="form-input"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Category name"
        style={{ flex: 1 }}
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
        maxLength={30}
      />
      <div className="cat-actions">
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!name.trim()}>Save</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main CategoryManager ──────────────────────────────────────────────────────
export default function CategoryManager({ onSelectCategory }) {
  const { state, actions } = useApp();
  const { categories } = state;
  const [editingId, setEditingId] = useState(null);
  const [deletingCat, setDeletingCat] = useState(null);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const dragSrcId = useRef(null);

  const refresh = () => actions.refreshCategories();

  // ── Drag-and-drop (desktop) ─────────────────────────────────────────────────
  const dragHandlers = (id) => ({
    onDragStart: (e) => {
      dragSrcId.current = id;
      e.currentTarget.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: (e) => {
      e.currentTarget.classList.remove('dragging');
    },
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      e.currentTarget.classList.add('drag-over');
    },
    onDragLeave: (e) => {
      e.currentTarget.classList.remove('drag-over');
    },
    onDrop: async (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      const targetId = id;
      const srcId = dragSrcId.current;
      if (!srcId || srcId === targetId) return;
      const ids = categories.map(c => c.id);
      const from = ids.indexOf(srcId);
      const to = ids.indexOf(targetId);
      if (from === -1 || to === -1) return;
      const reordered = [...ids];
      reordered.splice(from, 1);
      reordered.splice(to, 0, srcId);
      await reorderCategories(reordered);
      refresh();
    },
  });

  // ── Up/down reorder ─────────────────────────────────────────────────────────
  const moveUp = async (index) => {
    if (index === 0) return;
    const ids = categories.map(c => c.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    await reorderCategories(ids);
    refresh();
  };

  const moveDown = async (index) => {
    if (index === categories.length - 1) return;
    const ids = categories.map(c => c.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    await reorderCategories(ids);
    refresh();
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEditSave = async (updated) => {
    await updateCategory(updated);
    setEditingId(null);
    refresh();
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    await deleteCategory(deletingCat.id);
    setDeletingCat(null);
    refresh();
  };

  // ── Add new ─────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addCategory({ name: newName.trim(), emoji: newEmoji || DEFAULT_EMOJI });
    setNewName('');
    setNewEmoji('');
    refresh();
  };

  return (
    <div>
      <div className="admin-section">
        <div className="admin-section-header">
          Categories — tap a row to manage its items
        </div>

        {categories.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.9rem' }}>
            No categories yet. Add one below.
          </div>
        )}

        {categories.map((cat, idx) =>
          editingId === cat.id ? (
            <EditRow
              key={cat.id}
              cat={cat}
              onSave={handleEditSave}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <CategoryRow
              key={cat.id}
              cat={cat}
              index={idx}
              total={categories.length}
              onSelect={onSelectCategory}
              onMoveUp={moveUp}
              onMoveDown={moveDown}
              onEditStart={(c) => setEditingId(c.id)}
              onDelete={setDeletingCat}
              dragHandlers={dragHandlers}
            />
          )
        )}

        {/* Add new row */}
        <div className="add-cat-form">
          <input
            className="form-input emoji-input"
            value={newEmoji}
            onChange={e => setNewEmoji(e.target.value)}
            placeholder="😀"
            maxLength={2}
            style={{ width: 64, textAlign: 'center', fontSize: '1.4rem', padding: '9px 4px' }}
          />
          <input
            className="form-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New category name"
            style={{ flex: 1, minWidth: 120 }}
            maxLength={30}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={!newName.trim()}
          >
            + Add Category
          </button>
        </div>
      </div>

      {deletingCat && (
        <ConfirmDialog
          title="Delete Category?"
          message={`"${deletingCat.name}" and all its items will be permanently deleted.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingCat(null)}
        />
      )}
    </div>
  );
}
