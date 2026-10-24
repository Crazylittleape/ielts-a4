import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { SW_UPDATE_EVENT, watchServiceWorker } from './pwa';

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  let updating = false;
  window.addEventListener(SW_UPDATE_EVENT + ':apply', () => { updating = true; });
  // Reload only after the user chose to update; the first install's claim() must not reload.
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) { updating = false; location.reload(); } });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => watchServiceWorker(reg, () => Boolean(navigator.serviceWorker.controller), worker => {
      window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT, { detail: worker }));
    })).catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
