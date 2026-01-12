
import React, { useState, useEffect } from 'react';
import { X, Video, Sparkles, Check, RefreshCw, Trash2, LayoutGrid, Info, Wand2, Zap, History, FileText } from 'lucide-react';
import { Button } from './Button';
import { generateCameraSuggestions } from '../services/geminiService';
import { GeneratedImage } from '../types';

interface CameraEditorProps {
  isOpen: boolean;
  onClose: () => void;
  rows: number;
  cols: number;
  mainPrompt: string;
  initialPrompts: string[];
  onSave: (prompts: string[]) => void;
  selectedImage?: GeneratedImage; // 改为 selectedImage 用于隔离显示历史
  onRegenSlice?: (index: number, prompt: string) => void;
  isGenerating?: boolean;
}

export const CameraEditor: React.FC<CameraEditorProps> = ({
  isOpen,
  onClose,
  rows,
  cols,
  mainPrompt,
  initialPrompts,
  onSave,
  selectedImage,
  onRegenSlice,
  isGenerating = false
}) => {
  const panelCount = rows * cols;
  const [panelPrompts, setPanelPrompts] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  useEffect(() => {
    if (isOpen) {
      // 这里的逻辑已解耦：panelPrompts 只受当前全局 state 的 initialPrompts 影响
      const base = [...initialPrompts];
      while (base.length < panelCount) base.push("");
      setPanelPrompts(base.slice(0, panelCount));
      setActiveTab('current');
    }
  }, [isOpen, panelCount, initialPrompts]);

  const handleSuggest = async () => {
    if (!mainPrompt.trim()) return;
    setIsSuggesting(true);
    try {
      const suggestions = await generateCameraSuggestions(mainPrompt, panelCount);
      setPanelPrompts(suggestions);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleUpdatePanel = (index: number, val: string) => {
    const next = [...panelPrompts];
    next[index] = val;
    setPanelPrompts(next);
  };

  const handleClear = () => {
    setPanelPrompts(new Array(panelCount).fill(""));
  };

  const handleLoadHistory = () => {
      if (selectedImage?.panelPrompts) {
          const hist = [...selectedImage.panelPrompts];
          while (hist.length < panelCount) hist.push("");
          setPanelPrompts(hist.slice(0, panelCount));
          setActiveTab('current');
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <div className="bg-cine-dark border border-zinc-800 w-full max-w-6xl rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-cine-accent/10 border border-cine-accent/30 flex items-center justify-center">
              <Video className="text-cine-accent" size={20} />
            </div>
            <div>
              <h2 className="text-white font-mono uppercase tracking-[0.2em] text-sm font-bold">
                分镜镜头逻辑编辑器 (CAM-LOGIC)
              </h2>
              <p className="text-[13px] text-zinc-200 font-mono mt-0.5 uppercase tracking-widest">
                当前设定: {rows}x{cols} 宫格 {selectedImage ? `| 续写自节点: ${selectedImage.id.slice(0,8)}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-200 hover:text-white transition-all hover:rotate-90">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Workspace */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-black/20">
            {activeTab === 'current' ? (
                <div 
                  className="grid gap-4 w-full h-full min-h-[500px]"
                  style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
                >
                  {panelPrompts.map((val, idx) => (
                    <div key={idx} className="relative group flex flex-col space-y-2">
                      <div className="absolute -top-2 -left-2 w-6 h-6 bg-cine-accent text-black rounded-full flex items-center justify-center text-[13px] font-bold z-20 shadow-lg border-2 border-black">
                        {idx + 1}
                      </div>
                      
                      {/* 只有在选中的是当前节点时才显示重绘按钮 */}
                      {selectedImage?.slices?.[idx] && onRegenSlice && (
                          <button 
                            onClick={() => onRegenSlice(idx, val)}
                            disabled={isGenerating}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 text-cine-accent rounded-sm border border-cine-accent/30 hover:bg-cine-accent hover:text-black transition-all z-20 opacity-0 group-hover:opacity-100 disabled:opacity-30"
                            title="单图重绘 (Regen this slice)"
                          >
                            <Wand2 size={12} />
                          </button>
                      )}

                      <div className={`flex-1 flex flex-col bg-zinc-900/50 border rounded-md transition-all duration-300 overflow-hidden focus-within:border-cine-accent/50 focus-within:ring-1 focus-within:ring-cine-accent/20 ${val.trim() ? 'border-zinc-700' : 'border-zinc-800/50'}`}>
                        {selectedImage?.slices?.[idx] && (
                            <div className="h-32 w-full bg-black relative border-b border-zinc-800">
                                 <img src={selectedImage.slices[idx]} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt={`Panel ${idx+1}`} />
                            </div>
                        )}
                        <textarea 
                          value={val}
                          onChange={(e) => handleUpdatePanel(idx, e.target.value)}
                          placeholder={`// 描述第 ${idx + 1} 格的构图、角度、光影...`}
                          className="flex-1 bg-transparent p-4 text-[11px] text-zinc-100 font-mono resize-none focus:ring-0 placeholder:text-zinc-600 leading-relaxed custom-scrollbar"
                        />
                      </div>
                    </div>
                  ))}
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                        <div className="flex items-center gap-3">
                            <History size={16} className="text-cine-accent" />
                            <span className="text-xs font-mono font-bold text-zinc-100 uppercase tracking-widest">选中节点的历史脚本 (HISTORY SCRIPTS)</span>
                        </div>
                        <Button variant="accent" size="sm" onClick={handleLoadHistory}>
                            载入历史脚本至当前配置
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {selectedImage?.panelPrompts?.map((p, idx) => (
                            <div key={idx} className="p-4 bg-zinc-900 border border-zinc-800 rounded-sm">
                                <div className="text-[12px] text-zinc-400 font-bold mb-2 uppercase">PANEL {idx + 1}</div>
                                <p className="text-[11px] text-zinc-200 font-mono leading-relaxed italic">"{p}"</p>
                            </div>
                        ))}
                        {(!selectedImage?.panelPrompts || selectedImage.panelPrompts.length === 0) && (
                            <div className="col-span-2 py-20 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">
                                该节点没有存储分镜脚本数据
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>

          {/* Right Sidebar - Tools */}
          <div className="w-72 border-l border-zinc-800 p-6 space-y-8 bg-zinc-900/20">
            <div className="space-y-2">
                <button 
                    onClick={() => setActiveTab('current')}
                    className={`w-full flex items-center gap-3 p-3 rounded-sm border transition-all ${activeTab === 'current' ? 'bg-cine-accent/10 border-cine-accent text-cine-accent shadow-[0_0_10px_rgba(255,122,0,0.1)]' : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}`}
                >
                    <FileText size={14} />
                    <span className="text-[13px] font-mono font-bold uppercase tracking-widest">当前脚本配置</span>
                </button>
                {selectedImage && (
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`w-full flex items-center gap-3 p-3 rounded-sm border transition-all ${activeTab === 'history' ? 'bg-cine-accent/10 border-cine-accent text-cine-accent shadow-[0_0_10px_rgba(255,122,0,0.1)]' : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}`}
                    >
                        <History size={14} />
                        <span className="text-[13px] font-mono font-bold uppercase tracking-widest">查看历史脚本</span>
                    </button>
                )}
            </div>

            <div className="h-[1px] bg-zinc-800/50"></div>

            <div className="space-y-4">
               <h3 className="text-[13px] text-zinc-200 uppercase font-bold tracking-widest flex items-center gap-2">
                 <Sparkles size={12} className="text-cine-accent" />
                 智能生成建议
               </h3>
               <p className="text-[13px] text-zinc-300 font-mono leading-relaxed">
                 AI 将基于当前的“创作指令”自动规划整个序列的视觉动线和镜头切分。
               </p>
               <Button 
                variant="primary" 
                size="sm" 
                className="w-full gap-2 py-3" 
                onClick={handleSuggest}
                disabled={isSuggesting || !mainPrompt.trim()}
              >
                {isSuggesting ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {isSuggesting ? '正在规划...' : '自动规划镜头'}
               </Button>
            </div>

            <div className="h-[1px] bg-zinc-800/50"></div>

            <div className="space-y-4">
               <h3 className="text-[13px] text-zinc-200 uppercase font-bold tracking-widest flex items-center gap-2">
                 <Info size={12} />
                 重绘提示 (REGEN)
               </h3>
               <p className="text-[12px] text-zinc-300 font-mono leading-relaxed bg-black/40 p-3 rounded-sm border border-zinc-800/50">
                 针对续写节点，点击 <Wand2 size={10} className="inline mx-1" /> 可以基于该单格的历史画面进行独立渲染。
               </p>
            </div>

            <div className="pt-4">
              <button 
                onClick={handleClear}
                className="text-[13px] text-zinc-300 hover:text-red-400 font-mono uppercase tracking-widest flex items-center gap-2 transition-colors w-full justify-center"
              >
                <Trash2 size={12} /> 清空所有配置
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {panelPrompts.map((p, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${p.trim() ? 'bg-cine-accent shadow-[0_0_5px_#FF7A00]' : 'bg-zinc-800'}`}></div>
                ))}
              </div>
              <span className="text-[12px] text-zinc-300 font-mono uppercase tracking-widest">已配置 {panelPrompts.filter(p => p.trim()).length} / {panelCount} 个镜头</span>
           </div>
           <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} size="md" className="px-6 h-10">取消</Button>
              <Button 
                variant="accent" 
                onClick={() => { onSave(panelPrompts); onClose(); }} 
                size="md" 
                className="px-10 h-10 shadow-[0_0_20px_rgba(255,122,0,0.3)]"
              >
                <Check size={16} className="mr-2" /> 应用镜头逻辑
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
};
