import React, { useRef, useState } from 'react';
import { Button } from './Button';
import { AspectRatio, ImageSize, PanelAspectRatio, GeneratedImage } from '../types';
import { Settings2, GitMerge, Video, Layers, Zap, LayoutGrid, ChevronRight, ChevronLeft, XCircle, PlusCircle, Square, Wand2, Info, Palette, Cpu, ImagePlus, X, History } from 'lucide-react';

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
  styleRefImage: string | null;
  setStyleRefImage: (url: string | null) => void;
  onGenerate: () => void;
  onStop?: () => void;
  isGenerating: boolean;
  onEnhancePrompt?: () => void;
  onGenerateCamera?: () => void;
  onOpenScriptDeconstruct?: () => void;
  isContinuing?: boolean;
  selectedImage?: GeneratedImage | null;
  onDeselect?: () => void;
  isCollageActive?: boolean;
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
  styleRefImage,
  setStyleRefImage,
  onGenerate,
  onStop,
  isGenerating,
  onEnhancePrompt,
  onGenerateCamera,
  onOpenScriptDeconstruct,
  isContinuing = false,
  selectedImage,
  onDeselect,
  isCollageActive = false
}) => {
  const styleInputRef = useRef<HTMLInputElement>(null);
  const [showHistoryPreview, setShowHistoryPreview] = useState(false);

  const handleStyleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setStyleRefImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

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
      <div className="flex items-center justify-between border-t border-zinc-700 pt-5 mt-2">
         <span className="text-white text-[11px] uppercase tracking-[0.2em] font-bold flex items-center gap-2">
            <Settings2 size={12} className="text-cine-accent" />
            02. 导演控制台 (CONTROL)
         </span>
         {isGenerating && (
             <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-cine-accent rounded-full animate-subtle-pulse shadow-[0_0_8px_#FF7A00]"></div>
                 <span className="text-[10px] text-cine-accent tracking-widest font-bold">渲染中...</span>
             </div>
         )}
      </div>

      {/* Composition Group */}
      <div className="space-y-4">
        <label className="text-[10px] text-zinc-100 font-bold uppercase tracking-[0.1em] flex items-center gap-2.5">
            <span className="w-1.5 h-3 bg-zinc-600 rounded-full"></span>
            构图与规模 (COMPOSITION)
        </label>
        
        <div className="space-y-5 p-4 bg-zinc-900/60 border border-zinc-700 rounded-sm backdrop-blur-md">
            {/* NxN Grid Size */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] text-zinc-200 uppercase tracking-widest font-bold">宫格规模 (GRID SIZE)</span>
                   <span className="text-[12px] text-cine-accent font-bold">{gridSize} x {gridSize}</span>
                </div>
                <div className="flex items-center bg-black/40 border border-zinc-700 rounded-sm p-2">
                    <button onClick={() => setGridSize(Math.max(1, gridSize - 1))} className="p-1 text-white hover:text-cine-accent transition-colors"><ChevronLeft size={20} /></button>
                    <div className="flex-1 text-center text-[12px] text-white tracking-widest font-bold">{gridSize} x {gridSize} 方阵</div>
                    <button onClick={() => setGridSize(Math.min(4, gridSize + 1))} className="p-1 text-white hover:text-cine-accent transition-colors"><ChevronRight size={20} /></button>
                </div>
            </div>

            {/* Single Panel Aspect Ratio */}
            <div className="space-y-3 pt-3 border-t border-zinc-700">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] text-zinc-200 uppercase tracking-widest font-bold">单分镜构图比例 (PANEL AR)</span>
                   <span className="text-[10px] text-cine-accent font-bold">{panelAspectRatio}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {Object.values(PanelAspectRatio).map((par) => (
                        <button
                            key={par}
                            onClick={() => setPanelAspectRatio(par)}
                            className={`text-[10px] h-8 border rounded-[1px] font-bold transition-all duration-300 flex items-center justify-center ${
                                panelAspectRatio === par ? 'border-cine-accent text-cine-accent bg-cine-accent/20' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white bg-transparent'
                            }`}
                        >
                            {par}
                        </button>
                    ))}
                </div>
            </div>

            {/* Auto Container Aspect Ratio Info */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-700">
               <span className="text-[10px] text-zinc-200 uppercase tracking-widest font-bold">输出画面比例 (AUTO)</span>
               <div className="px-2 py-1 bg-zinc-800 rounded-[1px] text-[10px] font-bold text-white border border-zinc-600">
                  {aspectRatio}
               </div>
            </div>
        </div>
      </div>

      {/* Engine Group */}
      <div className="space-y-4">
        <label className="text-[10px] text-zinc-100 font-bold uppercase tracking-[0.1em] flex items-center gap-2.5">
            <span className="w-1.5 h-3 bg-zinc-600 rounded-full"></span>
            输出引擎 (ENGINE)
        </label>
        
        <div className="space-y-4 p-4 bg-zinc-900/60 border border-zinc-700 rounded-sm backdrop-blur-md">
            <div className="flex justify-between items-center">
               <span className="text-[10px] text-zinc-200 font-bold uppercase tracking-widest">GEN 3 PRO ENGINE</span>
               <span className="text-[10px] text-cine-accent font-bold uppercase tracking-widest">{getQualityLabel()}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {[ImageSize.K1, ImageSize.K2, ImageSize.K4].map((size) => (
                    <button
                        key={size}
                        onClick={() => setImageSize(size)}
                        className={`h-11 border rounded-[1px] text-[11px] font-black transition-all duration-300 flex items-center justify-center ${
                            imageSize === size 
                            ? 'border-cine-accent text-cine-accent bg-cine-accent/10 shadow-[0_0_15px_rgba(255,122,0,0.1)]' 
                            : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white bg-black/30'
                        }`}
                    >
                        {size}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* Style Preset Group */}
      <div className="space-y-3">
        <label className="text-[10px] text-zinc-100 font-bold uppercase tracking-[0.1em] flex items-center gap-2.5">
            <span className="w-1.5 h-3 bg-zinc-600 rounded-full"></span>
            视觉风格 (STYLE PRESET)
        </label>
        <div className="space-y-3">
          <div className="relative group/style">
              <input 
                  type="text"
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                  placeholder="参考图风格 (默认: Asset Style)"
                  className="w-full bg-black/60 border border-zinc-700 rounded-sm px-4 py-3.5 pr-10 text-[12px] text-cine-accent font-bold focus:border-cine-accent focus:ring-1 focus:ring-cine-accent/20 placeholder:text-zinc-500 transition-all"
                  spellCheck={false}
              />
              <Palette size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within/style:text-cine-accent transition-colors" />
          </div>
          
          <div className="flex items-center gap-2">
              <button 
                onClick={() => styleInputRef.current?.click()}
                className={`flex-1 flex items-center justify-center gap-2 py-3 bg-black/40 border border-dashed rounded-sm text-[11px] font-bold transition-all ${styleRefImage ? 'border-cine-accent text-cine-accent bg-cine-accent/10' : 'border-zinc-600 text-zinc-100 hover:border-zinc-400 hover:text-white'}`}
              >
                  <ImagePlus size={16} />
                  {styleRefImage ? '已上传参考风格' : '上传参考风格图'}
              </button>
              <input type="file" ref={styleInputRef} className="hidden" accept="image/*" onChange={handleStyleImageUpload} />
              
              {styleRefImage && (
                <div className="relative w-11 h-11 group/styleimg">
                   <img src={styleRefImage} className="w-full h-full object-cover rounded-sm border border-cine-accent" />
                   <button 
                     onClick={() => setStyleRefImage(null)}
                     className="absolute -top-2 -right-2 bg-black text-red-500 rounded-full border border-zinc-700 p-1 opacity-0 group-hover/styleimg:opacity-100 transition-opacity"
                   >
                     <X size={12} />
                   </button>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Prompt Area */}
      <div className="space-y-3 flex-1 flex flex-col min-h-[180px]">
        <div className="flex justify-between items-end">
            <label className="text-[10px] text-zinc-100 font-bold uppercase tracking-[0.1em] flex items-center gap-2.5">
                <span className="w-1.5 h-3 bg-cine-accent rounded-full shadow-[0_0_8px_#FF7A00]"></span>
                创作指令 (DIRECTOR PROMPT)
            </label>
            
            <div className="flex gap-2">
                {isContinuing && selectedImage && (
                    <button 
                        onClick={() => setShowHistoryPreview(!showHistoryPreview)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all group ${showHistoryPreview ? 'bg-cine-accent text-black border-cine-accent' : 'bg-zinc-800 text-white border-zinc-700 hover:border-zinc-500'}`}
                    >
                        <History size={12} />
                        <span className="text-[10px] font-bold tracking-widest">查看历史指令</span>
                    </button>
                )}
                
                {isContinuing ? (
                    <button onClick={onDeselect} className="flex items-center gap-1.5 bg-cine-accent/10 text-cine-accent px-3 py-1.5 rounded-full border border-cine-accent/50 shadow-[0_0_10px_rgba(255,122,0,0.1)] hover:bg-cine-accent/20 transition-all">
                        <GitMerge size={12} />
                        <span className="text-[10px] font-bold tracking-widest uppercase">续写模式</span>
                        <XCircle size={12} className="ml-1" />
                    </button>
                ) : (
                    <div className="flex items-center gap-1.5 text-white px-3 py-1.5 font-bold text-[10px] tracking-widest border border-zinc-700 rounded-full">
                        <PlusCircle size={12} />
                        <span>新创作模式</span>
                    </div>
                )}
            </div>
        </div>
        
        <div className={`relative flex-1 group transition-all duration-500 overflow-hidden rounded-sm ${isContinuing ? 'ring-2 ring-cine-accent/30 border border-cine-accent/50' : 'ring-1 ring-zinc-700 focus-within:ring-cine-accent/50 border border-transparent'}`}>
            {showHistoryPreview && selectedImage ? (
                <div className="w-full h-full absolute inset-0 bg-zinc-900 p-4 text-[13px] text-white font-bold leading-relaxed overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-start mb-3 pb-2 border-b border-zinc-700">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">该节点的原始指令:</span>
                        <button 
                            onClick={() => { setPrompt(selectedImage.prompt); setShowHistoryPreview(false); }}
                            className="text-[11px] text-black bg-cine-accent px-3 py-1 rounded-[2px] font-black hover:brightness-110"
                        >
                            载入此指令
                        </button>
                    </div>
                    {selectedImage.prompt}
                </div>
            ) : (
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={isContinuing ? "// 继续扩展该分镜的世界观..." : "// 描述一个电影级画面..."}
                    className="w-full h-full absolute inset-0 bg-black/70 backdrop-blur-sm border-none p-4 text-[14px] text-white font-bold focus:ring-0 resize-none leading-relaxed placeholder:text-zinc-600 custom-scrollbar transition-all duration-500 focus:bg-zinc-900/40"
                    spellCheck={false}
                />
            )}
        </div>
      </div>

      {/* Tools Row */}
      <div className="grid grid-cols-2 gap-3 relative">
          <Button 
            variant="primary" 
            size="sm" 
            onClick={onOpenScriptDeconstruct} 
            disabled={isGenerating} 
            className="text-[11px] h-12 border-dashed border-zinc-600"
          >
              <Wand2 size={16} className="mr-2 text-cine-accent" /> 
              智能脚本拆解
          </Button>
          <div className="relative group/tool">
            <Button 
                variant="primary" 
                size="sm" 
                onClick={onGenerateCamera} 
                disabled={isGenerating || !prompt.trim() || isCollageActive} 
                className={`w-full text-[11px] h-12 border-dashed border-zinc-600 ${isCollageActive ? 'opacity-40 grayscale' : ''}`}
            >
                <Video size={16} className="mr-2 text-cine-accent" /> 
                分镜镜头逻辑
            </Button>
            {isCollageActive && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-56 bg-black/95 text-cine-accent text-[10px] p-3 border border-cine-accent/50 rounded-sm opacity-0 group-hover/tool:opacity-100 transition-opacity pointer-events-none z-50 font-bold uppercase text-center shadow-2xl">
                    <Info size={12} className="inline mr-1" /> 已激活镜头组参考，文本逻辑已禁用
                </div>
            )}
          </div>
      </div>

      {/* Action Button Group */}
      <div className="flex gap-2 pt-2">
        {isGenerating && onStop ? (
            <Button variant="primary" className="flex-1 tracking-[0.25em] h-14 border-red-800 text-red-500 hover:bg-red-500/10 font-black" onClick={onStop}>
                <Square size={16} className="mr-2" fill="currentColor" /> 停止渲染 (STOP)
            </Button>
        ) : (
            <Button variant="accent" className="w-full tracking-[0.25em] h-14 shadow-[0_0_20px_rgba(255,122,0,0.4)] font-black text-[14px]" onClick={onGenerate} disabled={isGenerating || !prompt.trim()}>
                <span className="flex items-center justify-center gap-3">
                    {isGenerating ? <Zap size={18} className="animate-spin" /> : (isContinuing ? <GitMerge size={18} /> : <Layers size={18} />)}
                    {isGenerating ? '渲染中...' : (isContinuing ? '续写当前分镜' : '执行全景渲染')}
                </span>
            </Button>
        )}
      </div>
    </div>
  );
};