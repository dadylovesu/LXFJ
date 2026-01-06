import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Login } from './components/Login';
import { isAuthenticated } from './API/authService';

const Root: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 检查登录状态
    setAuthenticated(isAuthenticated());
    setChecking(false);
  }, []);

  const handleLoginSuccess = () => {
    setAuthenticated(true);
  };

  if (checking) {
    // 加载中状态
    return (
      <div className="flex items-center justify-center min-h-screen w-screen bg-cine-black">
        <div className="w-16 h-16 border-t-2 border-cine-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <App />;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);