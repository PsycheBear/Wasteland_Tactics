import React from 'react';
import ReactDOM from 'react-dom/client';
import WastelandTactics from './components/Game.jsx';
import { WtErrorBoundary } from './components/UiComponents.jsx';
import { logError } from './lib/logger.js';
import './styles.css';

// Global error listeners — catch anything that escapes React's error boundary
// (resource loads, async tasks, promise rejections) and route it through the
// same ring buffer so the ProfilePanel can show it.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    logError(e.error || e.message || 'window error', { source: 'window.error', filename: e.filename, lineno: e.lineno, colno: e.colno });
  });
  window.addEventListener('unhandledrejection', (e) => {
    logError(e.reason || 'unhandled rejection', { source: 'unhandledrejection' });
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <WtErrorBoundary>
        <WastelandTactics />
      </WtErrorBoundary>
    </React.StrictMode>
  );
}
