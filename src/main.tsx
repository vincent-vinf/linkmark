import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator) window.addEventListener('load', () => {
  void navigator.serviceWorker.register('/sw.js').then((registration) => {
    registration.onupdatefound = () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.onstatechange = () => { if (worker.state === 'installed' && navigator.serviceWorker.controller && window.confirm('Linkmark 有安全更新，立即重新加载？')) window.location.reload(); };
    };
  });
});
