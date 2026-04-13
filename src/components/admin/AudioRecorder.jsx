import React, { useState, useRef, useEffect } from 'react';

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * AudioRecorder — lets parent record via microphone or upload a file.
 *
 * Props:
 *   audioBlob   — current audio Blob (null if none)
 *   onChange    — (blob: Blob) => void
 */
export default function AudioRecorder({ audioBlob, onChange }) {
  const [state, setState] = useState('idle'); // 'idle' | 'recording' | 'done'
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const mimeType = getSupportedMimeType();
  const canRecord = mimeType !== null;

  // Build preview URL from incoming audioBlob prop
  useEffect(() => {
    if (!audioBlob) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(audioBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  // Compute duration when we have a blob
  useEffect(() => {
    if (!audioBlob) { setDuration(0); return; }
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    });
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const options = mimeType ? { mimeType } : {};
      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        onChange(blob);
        setState('done');
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start(200);
      setState('recording');

      // Live timer
      let elapsed = 0;
      setDuration(0);
      timerRef.current = setInterval(() => {
        elapsed += 0.1;
        setDuration(elapsed);
      }, 100);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access and try again.');
      } else {
        setError('Could not start recording. Please try uploading a file instead.');
      }
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/webm', 'audio/ogg'];
    if (!allowed.some(t => file.type.startsWith('audio/'))) {
      setError('Please upload an MP3, WAV, or other audio file.');
      return;
    }
    setError('');
    onChange(file);
    setState('done');
  };

  const handleReRecord = () => {
    setState('idle');
    onChange(null);
    setDuration(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="audio-recorder">
      <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--admin-text-secondary)', marginBottom: 10 }}>
        Audio Clip
      </div>

      {state === 'recording' && (
        <div className="audio-recorder-status">
          <div className="rec-dot" />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--admin-danger)' }}>
            Recording… {formatDuration(duration)}
          </span>
          <div className="audio-waveform">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="waveform-bar" style={{ height: '8px' }} />
            ))}
          </div>
        </div>
      )}

      {(state === 'idle' || state === 'done') && audioBlob && (
        <div className="audio-duration">
          <span className="audio-icon">🔊</span>
          {duration > 0 ? `Audio clip — ${formatDuration(duration)}` : 'Audio clip ready'}
          {previewUrl && (
            <audio controls src={previewUrl} style={{ height: 28, marginLeft: 8, maxWidth: 180 }} />
          )}
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--admin-danger)', fontSize: '0.82rem', fontWeight: 700, marginBottom: 10 }}>
          {error}
        </p>
      )}

      <div className="audio-controls">
        {state === 'idle' && !audioBlob && (
          <>
            {canRecord && (
              <button className="btn btn-primary btn-sm" onClick={startRecording}>
                🎙 Record
              </button>
            )}
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              📁 Upload audio
              <input
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </label>
          </>
        )}

        {state === 'recording' && (
          <button className="btn btn-danger btn-sm" onClick={stopRecording}>
            ⏹ Stop Recording
          </button>
        )}

        {(state === 'done' || audioBlob) && state !== 'recording' && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={handleReRecord}>
              🔄 Re-record
            </button>
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
              📁 Upload instead
              <input
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
