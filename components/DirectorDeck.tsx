
import React, { useMemo } from 'react';
import { Button } from './Button';
import { AspectRatio, ImageSize, PanelAspectRatio } from '../types';
import { Settings2, GitMerge, Video, Layers, Zap, LayoutGrid, ChevronRight, ChevronLeft, XCircle, PlusCircle, Square, Wand2, Calculator, Info } from 'lucide-react';

interface DirectorDeckProps {
  gridRows: number;
  setGridRows: (r: number) => void;
  gridCols: number;
  setGridCols: (c: number) => void;
  aspectRatio: AspectRatio | string;
  setAspectRatio: (ar: AspectRatio | string) => void;
  panelAspectRatio: PanelAspectRatio;
  setPanelAspectRatio: (ar: PanelAspectRatio) => void;
  imageSize: ImageSize;
  setImageSize: (size: ImageSize) => void;
  prompt: string;
  setPrompt: (text: string) => void;
  onGenerate: () => void;
  onStop?: () => void;
  isGenerating: boolean;
  onEnhancePrompt?: () => void;
  onGenerateCamera?: () => void;
  onOpenScriptDeconstruct?: () => void;
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
  panelAspectRatio,
  setPanelAspectRatio,
  imageSize,
  setImageSize,
  prompt,
  setPrompt,
  onGenerate,
  onStop,
  isGenerating,
  onEnhancePrompt,
  onGenerateCamera,
  onOpenScriptDeconstruct,
  isContinuing = false,
  onDeselect
}) => {
  
  const getQualityLabel = () => {
      switch(imageSize) {
          case ImageSize.K1: return "1K 标准";
          case ImageSize.K2: return "2K 高清";
          case ImageSize.K4: return "4K 极致";
          default: return "4K Master";
      }
  };

  const calculatedTotalRatioString = useMemo(() => {
    const [wStr, hStr] = panelAspectRatio.split(':');
    const w = parseInt(wStr);
    const h = parseInt(hStr);
    const totalW = gridCols * w;
    const totalH = gridRows * h;
    
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const common = gcd(totalW, totalH);
    return `${totalW / common}:${totalH / common}`;
  }, [gridRows, gridCols, panelAspectRatio]);

  const engineBestFit = useMemo(() => {
    const supported = [
        { label: '1:1', val: 1.0 },
        { label: '4:3', val: 1.333 },
        { label: '3:4', val: 0.75 },
        { label: '16:9', val: 1.777 },
        { label: '9:16', val: 0.5625 }
    ];

    const [wStr, hStr] = calculatedTotalRatioString.split(':');
    const target = parseInt(wStr) / parseInt(hStr);
    
    let best = supported[0];
    let minDiff = Math.abs(target - best.val);
    
    for(const s of supported) {
        const diff = Math.abs(target - s.val);
        if(diff < minDiff) {
            minDiff = diff;
            best = s;
        }
    }
    return best.label;
  }, [calculatedTotalRatioString]);

  // Sync the engine's real aspect ratio whenever calculation changes
  React.useEffect(() => {
      setAspectRatio(engineBestFit);
  }, [engineBestFit, setAspectRatio]);

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
      <div className="space-y-4">
        <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
            <span className="w-1 h-3 bg-zinc-800 rounded-full"></span>
            构图与宫格 (GRID & COMP)
        </label>
        
        <div className="space-y-4 p-4 bg-zinc-900/40 border border-zinc-800/40 rounded-sm backdrop-blur-md">
            {/* Grid Size */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <span className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest">宫格行列 (ROWS x COLS)</span>
                   <span className="text-[10px] text-cine-accent font-mono font-bold">{gridRows} x {gridCols}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center bg-black/40 border border-zinc-800 rounded-sm p-1">
                        <button onClick={() => setGridRows(Math.max(1, gridRows - 1))} className="p-1 text-zinc-600 hover:text-white"><ChevronLeft size={14} /></button>
                        <div className="flex-1 text-center font-mono text-xs text-zinc-300">R: {gridRows}</div>
                        <button onClick={() => setGridRows(Math.min(4, gridRows + 1))} className="p-1 text-zinc-600 hover:text-white"><ChevronRight size={14} /></button>
                    </div>
                    <div className="flex items-center bg-black/40 border border-zinc-800 rounded-sm p-1">
                        <button onClick={() => setGridCols(Math.max(1, gridCols - 1))} className="p-1 text-zinc-600 hover:text-white"><ChevronLeft size={14} /></button>
                        <div className="flex-1 text-center font-mono text-xs text-zinc-300">C: {gridCols}</div>
                        <button onClick={() => setGridCols(Math.min(4, gridCols + 1))} className="p-1 text-zinc-600 hover:text-white"><ChevronRight size={14} /></button>
                    </div>
                </div>
            </div>

            {/* Panel Aspect Ratio - NEW REQUIREMENT */}
            <div className="space-y-3 pt-3 border-t border-zinc-800/50">
                <div className="flex justify-between items-center">
                   <span className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest">单分镜比例 (PANEL RATIO)</span>
                   <span className="text-[10px] text-white font-mono font-bold">{panelAspectRatio}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    {Object.values(PanelAspectRatio).map((par) => (
                        <button
                            key={par}
                            onClick={() => setPanelAspectRatio(par)}
                            className={`text-[9px] h-7 border rounded-[1px] font-mono transition-all duration-300 flex items-center justify-center ${
                                panelAspectRatio === par ? 'border-cine-accent text-cine-accent bg-cine-accent/5' : 'border-zinc-800/60 text-zinc-700 hover:border-zinc-700 hover:text-zinc-500 bg-transparent'
                            }`}
                        >
                            {par}
                        </button>
                    ))}
                </div>
            </div>

            {/* Optimized Result Display */}
            <div className="space-y-2 pt-3 border-t border-zinc-800/50">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[8px] text-zinc-600 font-mono uppercase tracking-widest flex items-center gap-1.5">
                        <Calculator size={10} /> 适配比例计算 (OPTIMIZER)
                    </span>
                </div>
                <div className="bg-black/40 border border-zinc-800 rounded-[2px] p-2 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[7px] text-zinc-600 font-mono uppercase">理论总比例 (Calculated)</span>
                        <span className="text-[11px] text-white font-bold font-mono tracking-wider">{calculatedTotalRatioString}</span>
                    </div>
                    <div className="w-[1px] h-6 bg-zinc-800"></div>
                    <div className="flex flex-col gap-0.5 items-end">
                        <span className="text-[7px] text-zinc-600 font-mono uppercase">引擎适配比例 (Target)</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-cine-accent font-black font-mono tracking-wider">{engineBestFit}</span>
                            <Info size={10} className="text-zinc-700 cursor-help" title={`基于宫格 ${gridRows}x${gridCols} 与单分镜比例 ${panelAspectRatio} 自动匹配最接近的渲染引擎比例。`} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Quality Group */}
      <div className="space-y-2.5">
        <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
            <span className="w-1 h-3 bg-zinc-800 rounded-full"></span>
            渲染质量 (ENGINE)
        </label>
        <div className="p-3 bg-black/40 border border-zinc-800/60 rounded-sm space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">GEMINI 3 PRO</span>
                <span className="text-[9px] text-cine-accent font-bold font-mono">{getQualityLabel()}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {[ImageSize.K1, ImageSize.K2, ImageSize.K4].map((sz) => (
                    <button
                        key={sz}
                        onClick={() => setImageSize(sz)}
                        className={`text-[9px] h-7 border rounded-[1px] font-mono transition-all duration-300 ${
                            imageSize === sz ? 'border-cine-accent/50 text-cine-accent bg-cine-accent/5' : 'border-zinc-800/60 text-zinc-700 hover:border-zinc-700 hover:text-zinc-500 bg-transparent'
                        }`}
                    >
                        {sz}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* Prompt Area */}
      <div className="space-y-2.5 flex-1 flex flex-col min-h-[160px]">
        <div className="flex justify-between items-end">
            <label className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
                <span className="w-1 h-3 bg-cine-accent rounded-full shadow-[0_0_8px_#FF7A00]"></span>
                创作指令 (DIRECTOR PROMPT)
            </label>
            
            {isContinuing ? (
                <button onClick={onDeselect} className="flex items-center gap-1.5 bg-cine-accent/5 text-cine-accent px-2.5 py-1 rounded-full border border-cine-accent/40 animate-in fade-in duration-500 shadow-[0_0_10px_rgba(255,122,0,0.1)] hover:bg-cine-accent/20 transition-all group">
                    <GitMerge size={10} />
                    <span className="text-[8px] font-mono tracking-widest font-bold">续写模式</span>
                    <XCircle size={10} className="opacity-60" />
                </button>
            ) : (
                <div className="flex items-center gap-1.5 text-zinc-600 px-2.5 py-1 font-mono text-[8px] tracking-widest">
                    <PlusCircle size={10} />
                    <span>新创作模式</span>
                </div>
            )}
        </div>
        
        <div className={`relative flex-1 group transition-all duration-500 overflow-hidden rounded-sm ${isContinuing ? 'ring-1 ring-cine-accent/20 border border-cine-accent/30' : 'ring-1 ring-zinc-800/50 focus-within:ring-cine-accent/30 border border-transparent'}`}>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isContinuing ? "// 继续扩展该分镜的世界观..." : "// 描述一个电影级画面..."}
                className="w-full h-full absolute inset-0 bg-black/60 backdrop-blur-sm border-none p-4 text-[13px] text-zinc-300 focus:ring-0 resize-none font-mono leading-relaxed placeholder:text-zinc-800 custom-scrollbar transition-all duration-500 focus:bg-zinc-900/20"
                spellCheck={false}
            />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" size="sm" onClick={onOpenScriptDeconstruct} disabled={isGenerating} className="text-[9px] h-10 border-dashed border-zinc-800">
              <Wand2 size={12} className="mr-2" /> 脚本拆解
          </Button>
          <Button variant="primary" size="sm" onClick={onGenerateCamera} disabled={isGenerating || !prompt.trim()} className="text-[9px] h-10 border-dashed border-zinc-800">
              <Video size={12} className="mr-2" /> 镜头逻辑
          </Button>
      </div>

      <div className="flex gap-2">
        {isGenerating && onStop ? (
            <Button variant="primary" className="flex-1 tracking-[0.25em] h-12 border-red-900/30 text-red-500 hover:bg-red-500/10" onClick={onStop}>
                <Square size={14} className="mr-2" fill="currentColor" /> 停止 (STOP)
            </Button>
        ) : (
            <Button variant="accent" className="w-full tracking-[0.25em] h-12 shadow-[0_0_20px_rgba(255,122,0,0.3)]" onClick={onGenerate} disabled={isGenerating || !prompt.trim()}>
                <span className="flex items-center justify-center gap-3">
                    {isGenerating ? <Zap size={14} className="animate-spin" /> : (isContinuing ? <GitMerge size={14} /> : <Layers size={14} />)}
                    {isGenerating ? '渲染中...' : (isContinuing ? '续写分镜' : '执行渲染')}
                </span>
            </Button>
        )}
      </div>
    </div>
  );
};