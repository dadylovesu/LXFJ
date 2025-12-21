import React from 'react';
import { Button } from './Button';
import { AspectRatio, ImageSize } from '../types';
import { Settings2, GitMerge, Video, Layers, Zap, LayoutGrid, ChevronRight, ChevronLeft } from 'lucide-react';

interface DirectorDeckProps {
  gridRows: number;
  setGridRows: (r: number) => void;
  gridCols: number;
  setGridCols: (c: number) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (ar: AspectRatio) => void;
  imageSize: ImageSize;
  setImageSize: (size: ImageSize) => void;
  prompt: string;
  setPrompt: (text: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onEnhancePrompt?: () => void;
  onGenerateCamera?: () => void;
  isContinuing?: boolean;
}

export const DirectorDeck: React.FC<DirectorDeckProps> = ({
  gridRows,
  setGridRows,
  gridCols,
  setGridCols,
  aspectRatio,
  setAspectRatio,
  imageSize,
  setImageSize,
  prompt,
  setPrompt,
  onGenerate,
  isGenerating,
  onEnhancePrompt,
  onGenerateCamera,
  isContinuing = false
}) => {
  
  const getQualityLabel = () => {
      switch(imageSize) {
          case ImageSize.K1: return "1K 标准";
          case ImageSize.K2: return "2K 高清";
          case ImageSize.K4: return "4K 极致";
          default: return "4K Master";
      }
  };

  return (
    <div className="flex flex-col h-full space-y-6 select-none">
      <div className="flex items-center justify-between border-t border-zinc-800/80 pt-6 mt-2">
         <span className="text-zinc-500 text-[10px] uppercase tracking-[0.25em] font-mono font-bold flex items-center gap-2">
            <Settings2 size={10} className="text-cine-accent opacity-50" />
            02. 导演控制台 (CONTROL)
         </span>
         {isGenerating && (
             <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-cine-accent rounded-full animate-subtle-pulse shadow-[0_0_8px_#FF7A00]"></div>
                 <span className="text-[9px] text-cine-accent font-mono tracking-widest font-bold">RENDERING</span>
             </div>
         )}
      </div>

      {/* Composition Group */}
      <div className="space-y-3.5">
        <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
            <span className="w-1 h-3 bg-zinc-800 rounded-full"></span>
            构图配置 (COMPOSITION)
        </label>
        
        <div className="space-y-4 p-4 bg-zinc-900/40 border border-zinc-800/40 rounded-sm backdrop-blur-md">
             {/* Dynamic Grid Controls */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <span className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest">宫格行列 (ROWS x COLS)</span>
                   <span className="text-[10px] text-cine-accent font-mono font-bold">{gridRows} x {gridCols}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {/* Rows */}
                    <div className="flex items-center bg-black/40 border border-zinc-800 rounded-sm p-1">
                        <button 
                            onClick={() => setGridRows(Math.max(1, gridRows - 1))}
                            className="p-1 text-zinc-600 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <div className="flex-1 text-center font-mono text-xs text-zinc-300">R: {gridRows}</div>
                        <button 
                            onClick={() => setGridRows(Math.min(4, gridRows + 1))}
                            className="p-1 text-zinc-600 hover:text-white transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    {/* Cols */}
                    <div className="flex items-center bg-black/40 border border-zinc-800 rounded-sm p-1">
                        <button 
                            onClick={() => setGridCols(Math.max(1, gridCols - 1))}
                            className="p-1 text-zinc-600 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <div className="flex-1 text-center font-mono text-xs text-zinc-300">C: {gridCols}</div>
                        <button 
                            onClick={() => setGridCols(Math.min(4, gridCols + 1))}
                            className="p-1 text-zinc-600 hover:text-white transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Aspect Ratio */}
             <div className="space-y-2 pt-2.5 border-t border-zinc-800/50">
                <div className="flex justify-between items-center">
                   <span className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest">画面比例 (RATIO)</span>
                   <span className="text-[8px] text-cine-accent/60 font-mono">{aspectRatio}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    {Object.values(AspectRatio).map((ar) => (
                        <button
                            key={ar}
                            onClick={() => setAspectRatio(ar)}
                            className={`text-[9px] h-7 border rounded-[1px] font-mono transition-all duration-300 flex items-center justify-center ${
                                aspectRatio === ar 
                                ? 'border-zinc-600 text-white bg-zinc-800 shadow-inner' 
                                : 'border-zinc-800/60 text-zinc-700 hover:border-zinc-700 hover:text-zinc-500 bg-transparent'
                            }`}
                        >
                            {ar}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* Quality Group */}
      <div className="space-y-2.5">
        <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
            <span className="w-1 h-3 bg-zinc-800 rounded-full"></span>
            输出引擎 & 分辨率 (ENGINE & RES)
        </label>
        <div className="p-3 bg-black/40 border border-zinc-800/60 rounded-sm space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <LayoutGrid size={9} className="text-zinc-700" />
                    <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">GEN 3 PRO ENGINE</span>
                </div>
                <span className="text-[9px] text-cine-accent font-bold font-mono">{getQualityLabel()}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {[ImageSize.K1, ImageSize.K2, ImageSize.K4].map((sz) => (
                    <button
                        key={sz}
                        onClick={() => setImageSize(sz)}
                        className={`text-[9px] h-7 border rounded-[1px] font-mono transition-all duration-300 ${
                            imageSize === sz 
                            ? 'border-cine-accent/50 text-cine-accent bg-cine-accent/5 shadow-inner' 
                            : 'border-zinc-800/60 text-zinc-700 hover:border-zinc-700 hover:text-zinc-500 bg-transparent'
                        }`}
                    >
                        {sz}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* Prompt Area */}
      <div className="space-y-2.5 flex-1 flex flex-col min-h-[200px]">
        <div className="flex justify-between items-end">
            <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
                <span className="w-1 h-3 bg-cine-accent rounded-full shadow-[0_0_8px_#FF7A00]"></span>
                创作指令 (DIRECTOR PROMPT)
            </label>
            
            {isContinuing && (
                <div className="flex items-center gap-1.5 bg-cine-accent/5 text-cine-accent px-2.5 py-1 rounded-full border border-cine-accent/20 animate-in fade-in duration-500 shadow-[0_0_10px_rgba(255,122,0,0.05)]">
                    <GitMerge size={10} />
                    <span className="text-[8px] font-mono tracking-widest font-bold">CONTINUITY ON</span>
                </div>
            )}
        </div>
        
        <div className={`relative flex-1 group transition-all duration-500 overflow-hidden rounded-sm ${isContinuing ? 'ring-1 ring-cine-accent/20' : 'ring-1 ring-zinc-800/50 focus-within:ring-cine-accent/30'}`}>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isContinuing ? "// 继续扩展该分镜的世界观..." : "// 描述一个电影级画面，包括构图、光影、氛围..."}
                className={`w-full h-full absolute inset-0 bg-black/60 backdrop-blur-sm border-none p-4 text-[13px] text-zinc-300 focus:ring-0 resize-none font-mono leading-relaxed placeholder:text-zinc-800 custom-scrollbar transition-all duration-500 focus:bg-zinc-900/20 ${
                    isContinuing ? 'text-cine-accent/90' : ''
                }`}
                spellCheck={false}
            />
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
        </div>
      </div>

      {/* Tools Row */}
      {onGenerateCamera && (
          <div className="flex">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onGenerateCamera} 
                disabled={isGenerating || !prompt.trim()} 
                className="w-full text-[9px] h-9 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/20 group"
              >
                  <Video size={12} className="mr-2 text-zinc-500 group-hover:text-cine-accent transition-colors" /> 生成镜头运动轨迹 (CAM-GEN)
              </Button>
          </div>
      )}

      {/* Generate Button */}
      <Button 
        variant="accent" 
        className="w-full py-4.5 tracking-[0.25em] uppercase font-mono text-[10px] font-bold relative overflow-hidden group transition-all duration-500 h-12"
        onClick={onGenerate}
        disabled={isGenerating || !prompt.trim()}
      >
        <span className="relative z-10 flex items-center justify-center gap-3">
            {isGenerating ? <Zap size={14} className="animate-spin" /> : (isContinuing ? <GitMerge size={14} /> : <Layers size={14} />)}
            {isGenerating ? '系统渲染中...' : (isContinuing ? '连续创作 (CONTINUE)' : '执行 渲染 (EXECUTE)')}
        </span>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
      </Button>
      <style>{`
          @keyframes shimmer {
            100% { transform: translateX(100%); }
          }
      `}</style>
    </div>
  );
};