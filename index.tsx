
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 正确定义 AIStudio 接口，避免与环境冲突
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
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        try {
          const result = await window.aistudio.hasSelectedApiKey();
          setHasKey(result);
        } catch (e) {
          setHasKey(false);
        }
      } else {
        // 如果不在 AI Studio 环境下，假设环境变量已配置
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // 按照规范：触发选择后立即假设成功以避免竞态延迟
        setHasKey(true);
      } catch (e) {
        console.error("Failed to open key selection", e);
      }
    }
  };

  if (hasKey === null) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-t-2 border-[#FF7A00] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="max-w-[440px] w-full bg-[#0d0d0d] border border-zinc-800 rounded-lg p-10 space-y-8 text-center shadow-2xl relative overflow-hidden">
          {/* 装饰性光晕 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#FF7A00]/5 blur-[60px] pointer-events-none"></div>
          
          <div className="relative">
            <div className="w-20 h-20 bg-[#FF7A00]/10 rounded-full flex items-center justify-center mx-auto border border-[#FF7A00]/20 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3L15.5 7.5z"/>
              </svg>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-white text-2xl font-bold font-mono tracking-tight flex items-center justify-center gap-2">
                需要选择 <span className="text-white">API KEY</span>
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed font-mono px-4">
                使用 <span className="text-zinc-200">Gemini 3 Pro</span> 引擎进行高保真分镜渲染需要您的专属付费项目 <span className="text-[#FF7A00]">API KEY</span>。
              </p>
            </div>

            <div className="pt-10 space-y-4">
              <button 
                onClick={handleSelectKey}
                className="w-full bg-[#FF7A00] text-black font-bold h-14 rounded-[4px] hover:brightness-110 transition-all uppercase tracking-[0.2em] text-sm shadow-[0_4px_20px_rgba(255,122,0,0.2)]"
              >
                选择 API KEY
              </button>
              
              <div className="pt-2">
                <a 
                  href="https://ai.google.dev/gemini-api/docs/billing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[10px] text-zinc-500 hover:text-zinc-300 font-mono uppercase tracking-widest transition-colors"
                >
                  查看计费与额度说明
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
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
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ApiKeyGate>
      <App />
    </ApiKeyGate>
  </React.StrictMode>
);
