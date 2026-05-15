import React from 'react';
import ReactDOM from 'react-dom/client';
import WastelandTactics from './components/Game.jsx';
import { WtErrorBoundary } from './components/UiComponents.jsx';
import './styles.css';

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
