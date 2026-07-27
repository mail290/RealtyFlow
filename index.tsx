
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { startSync } from './services/care/syncQueue';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Offline shell for the Care inspection app (Fase 2).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW registration failed', e));
  });
}

// Start draining the inspection sync queue (online event, startup, 30s tick).
startSync();
