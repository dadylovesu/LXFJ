
import React, { useState } from 'react';
import { Button } from './Button';
import { AspectRatio, ImageSize, PanelAspectRatio, CameraTransformConfig } from '../types';
import { Settings2, GitMerge, Video, Layers, Zap, LayoutGrid, ChevronRight, ChevronLeft, XCircle, PlusCircle, Square, Wand2, Info, Palette, Cpu, Sliders, ChevronDown, ChevronUp, Camera } from 'lucide-react';

interface DirectorDeckProps {
  gridSize: number;
  setGridSize: (s: number) => void;
  aspectRatio: AspectRatio;
  panelAspectRatio: PanelAspectRatio;
  setPanelAspectRatio: (par: PanelAspectRatio) => void;
  imageSize: ImageSize;
  setImageSize: (size: ImageSize) => void;
  prompt: string;
  setPrompt: (text: string) => void;
  stylePrompt: string; 
  setStylePrompt: (text: string) => void; 
  onGenerate: () => void;
  onStop?: () => void;
  isGenerating: boolean;
  onEnhancePrompt?: () => void;
  onGenerateCamera?: () => void;
  onOpenScriptDeconstruct?: () => void;
  isContinuing?: boolean;
  onDeselect?: () => void;
  isCollageActive?: boolean;
  // Multi-Angle specific
  transformConfigs: CameraTransformConfig[];
  setTransformConfigs: (configs: CameraTransformConfig[]) => void;
  onTransformGenerate: () => void;
  isTransformActive: boolean;
  setIsTransformActive: (active: boolean) => void;
}

export const DirectorDeck: React.FC<DirectorDeckProps> = ({
  gridSize,
  setGridSize,
  aspectRatio,
  panelAspectRatio,
  setPanelAspectRatio,
  imageSize,
  setImageSize,
  prompt,
  setPrompt,
  stylePrompt,
  setStylePrompt,
  onGenerate,
  onStop,
  isGenerating,
  onEnhancePrompt,
  onGenerateCamera,
  onOpenScriptDeconstruct,
  isContinuing = false,
  onDeselect,
  isCollageActive = false,
  transformConfigs,
  setTransformConfigs,
  onTransformGenerate,
  isTransformActive,
  setIsTransformActive
}) => {
  const [activeTransformSlot, setActiveTransformSlot] = useState(0);

  const getQualityLabel = () => {
      switch(imageSize) {
          case ImageSize.K1: return "1K 标准";
          case ImageSize.K2: return "2K 高清";
          case ImageSize.K4: return "4K 极致";
          default: return "4K Master";
      }
  };

  const updateSlot = (key: keyof CameraTransformConfig, value: number) => {
    const next = [...transformConfigs];
    next[activeTransformSlot] = { ...next[activeTransformSlot], [key]: value };
    setTransformConfigs(next);
  };

  return (
    <div className="flex flex-col h-full space-y-5 select-none">
      
      {/* 00. SINGLE SHOT MULTI-ANGLE TRANSFORMATION (NEW) */}
      <div className="space-y-3 pt-2 border-t border-zinc-800/80">
        <button 
          onClick={() => setIsTransformActive(!isTransformActive)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-sm transition-all border ${isTransformActive ? 'bg-cine-accent/10 border-cine-accent/40' : 'bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700'}`}
        >
          <div className="flex items-center gap-2.5">
            <Camera size={14} className={isTransformActive ? 'text-cine-accent' : 'text-zinc-500'} />
            <span className={`text-[10px] font-mono font-bold tracking-[0.2em] ${isTransformActive ? 'text-cine-accent' : 'text-zinc-300'}`}>
              单分镜多角度变换 (TRANSFORM)
            </span>
          </div>
          {isTransformActive ? <ChevronUp size={14} className="text-cine-accent" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </button>

        {isTransformActive && (
          <div className="p-4 bg-zinc-900/60 border border-cine-accent/20 rounded-sm space-y-5 animate-in slide-in-from-top-2 duration-300">
            {/* Slot Selector */}
            <div className="space-y-2">
              <span className="text-[8px] text-zinc-500 font-mono uppercase tracking-widest">选择部署槽位 (SLOT)</span>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
                {[...Array(gridSize * gridSize)].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setActiveTransformSlot(i)}
                    className={`h-7 border rounded-[1px] font-mono text-[9px] flex items-center justify-center transition-all ${activeTransformSlot === i ? 'bg-cine-accent text-black font-bold border-cine-accent' : 'bg-black/40 text-zinc-500 border-zinc-800'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-4 pt-1">
              {/* Focal Length */}
              <div className="space-y-2">
                <div className="flex justify-between text-[8px] font-mono">
                  <span className="text-zinc-400">景别焦段 (FOCAL)</span>
                  <span className="text-cine-accent">{transformConfigs[activeTransformSlot]?.focalLength}MM</span>
                </div>
                <input 
                  type="range" min="15" max="250" 
                  value={transformConfigs[activeTransformSlot]?.focalLength || 35} 
                  onChange={(e) => updateSlot('focalLength', parseInt(e.target.value))}
                  className="w-full accent-cine-accent bg-zinc-800 h-1 rounded-full appearance-none cursor-pointer"
                />
              </div>
              
              {/* Pitch */}
              <div className="space-y-2">
                <div className="flex justify-between text-[8px] font-mono">
                  <span className="text-zinc-400">俯仰角度 (PITCH)</span>
                  <span className="text-cine-accent">{transformConfigs[activeTransformSlot]?.pitch}°</span>
                </div>
                <input 
                  type="range" min="-180" max="180" 
                  value={transformConfigs[activeTransformSlot]?.pitch || 0} 
                  onChange={(e) => updateSlot('pitch', parseInt(e.target.value))}
                  className="w-full accent-cine-accent bg-zinc-800 h-1 rounded-full appearance-none cursor-pointer"
                />
              </div>

              {/* Yaw */}
              <div className="space-y-2">
                <div className="flex justify-between text-[8px] font-mono">
                  <span className="text-zinc-400">水平环绕 (YAW)</span>
                  <span className="text-cine-accent">{transformConfigs[activeTransformSlot]?.yaw}°</span>
                </div>
                <input 
                  type="range" min="-180" max="180" 
                  value={transformConfigs[activeTransformSlot]?.yaw || 0} 
                  onChange={(e) => updateSlot('yaw', parseInt(e.target.value))}
                  className="w-full accent-cine-accent bg-zinc-800 h-1 rounded-full appearance-none cursor-pointer"
                />
              </div>
            </div>

            <Button 
              variant="accent" 
              size="sm" 
              className="w-full h-9 text-[9px] shadow-lg tracking-widest"
              onClick={onTransformGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? <Zap size={12} className="animate-spin mr-2" /> : <Sliders size={12} className="mr-2" />}
              执行变换渲染 (EXECUTE TRANSFORM)
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800/80 pt-5 mt-2">
         <span className="text-zinc-300 text-[10px] uppercase tracking-[0.25em] font-mono font-bold flex items-center gap-2">
            <Settings2 size={10} className="text-cine-accent opacity-50" />
            02. 导演控制台 (CONTROL)
         </span>
         {isGenerating && !isTransformActive && (
             <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-cine-accent rounded-full animate-subtle-pulse shadow-[0_0_8px_#FF7A00]"></div>
                 <span className="text-[9px] text-cine-accent font-mono tracking-widest font-bold">RENDERING</span>
             </div>
         )}
      </div>

      {/* Composition Group */}
      <div className="space-y-4">
        <label className="text-[9px] text-zinc-400 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
            <span className="w-1 h-3 bg-zinc-700 rounded-full"></span>
            构图与规模 (COMPOSITION)
        </label>
        
        <div className="space-y-5 p-4 bg-zinc-900/40 border border-zinc-800/40 rounded-sm backdrop-blur-md">
            {/* NxN Grid Size */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <span className="text-[8px] text-zinc-400 font-mono uppercase tracking-widest">宫格规模 (GRID SIZE)</span>
                   <span className="text-[10px] text-cine-accent font-mono font-bold">{gridSize} x {gridSize}</span>
                </div>
                <div className="flex items-center bg-black/40 border border-zinc-800 rounded-sm p-1.5">
                    <button onClick={() => setGridSize(Math.max(1, gridSize - 1))} className="p-1 text-zinc-500 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
                    <div className="flex-1 text-center font-mono text-[11px] text-zinc-300 tracking-widest">{gridSize} x {gridSize} 方阵</div>
                    <button onClick={() => setGridSize(Math.min(4, gridSize + 1))} className="p-1 text-zinc-500 hover:text-white transition-colors"><ChevronRight size={16} /></button>
                </div>
            </div>

            {/* Single Panel Aspect Ratio */}
            <div className="space-y-3 pt-3 border-t border-zinc-800/50">
                <div className="flex justify-between items-center">
                   <span className="text-[8px] text-zinc-400 font-mono uppercase tracking-widest">单分镜构图比例 (PANEL AR)</span>
                   <span className="text-[9px] text-cine-accent font-mono font-bold">{panelAspectRatio}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    {Object.values(PanelAspectRatio).map((par) => (
                        <button
                            key={par}
                            onClick={() => setPanelAspectRatio(par)}
                            className={`text-[9px] h-7 border rounded-[1px] font-mono transition-all duration-300 flex items-center justify-center ${
                                panelAspectRatio === par ? 'border-cine-accent text-cine-accent bg-cine-accent/10 shadow-[0_0_10px_rgba(255,122,0,0.1)]' : 'border-zinc-800/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 bg-transparent'
                            }`}
                        >
                            {par}
                        </button>
                    ))}
                </div>
            </div>

            {/* Auto Container Aspect Ratio Info */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50">
               <span className="text-[8px] text-zinc-400 font-mono uppercase tracking-widest">输出画面比例 (AUTO)</span>
               <div className="px-2 py-0.5 bg-zinc-800 rounded-[1px] text-[9px] font-mono text-zinc-300 border border-zinc-700">
                  {aspectRatio}
               </div>
            </div>
        </div>
      </div>

      {/* Engine Group */}
      <div className="space-y-4">
        <label className="text-[9px] text-zinc-400 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
            <span className="w-1 h-3 bg-zinc-700 rounded-full"></span>
            输出引擎 (ENGINE)
        </label>
        
        <div className="space-y-4 p-4 bg-zinc-900/40 border border-zinc-800/40 rounded-sm backdrop-blur-md">
            <div className="flex justify-between items-center">
               <span className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-widest">GEN 3 PRO ENGINE</span>
               <span className="text-[9px] text-cine-accent font-mono font-bold uppercase tracking-widest">{getQualityLabel()}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {[ImageSize.K1, ImageSize.K2, ImageSize.K4].map((size) => (
                    <button
                        key={size}
                        onClick={() => setImageSize(size)}
                        className={`h-10 border rounded-[1px] font-mono text-[10px] font-bold transition-all duration-300 flex items-center justify-center ${
                            imageSize === size 
                            ? 'border-cine-accent text-cine-accent bg-cine-accent/5 shadow-[0_0_15px_rgba(255,122,0,0.1)]' 
                            : 'border-zinc-800/80 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400 bg-black/20'
                        }`}
                    >
                        {size}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {!isTransformActive && (
        <>
          {/* Style Preset Group */}
          <div className="space-y-2.5">
            <label className="text-[9px] text-zinc-400 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
                <span className="w-1 h-3 bg-zinc-700 rounded-full"></span>
                视觉风格 (STYLE PRESET)
            </label>
            <div className="relative group/style">
                <input 
                    type="text"
                    value={stylePrompt}
                    onChange={(e) => setStylePrompt(e.target.value)}
                    placeholder="默认：参考图风格 (Default: Asset Style)"
                    className="w-full bg-black/60 border border-zinc-800/80 rounded-sm px-4 py-3 text-[11px] text-cine-accent font-mono focus:border-cine-accent focus:ring-1 focus:ring-cine-accent/20 placeholder:text-zinc-700 transition-all"
                    spellCheck={false}
                />
                <Palette size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within/style:text-cine-accent transition-colors" />
            </div>
          </div>

          {/* Prompt Area */}
          <div className="space-y-2.5 flex-1 flex flex-col min-h-[160px]">
            <div className="flex justify-between items-end">
                <label className="text-[9px] text-zinc-400 font-mono uppercase tracking-[0.15em] flex items-center gap-2.5">
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
                    <div className="flex items-center gap-1.5 text-zinc-400 px-2.5 py-1 font-mono text-[8px] tracking-widest">
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
                    className="w-full h-full absolute inset-0 bg-black/60 backdrop-blur-sm border-none p-4 text-[13px] text-zinc-200 focus:ring-0 resize-none font-mono leading-relaxed placeholder:text-zinc-600 custom-scrollbar transition-all duration-500 focus:bg-zinc-900/20"
                    spellCheck={false}
                />
            </div>
          </div>

          {/* Tools Row */}
          <div className="grid grid-cols-2 gap-2 relative">
              <Button 
                variant="primary" 
                size="sm" 
                onClick={onOpenScriptDeconstruct} 
                disabled={isGenerating} 
                className="text-[9px] h-10 border-dashed border-zinc-800 group"
              >
                  <Wand2 size={12} className="mr-2 text-zinc-400 group-hover:text-cine-accent transition-colors" /> 
                  智能脚本拆解
              </Button>
              <div className="relative group/tool">
                <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={onGenerateCamera} 
                    disabled={isGenerating || !prompt.trim() || isCollageActive} 
                    className={`w-full text-[9px] h-10 border-dashed border-zinc-800 group ${isCollageActive ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                >
                    <Video size={12} className="mr-2 text-zinc-400 group-hover:text-cine-accent transition-colors" /> 
                    分镜镜头逻辑
                </Button>
                {isCollageActive && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 bg-black/90 text-cine-accent text-[8px] p-2 border border-cine-accent/30 rounded-sm opacity-0 group-hover/tool:opacity-100 transition-opacity pointer-events-none z-50 font-mono uppercase tracking-tighter text-center">
                        <Info size={10} className="inline mr-1" /> 已激活镜头组参考，文本逻辑已禁用
                    </div>
                )}
              </div>
          </div>
        </>
      )}

      {/* Action Button Group */}
      <div className="flex gap-2">
        {isGenerating && onStop ? (
            <Button variant="primary" className="flex-1 tracking-[0.25em] h-12 border-red-900/30 text-red-500 hover:bg-red-500/10" onClick={onStop}>
                <Square size={14} className="mr-2" fill="currentColor" /> 停止 (STOP)
            </Button>
        ) : (
          !isTransformActive && (
            <Button variant="accent" className="w-full tracking-[0.25em] h-12 shadow-[0_0_20px_rgba(255,122,0,0.3)]" onClick={onGenerate} disabled={isGenerating || !prompt.trim()}>
                <span className="flex items-center justify-center gap-3">
                    {isGenerating ? <Zap size={14} className="animate-spin" /> : (isContinuing ? <GitMerge size={14} /> : <Layers size={14} />)}
                    {isGenerating ? '渲染中...' : (isContinuing ? '续写分镜' : '执行渲染')}
                </span>
            </Button>
          )
        )}
      </div>
    </div>
  );
};
