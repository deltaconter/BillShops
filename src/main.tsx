import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Enregistrement du Service Worker pour la PWA
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/public/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(<App />);
