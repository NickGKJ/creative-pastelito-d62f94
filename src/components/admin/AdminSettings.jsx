import React, { useState, useEffect } from 'react';
import { useApp } from '../../AppContext';
import { getSetting, setSetting } from '../../db';
import PinEntry from '../PinEntry';
import AudioRecorder from './AudioRecorder';

const SIZES = [
  { value: 'small',  label: 'Small',  desc: 'More cards' },
  { value: 'medium', label: 'Medium', desc: 'Default' },
  { value: 'large',  label: 'Large',  desc: 'Fewer, bigger cards' },
];

export default function AdminSettings() {
  const { state, actions } = useApp();
  const [pinStep, setPinStep] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Netlify Blobs URL for the saved "I Want" audio
  const [savedAudioUrl, setSavedAudioUrl] = useState(null);
  const [pendingAudioBlob, setPendingAudioBlob] = useState(null);
  const [iWantSaved, setIWantSaved] = useState(false);
  const [iWantSaving, setIWantSaving] = useState(false);

  useEffect(() => {
    getSetting('iWantAudio').then(url => { if (url) setSavedAudioUrl(url); });
  }, []);

  const handleAudioChange = (blob) => {
    setPendingAudioBlob(blob);
    setIWantSaved(false);
    if (blob) setSavedAudioUrl(null);
  };

  const handleSaveIWantAudio = async () => {
    if (!pendingAudioBlob) return;
    setIWantSaving(true);
    try {
      await setSetting('iWantAudio', pendingAudioBlob);
      const url = await getSetting('iWantAudio');
      setSavedAudioUrl(url);
      setPendingAudioBlob(null);
      setIWantSaved(true);
      setTimeout(() => setIWantSaved(false), 3000);
    } finally {
      setIWantSaving(false);
    }
  };

  const handleVerifySuccess = () => setPinStep('new');
  const handleNewPinSet = (pin) => { setNewPin(pin); setPinStep('confirm'); };

  const handleConfirmPinSet = async (pin) => {
    if (pin !== newPin) { setPinStep('new'); setNewPin(''); return; }
    await setSetting('adminPin', pin);
    setPinStep(null);
    setSuccessMsg('PIN updated successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div>
      {/* I Want Button Audio */}
      <div className="admin-section" style={{ marginBottom: 16 }}>
        <div className="admin-section-header">🙋 "I Want" Button Audio</div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            Record yourself saying <strong>"I want…"</strong> so the button plays your voice when your child taps it.
          </p>

          {savedAudioUrl && !pendingAudioBlob ? (
            <div className="audio-recorder">
              <div className="audio-duration">
                <span className="audio-icon">🔊</span>
                Saved audio
                <audio controls src={savedAudioUrl} style={{ height: 28, marginLeft: 8, maxWidth: 180 }} />
              </div>
              <div className="audio-controls" style={{ marginTop: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setSavedAudioUrl(null)}>
                  🔄 Replace audio
                </button>
              </div>
            </div>
          ) : (
            <AudioRecorder audioBlob={pendingAudioBlob} onChange={handleAudioChange} />
          )}

          {pendingAudioBlob && (
            <button
              className="btn btn-success btn-full"
              style={{ marginTop: 14 }}
              onClick={handleSaveIWantAudio}
              disabled={iWantSaving}
            >
              {iWantSaving ? 'Uploading…' : iWantSaved ? '✓ Saved!' : 'Save "I Want" Audio'}
            </button>
          )}
        </div>
      </div>

      {/* Display size */}
      <div className="admin-section" style={{ marginBottom: 16 }}>
        <div className="admin-section-header">Card Display Size</div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
            Controls how large the image cards appear in the child view.
          </p>
          <div className="size-picker">
            {SIZES.map(({ value, label, desc }) => (
              <button
                key={value}
                className={`size-option ${state.displaySize === value ? 'active' : ''}`}
                onClick={() => actions.setDisplaySize(value)}
              >
                <div>{label}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: 2 }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PIN management */}
      <div className="admin-section">
        <div className="admin-section-header">Admin PIN</div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
            The PIN protects Admin from being accidentally accessed by your child.
            Each device has its own PIN stored locally.
          </p>
          {successMsg && (
            <p style={{ color: 'var(--admin-success)', fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>
              ✓ {successMsg}
            </p>
          )}
          <button className="btn btn-outline" onClick={() => { setPinStep('verify'); setSuccessMsg(''); }}>
            🔑 Change PIN
          </button>
        </div>
      </div>

      {/* About */}
      <div className="admin-section" style={{ marginTop: 16 }}>
        <div className="admin-section-header">About</div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', lineHeight: 1.6 }}>
            <strong>AAC App</strong> — Augmentative and Alternative Communication<br />
            Changes sync across all devices in real time via Netlify Blobs.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', marginTop: 10, lineHeight: 1.5 }}>
            Access Admin from child view: hold the small dot in the top-right corner of "I Want" for 2 seconds.
          </p>
        </div>
      </div>

      {pinStep === 'verify' && (
        <PinEntry title="Verify Current PIN" subtitle="Enter your current PIN to continue"
          onSuccess={handleVerifySuccess} onCancel={() => setPinStep(null)} showCancel />
      )}
      {pinStep === 'new' && (
        <PinEntry title="New PIN" subtitle="Choose a new 4-digit PIN"
          onSuccess={handleNewPinSet} onCancel={() => setPinStep(null)} showCancel skipValidation />
      )}
      {pinStep === 'confirm' && (
        <PinEntry title="Confirm New PIN" subtitle="Enter the new PIN again to confirm"
          validateAgainst={newPin} onSuccess={handleConfirmPinSet}
          onCancel={() => { setPinStep(null); setNewPin(''); }} showCancel />
      )}
    </div>
  );
}
