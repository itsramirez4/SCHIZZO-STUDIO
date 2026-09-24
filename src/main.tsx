import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ReferenceWindowView from './components/References/ReferenceWindowView';
import './styles/globals.css';
import './i18n';
import { installCheckHook } from './checkHook';
import { installGlobalErrorCapture } from './services/diagnostics.service';
import { useLanguageStore } from './store/languageStore';

installCheckHook();
installGlobalErrorCapture();

// A floating reference window loads this same bundle with a `?refWindow=<id>` query param (see
// electron/handlers/referenceWindowHandler.ts) — render its minimal viewer instead of the full
// app shell in that case, checked here rather than inside App.tsx to keep this branch from
// touching the main app's own logic at all.
const isReferenceWindow = new URLSearchParams(window.location.search).has('refWindow');

// Resolve the effective language (stored preference, or the system's, falling back to English)
// before the first render, so there's no flash of the wrong language on startup.
useLanguageStore
  .getState()
  .bootstrap()
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>{isReferenceWindow ? <ReferenceWindowView /> : <App />}</React.StrictMode>
    );
  });
