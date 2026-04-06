import React, { useState } from 'react';
import { setSetting } from '../db';
import { useApp } from '../AppContext';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'del'];

function PinPad({ value, onChange, label }) {
  const handleKey = (key) => {
    if (key === 'del') { onChange(value.slice(0, -1)); return; }
    if (value.length >= 4) return;
    onChange(value + key);
  };

  return (
    <div>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--admin-text-secondary)', marginBottom: 10 }}>
        {label}
      </div>
      <div className="pin-dots" style={{ marginBottom: 14, justifyContent: 'flex-start', gap: 12 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`pin-dot ${value.length > i ? 'filled' : ''}`} />
        ))}
      </div>
      <div className="pin-keypad">
        {KEYS.map((key) => (
          <button
            key={key}
            className={`pin-key ${key === 'del' ? 'delete' : ''} ${key === 'empty' ? 'empty' : ''}`}
            onClick={() => key !== 'empty' && handleKey(key)}
          >
            {key === 'del' ? '⌫' : key === 'empty' ? '' : key}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FirstLaunch() {
  const { actions } = useApp();
  const [step, setStep] = useState('welcome'); // 'welcome' | 'pin1' | 'pin2'
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');

  const handlePin1Next = () => {
    if (pin1.length < 4) { setError('Please enter all 4 digits.'); return; }
    setError('');
    setStep('pin2');
  };

  const handleConfirm = async () => {
    if (pin2.length < 4) { setError('Please enter all 4 digits.'); return; }
    if (pin1 !== pin2) {
      setError('PINs do not match. Please try again.');
      setPin2('');
      return;
    }
    setError('');
    await setSetting('adminPin', pin1);
    await actions.completeFirstLaunch();
  };

  return (
    <div className="first-launch">
      <div className="first-launch-card">
        {step === 'welcome' && (
          <>
            <div className="first-launch-icon">🗣️</div>
            <h1>AAC App</h1>
            <p className="subtitle">
              A communication app for your child.<br />
              Let's get you set up in just a moment.
            </p>
            <div className="first-launch-step">
              <h3>What you'll do next</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--admin-text-secondary)', lineHeight: 1.6 }}>
                Create a 4-digit PIN to protect Admin settings,
                then add images and audio so your child can communicate.
              </p>
            </div>
            <button className="btn btn-primary btn-lg btn-full" style={{ marginTop: 8 }} onClick={() => setStep('pin1')}>
              Get Started →
            </button>
          </>
        )}

        {step === 'pin1' && (
          <>
            <div className="first-launch-icon">🔒</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>Create Admin PIN</h1>
            <p className="subtitle" style={{ marginBottom: 24 }}>
              This PIN locks the admin settings from your child.
            </p>
            <div className="first-launch-step">
              <PinPad value={pin1} onChange={setPin1} label="Choose a 4-digit PIN" />
            </div>
            {error && <p style={{ color: 'var(--admin-danger)', fontSize: '0.85rem', fontWeight: 700, marginTop: 8 }}>{error}</p>}
            <button
              className="btn btn-primary btn-lg btn-full"
              style={{ marginTop: 16 }}
              onClick={handlePin1Next}
              disabled={pin1.length < 4}
            >
              Next →
            </button>
          </>
        )}

        {step === 'pin2' && (
          <>
            <div className="first-launch-icon">✅</div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>Confirm PIN</h1>
            <p className="subtitle" style={{ marginBottom: 24 }}>
              Enter your PIN again to confirm.
            </p>
            <div className="first-launch-step">
              <PinPad value={pin2} onChange={setPin2} label="Confirm your PIN" />
            </div>
            {error && <p style={{ color: 'var(--admin-danger)', fontSize: '0.85rem', fontWeight: 700, marginTop: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => { setStep('pin1'); setPin2(''); setError(''); }}>
                Back
              </button>
              <button
                className="btn btn-primary btn-lg"
                style={{ flex: 1 }}
                onClick={handleConfirm}
                disabled={pin2.length < 4}
              >
                Save &amp; Continue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
