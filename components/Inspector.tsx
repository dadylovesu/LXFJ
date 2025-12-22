
import React, { useState, useEffect } from 'react';
import { GeneratedImage, Asset } from '../types';
import { Download, Copy, Maximize2, Wand2, X, MessageSquare, Info, Video, Fingerprint, Eye, Sparkle, LayoutGrid, ChevronLeft, ChevronRight, History, Layers, Zap } from 'lucide-react';
import { Button } from './Button';

interface InspectorProps {
  selectedImage: GeneratedImage | null;
  selectedAsset: Asset | null;
  onClose: () => void;
  onAnalyze: (prompt: string) => void;
  isAnalyzing: boolean;
  analysisResult?: string;
  onEditSlice?: (imageId: string, sliceIndex: number, prompt: string, usePro: boolean) => void;
  onRevertSlice?: (imageId: string, sliceIndex: number, historyIndex: number) => void;
}

export const Inspector: React.FC<InspectorProps> = ({ 
  selectedImage, 
  selectedAsset, 
  onClose,
  onAnalyze,
  isAnalyzing,
  analysisResult,
  onEditSlice,
  onRevertSlice
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'analyze' | 'edit'>('view');
  const [analysisPrompt, setAnalysisPrompt] = useState("深度分析该画面的视觉语言、构图平衡以及灯光设计。");
  const [showFullGrid, setShowFullGrid] = useState(false);
  const [currentSliceIndex, setCurrentSliceIndex] = useState(0);
  const [editPrompt, setEditPrompt] = useState("");
  const [useProModel, setUseProModel] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    setShowFullGrid(false);
    setCurrentSliceIndex(0);
    if (selectedImage || selectedAsset) {
        setActiveTab('view');
    }
  }, [selectedImage?.id, selectedAsset?.id]);

  const activeItem = selectedImage || selectedAsset;
  
  const getDisplayUrl = () => {
    if (!activeItem) return null;
    if (selectedAsset) return selectedAsset.previewUrl;
    if (selectedImage) {
        if (showFullGrid && selectedImage.fullGridUrl) return selectedImage.fullGridUrl;
        if (selectedImage.slices && selectedImage.slices[currentSliceIndex]) {
            return selectedImage.slices[currentSliceIndex];
        }
        return selectedImage.url;
    }
    return null;
  };

  const displayUrl = getDisplayUrl();
  const hasContent = activeItem || analysisResult;
  const isSliceView = selectedImage && !showFullGrid && selectedImage.slices;
  const historyForCurrentSlice = isSliceView ? (selectedImage.sliceHistory?.[currentSliceIndex] || []) : [];

  const handleEdit = () => {
    if (selectedImage && isSliceView && onEditSlice) {
      onEditSlice(selectedImage.id, currentSliceIndex, editPrompt, useProModel);
      setEditPrompt("");
    }
  };

  if (!hasContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-4 p-10 text-center bg-cine-dark">
        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center opacity-40">
           <Eye size={20} />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] font-bold text-zinc-600">空闲状态 (IDLE)</p>
          <p className="text-[10px] text-zinc-800 leading-relaxed font-mono">请在左侧或画布中选择一个<br/>渲染任务以查看其详细属性。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-cine-dark border-l border-cine-border animate-in slide-in-from-right-4 duration-300 w-full relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cine-accent/5 blur-[100px] pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-cine-border bg-cine-black/40 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-[10px] uppercase tracking-[0.25em] font-mono font-bold">
                03. 监视器 (INSPECTOR)
            </span>
            {selectedImage?.fullGridUrl && (
                <span className="bg-cine-accent/10 text-cine-accent text-[8px] px-2 py-0.5 rounded-[1px] border border-cine-accent/30 font-bold uppercase tracking-widest">PRO ENGINE</span>
            )}
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-white transition-all hover:rotate-90 duration-300">
            <X size={16} />
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group shadow-2xl z-10">
         {displayUrl ? (
             <img src={displayUrl} alt="Inspector View" className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-700" />
         ) : (
             <div className="flex flex-col items-center gap-3 text-zinc-800">
                 <Video size={40} className="opacity-20" />
                 <span className="text-[9px] font-mono uppercase tracking-[0.4em] font-bold">No Signal</span>
             </div>
         )}
         
         {/* Slice Navigation */}
         {selectedImage?.slices && !showFullGrid && (
             <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                 <button 
                    disabled={currentSliceIndex === 0}
                    onClick={() => setCurrentSliceIndex(prev => Math.max(0, prev - 1))}
                    className="p-1.5 bg-black/60 rounded-full text-white pointer-events-auto disabled:opacity-30 hover:bg-cine-accent transition-colors"
                 >
                     <ChevronLeft size={16} />
                 </button>
                 <button 
                    disabled={currentSliceIndex === (selectedImage.slices.length - 1)}
                    onClick={() => setCurrentSliceIndex(prev => Math.min(selectedImage.slices!.length - 1, prev + 1))}
                    className="p-1.5 bg-black/60 rounded-full text-white pointer-events-auto disabled:opacity-30 hover:bg-cine-accent transition-colors"
                 >
                     <ChevronRight size={16} />
                 </button>
             </div>
         )}

         {/* Grid Toggle Overlay */}
         {selectedImage?.fullGridUrl && (
             <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                 <button 
                    onClick={() => setShowFullGrid(!showFullGrid)}
                    className="bg-black/70 backdrop-blur-md text-white text-[9px] px-3 py-1.5 rounded-[2px] border border-zinc-800 hover:border-cine-accent flex items-center gap-2 transition-all uppercase tracking-widest font-mono font-bold"
                 >
                    <Maximize2 size={10} />
                    {showFullGrid ? "VIEW PANEL" : "VIEW MASTER"}
                 </button>
                 
                 {isSliceView && historyForCurrentSlice.length > 0 && (
                     <button 
                        onClick={() => setShowHistoryModal(true)}
                        className="bg-zinc-800/80 backdrop-blur-md text-cine-accent text-[9px] px-3 py-1.5 rounded-[2px] border border-zinc-700 hover:border-cine-accent flex items-center gap-2 transition-all uppercase tracking-widest font-mono font-bold"
                     >
                        <History size={10} />
                        VERSION ({historyForCurrentSlice.length})
                     </button>
                 )}
             </div>
         )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cine-border relative z-10">
          <button 
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-3.5 text-[9px] font-mono uppercase tracking-[0.2em] font-bold transition-all ${activeTab === 'view' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            PROPERTIES
          </button>
          {isSliceView && (
              <button 
                onClick={() => setActiveTab('edit')}
                className={`flex-1 py-3.5 text-[9px] font-mono uppercase tracking-[0.2em] font-bold transition-all ${activeTab === 'edit' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                AI EDIT
              </button>
          )}
          <button 
            onClick={() => setActiveTab('analyze')}
            className={`flex-1 py-3.5 text-[9px] font-mono uppercase tracking-[0.2em] font-bold transition-all ${activeTab === 'analyze' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            AI ANALYZE
          </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-7 custom-scrollbar relative z-10">
        
        {activeTab === 'view' && activeItem && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Panel Info */}
                {isSliceView && (
                    <div className="p-3 bg-cine-accent/5 border border-cine-accent/20 rounded-sm flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-cine-accent/20 flex items-center justify-center text-cine-accent font-bold text-xs">
                                 {currentSliceIndex + 1}
                             </div>
                             <div>
                                 <p className="text-[10px] text-cine-accent font-bold uppercase tracking-wider">当前分镜 Panel</p>
                                 <p className="text-[8px] text-zinc-600 font-mono">INDEX: {currentSliceIndex} / TOTAL: {selectedImage?.slices?.length}</p>
                             </div>
                         </div>
                    </div>
                )}

                {/* Metadata */}
                <div className="space-y-4">
                    <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                        <Fingerprint size={12} className="text-zinc-700" />
                        元数据 (METADATA)
                    </h3>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-[10px] font-mono">
                        <div className="flex flex-col gap-1">
                            <span className="uppercase text-zinc-700 text-[8px] tracking-widest">TYPE</span>
                            <span className="text-zinc-400 font-bold">{selectedImage ? 'RENDER NODE' : 'SOURCE ASSET'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="uppercase text-zinc-700 text-[8px] tracking-widest">ASPECT</span>
                            <span className="text-zinc-400 font-bold">
                                {selectedImage ? selectedImage.aspectRatio : 'ORIGINAL'}
                            </span>
                        </div>
                        <div className="flex flex-col col-span-2 gap-1 border-t border-zinc-800/50 pt-3">
                            <span className="uppercase text-zinc-700 text-[8px] tracking-widest">ENTITY ID</span>
                            <span className="text-zinc-500 truncate font-mono select-all hover:text-cine-accent transition-colors cursor-help">{activeItem.id}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-2">
                     <a href={displayUrl || '#'} download={`OrangeCine-${activeItem.id}-${currentSliceIndex}.png`} className="block">
                         <Button variant="primary" size="md" className="w-full gap-3 py-6 h-12 shadow-xl">
                             <Download size={14} className="animate-bounce" /> DOWNLOAD HIGH-RES
                         </Button>
                     </a>
                </div>
            </div>
        )}

        {activeTab === 'edit' && isSliceView && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 h-full flex flex-col">
                 <div className="space-y-4">
                    <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                        <Zap size={12} className="text-cine-accent" />
                        分镜图像编辑 (IMAGE EDITING)
                    </h3>
                    <p className="text-[10px] text-zinc-600 leading-relaxed font-mono bg-black/30 p-3 border-l-2 border-cine-accent/50">
                        您可以对当前选中的单图分镜进行局部修改或重绘。新生成的图像将替换原图，并保留在历史记录中。
                    </p>
                 </div>

                 <div className="space-y-3">
                    <label className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.2em]">编辑指令 (EDIT PROMPT)</label>
                    <textarea 
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        className="w-full bg-black/40 border border-zinc-800/80 rounded-sm p-4 text-[11px] text-zinc-400 focus:border-cine-accent focus:ring-0 resize-none font-mono min-h-[120px] leading-relaxed transition-all placeholder:text-zinc-800"
                        placeholder="例如：给角色戴上黑色墨镜，或者改变背景的天气..."
                    />
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-sm border border-zinc-800/50">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">使用 PRO 引擎 (GEMINI 3 PRO)</span>
                        <button 
                            onClick={() => setUseProModel(!useProModel)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${useProModel ? 'bg-cine-accent' : 'bg-zinc-800'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${useProModel ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    <Button 
                        variant="accent" 
                        size="md" 
                        className="w-full gap-2.5 h-12 shadow-[0_0_20px_rgba(255,122,0,0.2)]"
                        onClick={handleEdit}
                        disabled={!editPrompt.trim()}
                    >
                        <Wand2 size={14} />
                        执行 AI 重绘 (RE-RENDER)
                    </Button>
                 </div>

                 {/* Version list teaser */}
                 {historyForCurrentSlice.length > 0 && (
                     <div className="pt-6 border-t border-zinc-800/50">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.2em]">往期版本 (HISTORY)</span>
                            <span className="text-zinc-700 text-[8px] font-mono">{historyForCurrentSlice.length} VERSIONS</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {historyForCurrentSlice.map((url, i) => (
                                <div key={i} className="w-16 h-12 flex-shrink-0 bg-black border border-zinc-800 rounded-[1px] overflow-hidden opacity-60 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setShowHistoryModal(true)}>
                                    <img src={url} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                     </div>
                 )}
             </div>
        )}

        {activeTab === 'analyze' && (
             <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500 h-full flex flex-col">
                <div className="space-y-3 flex-shrink-0">
                    <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">ANALYTICS COMMAND</label>
                    <textarea 
                        value={analysisPrompt}
                        onChange={(e) => setAnalysisPrompt(e.target.value)}
                        className="w-full bg-black/40 border border-zinc-800/80 rounded-sm p-4 text-[11px] text-zinc-400 focus:border-cine-accent focus:ring-0 resize-none font-mono min-h-[100px] leading-relaxed transition-all"
                        placeholder="INPUT AI INSTRUCTIONS..."
                    />
                    <Button 
                        variant="accent" 
                        size="md" 
                        className="w-full gap-2.5 h-11"
                        onClick={() => onAnalyze(analysisPrompt)}
                        disabled={isAnalyzing}
                    >
                         {isAnalyzing ? <Wand2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                         {isAnalyzing ? 'PROMPT ANALYZING...' : 'RUN VISUAL ANALYTICS'}
                    </Button>
                </div>

                <div className="flex-1 min-h-0 flex flex-col space-y-3 pt-2 border-t border-zinc-800/50">
                    <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">ANALYSIS REPORT</label>
                    <div className="flex-1 bg-black/50 border border-zinc-900/80 rounded-sm p-5 overflow-y-auto custom-scrollbar shadow-inner relative">
                        {analysisResult ? (
                            <p className="text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap font-mono tracking-tight">{analysisResult}</p>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-800 gap-4 opacity-30">
                                <Sparkles size={24} />
                                <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-center">Awaiting AI<br/>Feedback System</span>
                            </div>
                        )}
                        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.02] bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[size:10px_10px]"></div>
                    </div>
                </div>
             </div>
        )}

      </div>

      {/* History Version Modal */}
      {showHistoryModal && selectedImage && (
          <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 flex flex-col">
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <History size={16} className="text-cine-accent" />
                      <h3 className="text-white font-mono text-xs font-bold tracking-widest uppercase">分镜历史管理 (VERSION HISTORY)</h3>
                  </div>
                  <button onClick={() => setShowHistoryModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                      <X size={20} />
                  </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8">
                  <div className="grid grid-cols-2 gap-6">
                      {/* Current Version Card */}
                      <div className="space-y-4">
                          <label className="text-cine-accent text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
                              <Sparkle size={10} /> CURRENT VERSION (ACTIVE)
                          </label>
                          <div className="aspect-video bg-zinc-900 border-2 border-cine-accent rounded-sm overflow-hidden shadow-[0_0_30px_rgba(255,122,0,0.1)]">
                              <img src={selectedImage.slices![currentSliceIndex]} className="w-full h-full object-cover" />
                          </div>
                      </div>

                      {/* History List */}
                      <div className="space-y-4">
                          <label className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
                              <Layers size={10} /> PREVIOUS VERSIONS ({historyForCurrentSlice.length})
                          </label>
                          <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
                              {historyForCurrentSlice.map((url, i) => (
                                  <div key={i} className="group relative aspect-video bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden hover:border-cine-accent/50 transition-all cursor-pointer"
                                    onClick={() => {
                                        if (onRevertSlice) onRevertSlice(selectedImage.id, currentSliceIndex, i);
                                        setShowHistoryModal(false);
                                    }}
                                  >
                                      <img src={url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <div className="px-4 py-2 bg-cine-accent text-black font-mono text-[10px] font-bold tracking-widest rounded-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                              恢复该版本 (RESTORE)
                                          </div>
                                      </div>
                                      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur rounded-[2px] text-zinc-500 text-[8px] font-mono">
                                          v.{historyForCurrentSlice.length - i}
                                      </div>
                                  </div>
                              ))}
                              {historyForCurrentSlice.length === 0 && (
                                  <div className="h-32 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-sm text-zinc-700 font-mono text-[10px] uppercase tracking-widest">
                                      No previous versions
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const Sparkles = ({ size, className }: { size: number, className?: string }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
);
