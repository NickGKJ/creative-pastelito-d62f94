import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../AppContext';
import { subscribeToItems, getSetting } from '../db';
import { useLongPress } from '../hooks/useLongPress';

const TAB_COLORS = [
  'var(--tab-0)', 'var(--tab-1)', 'var(--tab-2)', 'var(--tab-3)',
  'var(--tab-4)', 'var(--tab-5)', 'var(--tab-6)', 'var(--tab-7)',
];

// ── Single image card ─────────────────────────────────────────────────────────
function ImageCard({ item }) {
  const [tapped, setTapped] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  // Pre-load audio from the Firebase Storage URL so the first tap is instant.
  useEffect(() => {
    setAudioError(false);
    if (!item.audioUrl) { setAudioError(true); return; }
    const audio = new Audio(item.audioUrl);
    audio.preload = 'auto';
    audio.load();
    audio.onerror = () => setAudioError(true);
    audioRef.current = audio;
    return () => { audio.pause(); audioRef.current = null; };
  }, [item.audioUrl]);

  const handleTap = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setAudioError(true));
    }
    setTapped(true);
    setTimeout(() => setTapped(false), 350);
  };

  return (
    <div
      className={`image-card ${tapped ? 'tapped' : ''}`}
      onClick={handleTap}
      role="button"
      tabIndex={0}
      aria-label={item.label}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleTap()}
    >
      <div className="card-image-wrap">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.label} draggable={false} />
          : <div className="card-image-placeholder">🖼️</div>
        }
      </div>
      <div className="card-label">{item.label}</div>
      {audioError && <div className="card-audio-error" title="Audio unavailable">⚠️</div>}
    </div>
  );
}

// ── I Want button ─────────────────────────────────────────────────────────────
function IWantButton({ audioUrl, onRequestAdmin }) {
  const [active, setActive] = useState(false);
  const audioRef = useRef(null);
  const { pressing, handlers } = useLongPress(onRequestAdmin, 2000);

  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.load();
    audioRef.current = audio;
    return () => { audio.pause(); audioRef.current = null; };
  }, [audioUrl]);

  const handlePress = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    setActive(true);
    setTimeout(() => setActive(false), 400);
  };

  return (
    <div className="i-want-wrap">
      <button
        className={`i-want-btn ${active ? 'i-want-btn--active' : ''}`}
        onClick={handlePress}
        aria-label="I want"
      >
        <span className="i-want-hand">🙋</span>
        <span className="i-want-text">I Want</span>
      </button>
      {/* Invisible long-press zone — hold 2 s to open admin */}
      <div
        className={`admin-trigger-corner ${pressing ? 'pressing' : ''}`}
        {...handlers}
        aria-label="Hold to access admin"
        role="button"
        tabIndex={-1}
      >
        <div className="admin-trigger-dot" />
      </div>
    </div>
  );
}

// ── Category tabs ─────────────────────────────────────────────────────────────
function CategoryTabs({ categories, currentId, onSelect }) {
  return (
    <div className="category-tabs" role="tablist">
      {categories.map((cat, idx) => {
        const bg = TAB_COLORS[idx % TAB_COLORS.length];
        const isActive = cat.id === currentId;
        return (
          <button
            key={cat.id}
            role="tab"
            aria-selected={isActive}
            className={`category-tab ${isActive ? 'active' : ''}`}
            style={{ background: bg }}
            onClick={() => onSelect(cat.id)}
          >
            <span className="tab-emoji" aria-hidden="true">{cat.emoji}</span>
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Main ChildView ────────────────────────────────────────────────────────────
export default function ChildView({ onRequestAdmin }) {
  const { state, actions } = useApp();
  const { categories, currentCategoryId, displaySize } = state;
  const [items, setItems] = useState([]);
  const [iWantAudioUrl, setIWantAudioUrl] = useState(null);

  // Real-time item sync — updates instantly when admin adds/edits on any device
  useEffect(() => {
    if (!currentCategoryId) return;
    return subscribeToItems(currentCategoryId, setItems);
  }, [currentCategoryId]);

  useEffect(() => {
    getSetting('iWantAudio').then(url => { if (url) setIWantAudioUrl(url); });
  }, []);

  const handleSelectCategory = useCallback((id) => {
    actions.setCurrentCategory(id);
  }, [actions]);

  return (
    <div className="child-view">
      {/* Category tabs — top of screen */}
      <CategoryTabs
        categories={categories}
        currentId={currentCategoryId}
        onSelect={handleSelectCategory}
      />

      {/* I Want button — below tabs */}
      <IWantButton audioUrl={iWantAudioUrl} onRequestAdmin={onRequestAdmin} />

      {/* Scrollable image grid */}
      <div className="child-grid-area" role="main">
        {items.length === 0 ? (
          <div className="empty-category">
            <div className="empty-icon">🖼️</div>
            <p>No items yet — ask a grown-up to add some!</p>
          </div>
        ) : (
          <div className={`child-grid size-${displaySize}`}>
            {items.map(item => (
              <ImageCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
