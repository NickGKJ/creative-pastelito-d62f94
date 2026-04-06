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
