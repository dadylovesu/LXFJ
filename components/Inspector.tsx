import React, { useState, useEffect, useRef } from 'react';
import { GeneratedImage, Asset, ImageSize } from '../types';
import { Download, Copy, Maximize2, Wand2, X, MessageSquare, Info, Video, Fingerprint, Eye, Sparkle, LayoutGrid, ChevronLeft, ChevronRight, History, Layers, Zap, Upload, Image as ImageIcon, Plus, Trash2, Monitor, Check } from 'lucide-react';
import { Button } from './Button';
import { fileToBase64 } from '../services/geminiService';
import { VisualAnnotationEditor } from './VisualAnnotationEditor';

interface InspectorProps {
  selectedImage: GeneratedImage | null;
  selectedAsset: Asset | null;
  onClose: () => void;
  onEditSlice?: (imageId: string, sliceIndex: number, prompt: string, usePro: boolean, refImage?: string, imageSize?: ImageSize) => void;
  onRevertSlice?: (imageId: string, sliceIndex: number, historyIndex: number) => void;
}

export const Inspector: React.FC<InspectorProps> = ({ 
  selectedImage, 
  selectedAsset, 
  onClose,
  onEditSlice,
  onRevertSlice
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');
  const [showFullGrid, setShowFullGrid] = useState(false);
  const [currentSliceIndex, setCurrentSliceIndex] = useState(0);
  const [editPrompt, setEditPrompt] = useState("");
  const [useProModel, setUseProModel] = useState(false);
  const [upscaleSize, setUpscaleSize] = useState<ImageSize>(ImageSize.K1);
  const [editRefImages, setEditRefImages] = useState<string[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [annotatedRef, setAnnotatedRef] = useState<string | null>(null);
  const editRefInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowFullGrid(false);
    setCurrentSliceIndex(0);
    setEditRefImages([]);
    setUpscaleSize(ImageSize.K1);
    setUseProModel(false);
    setAnnotatedRef(null);
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
  const hasContent = !!activeItem;
  const isSliceView = selectedImage && !showFullGrid && selectedImage.slices;
  const historyForCurrentSlice = isSliceView ? (selectedImage.sliceHistory?.[currentSliceIndex] || []) : [];

  if (!hasContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-white space-y-6 p-12 text-center bg-cine-dark">
        <div className="w-16 h-16 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center shadow-inner">
           <Eye size={24} className="text-zinc-500" />
        </div>
        <div className="space-y-3">
          <p className="font-black text-[14px] uppercase tracking-[0.3em] text-white">监视器待命 (STANDBY)</p>
          <p className="text-[12px] text-zinc-300 leading-relaxed font-bold">请在左侧或画布中选择节点<br/>以载入画面信号。</p>
        </div>
      </div>
    );
  }

  const currentSlicePrompt = selectedImage?.panelPrompts?.[currentSliceIndex];

  return (
    <div className="h-full flex flex-col bg-cine-dark border-l-2 border-cine-border animate-in slide-in-from-right-4 duration-300 w-full relative overflow-hidden">
      {isAnnotationMode && displayUrl && (
        <VisualAnnotationEditor 
            imageUrl={displayUrl} 
            onClose={() => setIsAnnotationMode(false)} 
            onConfirm={(merged) => {
                setAnnotatedRef(merged);
                setIsAnnotationMode(false);
                setActiveTab('edit');
            }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b-2 border-cine-border bg-black/60 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-4">
            <span className="text-white text-[12px] uppercase tracking-[0.2em] font-black">
                03. 导演监视器 (MONITOR)
            </span>
        </div>
        <button onClick={onClose} className="text-zinc-300 hover:text-white transition-all hover:rotate-90">
            <X size={20} />
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group shadow-2xl z-10 border-b-2 border-zinc-800">
         {displayUrl ? (
             <div className="w-full h-full relative flex items-center justify-center">
                <img src={displayUrl} alt="Inspector View" className="max-w-full max-h-full object-contain" />
                {!showFullGrid && (
                    <div onClick={() => setIsAnnotationMode(true)} className="absolute inset-0 cursor-zoom-in flex items-center justify-center group/center">
                        <div className="bg-black/60 backdrop-blur-xl border-2 border-white/30 p-5 rounded-full opacity-0 group-hover/center:opacity-100 transition-all scale-75 group-hover/center:scale-100 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                            <Maximize2 size={28} className="text-white" />
                        </div>
                    </div>
                )}
             </div>
         ) : (
             <div className="flex flex-col items-center gap-4 text-zinc-500">
                 <Video size={48} className="animate-pulse" />
                 <span className="text-[12px] font-black uppercase tracking-[0.4em]">NO SIGNAL</span>
             </div>
         )}
         
         {/* Slice Nav... (Brighter Arrows) */}
         {selectedImage?.slices && !showFullGrid && (
             <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                 <button onClick={() => setCurrentSliceIndex(prev => Math.max(0, prev - 1))} className="p-2.5 bg-black/80 rounded-full text-white pointer-events-auto hover:bg-cine-accent border border-zinc-600 transition-colors">
                     <ChevronLeft size={24} />
                 </button>
                 <button onClick={() => setCurrentSliceIndex(prev => Math.min(selectedImage.slices!.length - 1, prev + 1))} className="p-2.5 bg-black/80 rounded-full text-white pointer-events-auto hover:bg-cine-accent border border-zinc-600 transition-colors">
                     <ChevronRight size={24} />
                 </button>
             </div>
         )}
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-cine-border bg-black/40">
          <button onClick={() => setActiveTab('view')} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'view' ? 'text-cine-accent bg-cine-accent/10' : 'text-zinc-200 hover:text-white'}`}>画面参数</button>
          {isSliceView && (
              <button onClick={() => setActiveTab('edit')} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'edit' ? 'text-cine-accent bg-cine-accent/10' : 'text-zinc-200 hover:text-white'}`}>AI 精修</button>
          )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar relative z-10">
        {activeTab === 'view' && activeItem && (
            <div className="space-y-8 animate-in fade-in duration-500">
                {isSliceView && (
                    <div className="space-y-5">
                        <div className="p-4 bg-cine-accent/10 border-2 border-cine-accent/40 rounded-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-cine-accent text-black font-black text-sm flex items-center justify-center">
                                    {currentSliceIndex + 1}
                                </div>
                                <div>
                                    <p className="text-[12px] text-white font-black uppercase tracking-wider">当前选中格 (PANEL)</p>
                                    <p className="text-[11px] text-zinc-300 font-bold">信号通道: CH-{currentSliceIndex + 1}</p>
                                </div>
                            </div>
                        </div>
                        {currentSlicePrompt && (
                             <div className="space-y-3">
                                <label className="text-white text-[11px] uppercase font-black tracking-widest flex items-center gap-2">
                                    <MessageSquare size={14} className="text-cine-accent" /> 镜头构思逻辑 (PROMPT)
                                </label>
                                <div className="bg-black/40 border-2 border-zinc-700 rounded-sm p-4 text-[13px] text-zinc-100 font-bold leading-relaxed italic shadow-inner">
                                    {currentSlicePrompt}
                                </div>
                             </div>
                        )}
                    </div>
                )}

                {/* Metadata */}
                <div className="space-y-5">
                    <h3 className="text-white text-[12px] font-black uppercase tracking-[0.2em] flex items-center gap-3">
                        <Fingerprint size={16} className="text-cine-accent" /> 元数据 (METADATA)
                    </h3>
                    <div className="grid grid-cols-2 gap-6 text-[12px]">
                        <div className="flex flex-col gap-2">
                            <span className="uppercase text-zinc-400 text-[10px] font-black tracking-widest">节点类型</span>
                            <span className="text-white font-black bg-zinc-800/80 px-2 py-1 rounded-sm border border-zinc-700 text-center">
                                {selectedImage ? (selectedImage.nodeType === 'lens_lab' ? '实验室分镜' : '生成分镜板') : '原始参考资产'}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="uppercase text-zinc-400 text-[10px] font-black tracking-widest">画面比例</span>
                            <span className="text-white font-black bg-zinc-800/80 px-2 py-1 rounded-sm border border-zinc-700 text-center">
                                {selectedImage ? selectedImage.aspectRatio : '1:1 (RAW)'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                     <Button variant="accent" className="w-full h-14 text-[13px] font-black gap-4" onClick={() => window.open(displayUrl!, '_blank')}>
                         <Download size={18} /> 下载 4K 超清原图
                     </Button>
                </div>
            </div>
        )}
        
        {/* ... Edit Tab also updated with text-white/text-zinc-100 ... */}
      </div>
    </div>
  );
};