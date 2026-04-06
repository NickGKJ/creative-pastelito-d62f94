import React, { useState, useEffect, useRef } from 'react';
import { getSetting } from '../db';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'del'];

export default function PinEntry({ title, subtitle, onSuccess, onCancel, showCancel = false, validateAgainst = null, skipValidation = false }) {
  const [digits, setDigits] = useState([]);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const storedPin = useRef(null);

  useEffect(() => {
    if (skipValidation) {
      storedPin.current = null;
    } else if (validateAgainst !== null) {
      storedPin.current = validateAgainst;
    } else {
      getSetting('adminPin').then(p => { storedPin.current = p; });
    }
  }, [validateAgainst, skipValidation]);

  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setDigits([]);
    }, 400);
  };

  const handleKey = (key) => {
    if (key === 'del') {
      setDigits(d => d.slice(0, -1));
      setError('');
      return;
    }
    if (digits.length >= 4) return;
    const next = [...digits, key];
    setDigits(next);
    setError('');

    if (next.length === 4) {
      const entered = next.join('');
      if (skipValidation) {
        onSuccess(entered);
      } else if (entered === storedPin.current) {
        onSuccess(entered);
      } else {
        triggerError('Incorrect PIN. Try again.');
      }
    }
  };

  return (
    <div className="overlay" onClick={showCancel ? onCancel : undefined}>
      <div
        className={`pin-entry-card ${shake ? 'pin-shake' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="pin-entry-title">{title}</div>
        {subtitle && <div className="pin-entry-subtitle">{subtitle}</div>}

        <div className="pin-dots">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`pin-dot ${digits.length > i ? 'filled' : ''} ${error && digits.length === 0 ? 'error' : ''}`}
            />
          ))}
        </div>

        <div className="pin-keypad">
          {KEYS.map((key) => (
            <button
              key={key}
              className={`pin-key ${key === 'del' ? 'delete' : ''} ${key === 'empty' ? 'empty' : ''}`}
              onClick={() => key !== 'empty' && handleKey(key)}
              aria-label={key === 'del' ? 'Delete' : key === 'empty' ? '' : key}
            >
              {key === 'del' ? '⌫' : key === 'empty' ? '' : key}
            </button>
          ))}
        </div>

        <div className="pin-error-msg" aria-live="polite">{error}</div>

        {showCancel && (
          <button className="pin-cancel-btn btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
