import React, { useState } from 'react';
import { AppProvider, useApp } from './AppContext';
import FirstLaunch from './components/FirstLaunch';
import PinEntry from './components/PinEntry';
import ChildView from './components/ChildView';
import AdminView from './components/admin/AdminView';

function AppInner() {
  const { state, actions } = useApp();
  const [showPinEntry, setShowPinEntry] = useState(false);

  if (state.view === 'loading') {
    return <div className="loading-screen">🔄</div>;
  }

  if (state.view === 'error') {
    return (
      <div className="loading-screen" style={{ flexDirection: 'column', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h2 style={{ margin: 0 }}>Unable to Connect</h2>
        <p style={{ margin: 0, maxWidth: '400px', color: '#666' }}>
          The app could not connect to the database. Please check your internet connection and try again.
        </p>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#999' }}>{state.error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '0.5rem', padding: '0.75rem 2rem', fontSize: '1.1rem',
            borderRadius: '12px', border: 'none', background: '#4A90D9', color: '#fff', cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.view === 'firstLaunch') {
    return <FirstLaunch />;
  }

  return (
    <>
      {state.view === 'child' && (
        <ChildView
          onRequestAdmin={() => setShowPinEntry(true)}
        />
      )}

      {state.view === 'admin' && (
        <AdminView
          onExit={() => actions.setView('child')}
        />
      )}

      {showPinEntry && (
        <PinEntry
          title="Admin Access"
          subtitle="Enter your 4-digit PIN"
          onSuccess={() => {
            setShowPinEntry(false);
            actions.setView('admin');
          }}
          onCancel={() => setShowPinEntry(false)}
          showCancel
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
