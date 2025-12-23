
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const ApiKeyGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState<boolean | null>(null);

  useEffect(() => {
    const validateEnvironment = async () => {
      // 1. 检查环境变量 process.env.API_KEY 是否存在且有效
      const envKey = (process.env as any).API_KEY;
      if (envKey && envKey.length > 5) {
        console.debug("Using API_KEY from environment variables.");
        setIsReady(true);
        return;
      }

      // 2. 如果没有环境变量，检查 AI Studio 会话状态
      if (window.aistudio) {
        try {
          const hasStudioKey = await window.aistudio.hasSelectedApiKey();
          setIsReady(hasStudioKey);
        } catch (e) {
          setIsReady(false);
        }
      } else {
        // 3. 既没有环境变量也不是 AI Studio 环境，报备异常状态
        setIsReady(false);
      }
    };
    validateEnvironment();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // 策略性假设成功，直接尝试渲染 App
        setIsReady(true);
      } catch (e) {
        alert("无法打开 API Key 选择器，请检查浏览器权限。");
      }
    } else {
      alert("未检测到 API_KEY。请在 Vercel 中配置环境变量 API_KEY。");
    }
  };

  if (isReady === null) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-t-2 border-[#FF7A00] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="max-w-[440px] w-full bg-[#0d0d0d] border border-zinc-800 rounded-lg p-10 space-y-8 text-center shadow-2xl relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#FF7A00]/5 blur-[60px] pointer-events-none"></div>
          <div className="relative">
            <div className="w-20 h-20 bg-[#FF7A00]/10 rounded-full flex items-center justify-center mx-auto border border-[#FF7A00]/20 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3L15.5 7.5z"/>
              </svg>
            </div>
            <div className="space-y-4">
              <h2 className="text-white text-2xl font-bold font-mono tracking-tight uppercase">
                缺失 API KEY
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed font-mono px-4">
                无法从环境变量或会话中读取有效的 API KEY。使用 <span className="text-zinc-200">Gemini 3 Pro</span> 引擎进行渲染前，请先进行授权。
              </p>
            </div>
            <div className="pt-10 space-y-4">
              <button 
                onClick={handleSelectKey}
                className="w-full bg-[#FF7A00] text-black font-bold h-14 rounded-[4px] hover:brightness-110 transition-all uppercase tracking-[0.2em] text-sm shadow-[0_4px_20px_rgba(255,122,0,0.2)]"
              >
                选择或配置 API KEY
              </button>
              <div className="pt-2">
                <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                  提示：如果您已在 Vercel 配置，请确保变量名为 API_KEY
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element missing");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ApiKeyGate>
      <App />
    </ApiKeyGate>
  </React.StrictMode>
);
