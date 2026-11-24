import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  const isViteWsNoise = (value: unknown): boolean => {
    const text =
      typeof value === 'string'
        ? value
        : value instanceof Error
        ? `${value.name} ${value.message}`
        : String(value ?? '');
    const lower = text.toLowerCase();
    return (
      lower.includes('websocket closed without opened') ||
      lower.includes('[vite] failed to connect to websocket')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isViteWsNoise(event.reason)) {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    if (isViteWsNoise(event.message) || isViteWsNoise(event.error)) {
      event.preventDefault();
    }
  });

  // Unregister any leftover browser service workers cleanly
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        regs.forEach((reg) => {
          void reg.unregister();
        });
      })
      .catch(() => undefined);
  }
}

createRoot(document.getElementById('root')!).render(<App />);
