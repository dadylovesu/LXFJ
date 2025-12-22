
import React, { useState, useEffect } from 'react';
import { GeneratedImage, Asset } from '../types';
import { Download, Copy, Maximize2, Wand2, X, MessageSquare, Info, Video, Fingerprint, Eye, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface InspectorProps {
  selectedImage: GeneratedImage | null;
  selectedAsset: Asset | null;
  onClose: () => void;
  onAnalyze: (prompt: string) => void;
  isAnalyzing: boolean;
  analysisResult?: string;
}

export const Inspector: React.FC<InspectorProps> = ({ 
  selectedImage, 
  selectedAsset, 
  onClose,
  onAnalyze,
  isAnalyzing,
  analysisResult
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'analyze'>('view');
  const [analysisPrompt, setAnalysisPrompt] = useState("深度分析该画面的视觉语言、构图平衡以及灯光设计。");
  const [showFullGrid, setShowFullGrid] = useState(false);
  const [activeSliceIndex, setActiveSliceIndex] = useState(0);

  useEffect(() => {
    setShowFullGrid(false);
    setActiveSliceIndex(0);
    if (selectedImage || selectedAsset) {
        setActiveTab('view');
    }
  }, [selectedImage?.id, selectedAsset?.id]);

  const activeItem = selectedImage || selectedAsset;
  const hasSlices = selectedImage && selectedImage.slices && selectedImage.slices.length > 0;
  
  const displayUrl = selectedImage 
    ? (showFullGrid ? (selectedImage.fullGridUrl || selectedImage.url) : (hasSlices ? selectedImage.slices![activeSliceIndex] : selectedImage.url))
    : selectedAsset?.previewUrl;

  const currentPrompt = (selectedImage && !showFullGrid && hasSlices && selectedImage.slicePrompts) 
    ? selectedImage.slicePrompts[activeSliceIndex] 
    : (selectedImage ? selectedImage.prompt : '');

  if (!activeItem && !analysisResult) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-4 p-10 text-center bg-cine-dark">
        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center opacity-40">
           <Eye size={20} />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] font-bold text-zinc-600">监视器空闲 (IDLE)</p>
          <p className="text-[10px] text-zinc-800 leading-relaxed font-mono">请在左侧或画布中选择一个<br/>分镜任务以查看详细属性。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-cine-dark border-l border-cine-border animate-in slide-in-from-right-4 duration-300 w-full relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-cine-accent/5 blur-[100px] pointer-events-none"></div>

      <div className="flex items-center justify-between px-5 py-4 border-b border-cine-border bg-cine-black/40 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-[10px] uppercase tracking-[0.25em] font-mono font-bold">
                03. 监视器 (INSPECTOR)
            </span>
            {selectedImage?.fullGridUrl && (
                <span className="bg-cine-accent/10 text-cine-accent text-[8px] px-2 py-0.5 rounded-[1px] border border-cine-accent/30 font-bold uppercase tracking-widest">
                    {showFullGrid ? '总览模式' : `画面 ${activeSliceIndex + 1}`}
                </span>
            )}
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-white transition-all hover:rotate-90 duration-300">
            <X size={16} />
        </button>
      </div>

      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group shadow-2xl z-10">
         {displayUrl ? (
             <img 
                key={`${selectedImage?.id}-${activeSliceIndex}-${showFullGrid}`}
                src={displayUrl} 
                alt="预览" 
                className="max-w-full max-h-full object-contain group-hover:scale-[1.02] transition-transform duration-1000 animate-in fade-in duration-500" 
             />
         ) : (
             <div className="flex flex-col items-center gap-3 text-zinc-800">
                 <Video size={40} className="opacity-20" />
                 <span className="text-[9px] font-mono uppercase tracking-[0.4em] font-bold">无信号</span>
             </div>
         )}
         
         {hasSlices && !showFullGrid && (
             <>
                <button 
                    onClick={() => setActiveSliceIndex(prev => (prev > 0 ? prev - 1 : selectedImage.slices!.length - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <ChevronLeft size={20} />
                </button>
                <button 
                    onClick={() => setActiveSliceIndex(prev => (prev < selectedImage.slices!.length - 1 ? prev + 1 : 0))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <ChevronRight size={20} />
                </button>
             </>
         )}

         {selectedImage?.fullGridUrl && (
             <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                 <button 
                    onClick={() => setShowFullGrid(!showFullGrid)}
                    className={`bg-black/70 backdrop-blur-md text-[9px] px-3 py-1.5 rounded-[2px] border flex items-center gap-2 transition-all uppercase tracking-widest font-mono font-bold ${
                        showFullGrid ? 'border-cine-accent text-cine-accent' : 'border-zinc-800 text-white hover:border-cine-accent'
                    }`}
                 >
                    <LayoutGrid size={10} />
                    {showFullGrid ? "查看单帧" : "查看网格总览"}
                 </button>
             </div>
         )}
      </div>

      {hasSlices && !showFullGrid && (
          <div className="flex gap-2 p-3 bg-black/30 border-b border-cine-border overflow-x-auto no-scrollbar">
              {selectedImage.slices!.map((slice, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSliceIndex(idx)}
                    className={`relative flex-shrink-0 w-16 aspect-video bg-zinc-900 border rounded-sm overflow-hidden transition-all ${
                        activeSliceIndex === idx ? 'border-cine-accent ring-1 ring-cine-accent/40 scale-105' : 'border-zinc-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                      <img src={slice} className="w-full h-full object-cover" alt={`slice-${idx}`} />
                      <div className="absolute bottom-0 right-0 bg-black/60 text-[7px] text-white px-1 font-mono">{idx + 1}</div>
                  </button>
              ))}
          </div>
      )}

      <div className="flex border-b border-cine-border relative z-10">
          <button 
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-3.5 text-[10px] font-mono uppercase tracking-[0.2em] font-bold transition-all ${activeTab === 'view' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            详情属性
          </button>
          <button 
            onClick={() => setActiveTab('analyze')}
            className={`flex-1 py-3.5 text-[10px] font-mono uppercase tracking-[0.2em] font-bold transition-all ${activeTab === 'analyze' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            AI 视觉分析
          </button>
          <div className={`absolute bottom-0 h-0.5 bg-cine-accent transition-all duration-300 ${activeTab === 'view' ? 'left-0 w-1/2' : 'left-1/2 w-1/2'}`}></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-7 custom-scrollbar relative z-10">
        
        {activeTab === 'view' && activeItem && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="space-y-4">
                    <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                        <Fingerprint size={12} className="text-zinc-700" />
                        元数据 (METADATA)
                    </h3>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-[10px] font-mono">
                        <div className="flex flex-col gap-1">
                            <span className="uppercase text-zinc-700 text-[8px] tracking-widest">类型</span>
                            <span className="text-zinc-400 font-bold">
                                {selectedImage ? (showFullGrid ? '分镜网格图' : '分镜单帧') : '参考资产'}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="uppercase text-zinc-700 text-[8px] tracking-widest">比例</span>
                            <span className="text-zinc-400 font-bold">
                                {selectedImage ? selectedImage.aspectRatio : '原始'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                         <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                             {showFullGrid ? '导演核心指令' : `画面 ${activeSliceIndex + 1} 描述内容`}
                         </h3>
                         <button 
                            onClick={() => navigator.clipboard.writeText(currentPrompt)}
                            className="text-zinc-600 hover:text-cine-accent transition-all"
                            title="复制到剪贴板"
                         >
                             <Copy size={12} />
                         </button>
                    </div>
                    <div className={`p-4 bg-black/40 border rounded-sm relative group transition-colors duration-500 ${!showFullGrid && hasSlices ? 'border-cine-accent/30' : 'border-zinc-800/60'}`}>
                        <p className="text-zinc-400 text-xs leading-relaxed font-mono">
                            {currentPrompt || (selectedAsset ? "原始参考资产，无文本指令。" : "正在生成描述...")}
                        </p>
                    </div>
                </div>

                <div className="pt-2">
                     <a 
                        href={displayUrl} 
                        download={`分镜导出-${showFullGrid ? '总览' : '单帧-' + (activeSliceIndex + 1)}.png`}
                        className="block"
                     >
                         <Button variant="primary" size="md" className="w-full gap-3 py-6 h-12 shadow-xl">
                             <Download size={14} /> 下载高清图像
                         </Button>
                     </a>
                </div>
            </div>
        )}

        {activeTab === 'analyze' && (
             <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500 h-full flex flex-col">
                {activeItem && (
                    <div className="space-y-3 flex-shrink-0">
                        <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">分析指令</label>
                        <textarea 
                            value={analysisPrompt}
                            onChange={(e) => setAnalysisPrompt(e.target.value)}
                            className="w-full bg-black/40 border border-zinc-800/80 rounded-sm p-4 text-[11px] text-zinc-400 focus:border-cine-accent focus:ring-0 resize-none font-mono min-h-[100px] leading-relaxed transition-all"
                            placeholder="输入 AI 分析指令..."
                        />
                        <Button 
                            variant="accent" 
                            size="md" 
                            className="w-full gap-2.5 h-11"
                            onClick={() => onAnalyze(analysisPrompt)}
                            disabled={isAnalyzing}
                        >
                             {isAnalyzing ? <Wand2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                             {isAnalyzing ? '正在深度分析...' : '执行视觉分析'}
                        </Button>
                    </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col space-y-3 pt-2 border-t border-zinc-800/50">
                    <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">分析报告 (中文)</label>
                    <div className="flex-1 bg-black/50 border border-zinc-900/80 rounded-sm p-5 overflow-y-auto custom-scrollbar shadow-inner relative">
                        {analysisResult ? (
                            <p className="text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap font-mono tracking-tight">{analysisResult}</p>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-800 gap-4 opacity-30">
                                <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-center">等待分析指令...</span>
                            </div>
                        )}
                    </div>
                </div>
             </div>
        )}

      </div>

      <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};
