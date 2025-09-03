import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Inject global styles for animations and toast notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeInFast {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeInRight {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes scaleIn {
    from { transform: scale(0.95); }
    to { transform: scale(1); }
  }
  .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
  .animate-fade-in-fast { animation: fadeInFast 0.2s ease-out forwards; }
  .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
  .animate-fade-in-right { animation: fadeInRight 0.4s ease-out forwards; }
  .animate-scale-in { animation: scaleIn 0.2s ease-out forwards; }

  .toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-end;
  }
  .toast {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    animation: fadeInRight 0.3s ease-out;
    color: white;
    font-weight: 500;
  }
  .toast.success { background-color: #22c55e; } /* green-500 */
  .toast.error { background-color: #ef4444; } /* red-500 */
  .toast.warning { background-color: #f59e0b; } /* amber-500 */
`;
document.head.appendChild(style);


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