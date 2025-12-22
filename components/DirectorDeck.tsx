
import React, { useState } from 'react';
import { Button } from './Button';
import { AspectRatio, ImageSize } from '../types';
import { Settings2, GitMerge, Video, Layers, Zap, LayoutGrid, ChevronRight, ChevronLeft, XCircle, PlusCircle, Square, Wand2, ChevronDown, ChevronUp } from 'lucide-react';

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
  cameraTrack: string;
  setCameraTrack: (text: string) => void;
  onGenerate: () => void;
  onStop?: () => void;
  isGenerating: boolean;
  onEnhancePrompt?: () => void;
  onGenerateCamera?: () => void;
  isContinuing?: boolean;
  onDeselect?: () => void;
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
  cameraTrack,
  setCameraTrack,
  onGenerate,
  onStop,
  isGenerating,
  onEnhancePrompt,
  onGenerateCamera,
  isContinuing = false,
  onDeselect
}) => {
  const [showCameraTrack, setShowCameraTrack] = useState(false);
  
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
                 <span className="text-[9px] text-cine-accent font-mono tracking-widest font-bold">渲染中 (RENDERING)</span>
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
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <span className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest">宫格行列 (ROWS x COLS)</span>
                   <span className="text-[10px] text-cine-accent font-mono font-bold">{gridRows} x {gridCols}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center bg-black/40 border border-zinc-800 rounded-sm p-1">
                        <button 
                            onClick={() => setGridRows(Math.max(1, gridRows - 1))}
                            className="p-1 text-zinc-600 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <div className="flex-1 text-center font-mono text-xs text-zinc-300">行: {gridRows}</div>
                        <button 
                            onClick={() => setGridRows(Math.min(4, gridRows + 1))}
                            className="p-1 text-zinc-600 hover:text-white transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="flex items-center bg-black/40 border border-zinc-800 rounded-sm p-1">
                        <button 
                            onClick={() => setGridCols(Math.max(1, gridCols - 1))}
                            className="p-1 text-zinc-600 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <div className="flex-1 text-center font-mono text-xs text-zinc-300">列: {gridCols}</div>
                        <button 
                            onClick={() => setGridCols(Math.min(4, gridCols + 1))}
                            className="p-1 text-zinc-600 hover:text-white transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

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

      <div className="space-y-2.5">
        <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
            <span className="w-1 h-3 bg-zinc-800 rounded-full"></span>
            输出引擎 & 分辨率 (ENGINE)
        </label>
        <div className="p-3 bg-black/40 border border-zinc-800/60 rounded-sm space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <LayoutGrid size={9} className="text-zinc-700" />
                    <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">GEN 3 PRO 渲染核心</span>
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

      {/* Manual Camera Track Section */}
      <div className="space-y-2.5">
        <button 
          onClick={() => setShowCameraTrack(!showCameraTrack)}
          className={`w-full flex items-center justify-between p-2.5 rounded-sm border transition-all ${
            showCameraTrack ? 'bg-cine-accent/5 border-cine-accent/30 text-cine-accent' : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-600 hover:text-zinc-400'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Video size={10} className={showCameraTrack ? 'text-cine-accent' : 'text-zinc-600'} />
            <span className="text-[9px] font-mono uppercase tracking-[0.15em] font-bold">高级镜头轨迹 (CAMERA TRACK)</span>
          </div>
          {showCameraTrack ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showCameraTrack && (
          <div className="p-3 bg-black/40 border border-cine-accent/20 rounded-sm animate-in slide-in-from-top-2 duration-300">
             <textarea
                value={cameraTrack}
                onChange={(e) => setCameraTrack(e.target.value)}
                placeholder="例如：第1格特写，第2格中景，带轻微推移。若留空则AI智能决定..."
                className="w-full h-16 bg-transparent border-none p-0 text-[11px] text-zinc-400 focus:ring-0 resize-none font-mono leading-relaxed placeholder:text-zinc-800 custom-scrollbar"
                spellCheck={false}
             />
          </div>
        )}
      </div>

      <div className="space-y-2.5 flex-1 flex flex-col min-h-[160px]">
        <div className="flex justify-between items-end">
            <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
                <span className="w-1 h-3 bg-cine-accent rounded-full shadow-[0_0_8px_#FF7A00]"></span>
                创作指令 (DIRECTOR PROMPT)
            </label>
            
            {isContinuing ? (
                <button 
                  onClick={onDeselect}
                  className="flex items-center gap-1.5 bg-cine-accent/5 text-cine-accent px-2.5 py-1 rounded-full border border-cine-accent/40 animate-in fade-in duration-500 shadow-[0_0_10px_rgba(255,122,0,0.1)] hover:bg-cine-accent/20 transition-all group"
                >
                    <GitMerge size={10} className="group-hover:rotate-180 transition-transform duration-500" />
                    <span className="text-[8px] font-mono tracking-widest font-bold">续写模式</span>
                    <XCircle size={10} className="opacity-60" />
                </button>
            ) : (
                <div className="flex items-center gap-1.5 text-zinc-600 px-2.5 py-1 font-mono text-[8px] tracking-widest">
                    <PlusCircle size={10} />
                    <span>独立创作模式</span>
                </div>
            )}
        </div>
        
        <div className={`relative flex-1 group transition-all duration-500 overflow-hidden rounded-sm ${isContinuing ? 'ring-1 ring-cine-accent/20 border border-cine-accent/30' : 'ring-1 ring-zinc-800/50 focus-within:ring-cine-accent/30 border border-transparent'}`}>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isContinuing ? "// 继续扩展该分镜的世界观..." : "// 描述一个电影级画面，包括构图、光影、氛围..."}
                className={`w-full h-full absolute inset-0 bg-black/60 backdrop-blur-sm border-none p-4 text-[13px] text-zinc-300 focus:ring-0 resize-none font-mono leading-relaxed placeholder:text-zinc-800 custom-scrollbar transition-all duration-500 focus:bg-zinc-900/20 ${
                    isContinuing ? 'text-cine-accent/90' : ''
                }`}
                spellCheck={false}
            />
        </div>
      </div>

      <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onEnhancePrompt} 
            disabled={isGenerating || !prompt.trim()} 
            className="flex-1 text-[9px] h-9 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/20"
          >
              <Wand2 size={12} className="mr-2 text-cine-accent" /> 提示词增强
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onGenerateCamera} 
            disabled={isGenerating || !prompt.trim()} 
            className="flex-1 text-[9px] h-9 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/20"
          >
              <Video size={12} className="mr-2 text-zinc-500" /> 生成参考轨迹
          </Button>
      </div>

      <div className="flex gap-2">
        {isGenerating && onStop ? (
            <Button 
                variant="primary"
                className="flex-1 py-4.5 tracking-[0.25em] uppercase font-mono text-[10px] font-bold h-12 border-red-900/30 text-red-500 hover:bg-red-500/10"
                onClick={onStop}
            >
                <Square size={14} className="mr-2" fill="currentColor" /> 停止渲染 (STOP)
            </Button>
        ) : (
            <Button 
                variant="accent" 
                className="w-full py-4.5 tracking-[0.25em] uppercase font-mono text-[10px] font-bold relative overflow-hidden group transition-all duration-500 h-12"
                onClick={onGenerate}
                disabled={isGenerating || !prompt.trim()}
            >
                <span className="relative z-10 flex items-center justify-center gap-3">
                    {isGenerating ? <Zap size={14} className="animate-spin" /> : (isContinuing ? <GitMerge size={14} /> : <Layers size={14} />)}
                    {isGenerating ? '正在执行渲染...' : (isContinuing ? '续写当前分镜' : '执行 新分镜渲染')}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
            </Button>
        )}
      </div>

      <style>{`
          @keyframes shimmer {
            100% { transform: translateX(100%); }
          }
      `}</style>
    </div>
  );
};
