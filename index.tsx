import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Fix: Define the named AIStudio interface and use it for the Window declaration.
// Added the optional modifier (?) to satisfy 'identical modifiers' requirement and match platform definitions.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

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
