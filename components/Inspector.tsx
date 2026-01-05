
import React, { useState, useEffect, useRef } from 'react';
import { GeneratedImage, Asset, ImageSize } from '../types';
// Added Check to the imports from lucide-react
import { Download, Copy, Maximize2, Wand2, X, MessageSquare, Info, Video, Fingerprint, Eye, Sparkle, LayoutGrid, ChevronLeft, ChevronRight, History, Layers, Zap, Upload, Image as ImageIcon, Plus, Trash2, Monitor, Check } from 'lucide-react';
import { Button } from './Button';
import { fileToBase64 } from '../services/geminiService';
import { VisualAnnotationEditor } from './VisualAnnotationEditor';

interface InspectorProps {
  selectedImage: GeneratedImage | null;
  selectedAsset: Asset | null;
  onClose: () => void;
  onAnalyze: (prompt: string) => void;
  isAnalyzing: boolean;
  analysisResult?: string;
  onEditSlice?: (imageId: string, sliceIndex: number, prompt: string, usePro: boolean, refImage?: string, imageSize?: ImageSize) => void;
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
  
  // AI Edit States
  const [editPrompt, setEditPrompt] = useState("");
  const [useProModel, setUseProModel] = useState(false);
  const [upscaleSize, setUpscaleSize] = useState<ImageSize>(ImageSize.K1);
  const [editRefImages, setEditRefImages] = useState<string[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // Annotation View State
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
  const hasContent = activeItem || analysisResult;
  const isSliceView = selectedImage && !showFullGrid && selectedImage.slices;
  const historyForCurrentSlice = isSliceView ? (selectedImage.sliceHistory?.[currentSliceIndex] || []) : [];

  const handleEdit = () => {
    if (selectedImage && isSliceView && onEditSlice) {
      const primaryRef = annotatedRef || (editRefImages.length > 0 ? editRefImages[0] : undefined);
      
      // If we use annotation, augment prompt
      let finalPrompt = editPrompt;
      if (annotatedRef) {
          finalPrompt += " (请重点关注图中通过颜色线条标注的区域或指向，并据此进行精确的画面逻辑重构。)";
      }

      onEditSlice(selectedImage.id, currentSliceIndex, finalPrompt, useProModel, primaryRef, upscaleSize);
      setEditPrompt("");
      setEditRefImages([]);
      setAnnotatedRef(null);
    }
  };

  const handleRefImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newRefs: string[] = [];
      const files = Array.from(e.target.files) as File[];
      for (const file of files) {
          const b64 = await fileToBase64(file);
          newRefs.push(`data:${file.type};base64,${b64}`);
      }
      setEditRefImages(prev => [...prev, ...newRefs]);
    }
    e.target.value = '';
  };

  const removeRefImage = (index: number) => {
      setEditRefImages(prev => prev.filter((_, i) => i !== index));
  };

  if (!hasContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-300 space-y-4 p-10 text-center bg-cine-dark">
        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center opacity-40">
           <Eye size={20} />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] font-bold text-zinc-400">监视器就绪 (IDLE)</p>
          <p className="text-[10px] text-zinc-500 leading-relaxed font-mono">请在画布中选择一个<br/>分镜任务查看细节。</p>
        </div>
      </div>
    );
  }

  const currentSlicePrompt = selectedImage?.panelPrompts?.[currentSliceIndex];

  return (
    <div className="h-full flex flex-col bg-cine-dark border-l border-cine-border animate-in slide-in-from-right-4 duration-300 w-full relative overflow-hidden">
      {/* Visual Annotation Overlay (Full Screen) */}
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

      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cine-accent/5 blur-[100px] pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-cine-border bg-cine-black/40 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
            <span className="text-zinc-300 text-[10px] uppercase tracking-[0.25em] font-mono font-bold">
                03. 导演监视器 (INSPECTOR)
            </span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-all hover:rotate-90 duration-300">
            <X size={16} />
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group shadow-2xl z-10">
         {displayUrl ? (
             <div className="w-full h-full relative flex items-center justify-center">
                <img src={displayUrl} alt="Inspector View" className="max-w-full max-h-full object-contain" />
                
                {/* Central Hit Area for Full Screen / Annotation */}
                {!showFullGrid && (
                    <div 
                        onClick={() => setIsAnnotationMode(true)}
                        className="absolute inset-0 cursor-zoom-in flex items-center justify-center group/center"
                    >
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-4 rounded-full opacity-0 group-hover/center:opacity-100 transition-all scale-75 group-hover/center:scale-100 shadow-2xl">
                            <Maximize2 size={24} className="text-white" />
                        </div>
                    </div>
                )}
             </div>
         ) : (
             <div className="flex flex-col items-center gap-3 text-zinc-700">
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
         <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
             {selectedImage?.fullGridUrl && (
                 <button 
                    onClick={() => setShowFullGrid(!showFullGrid)}
                    className="bg-black/70 backdrop-blur-md text-white text-[9px] px-3 py-1.5 rounded-[2px] border border-zinc-700 hover:border-cine-accent flex items-center gap-2 transition-all uppercase tracking-widest font-mono font-bold"
                 >
                    <LayoutGrid size={10} />
                    {showFullGrid ? "查看当前格" : "查看总宫格"}
                 </button>
             )}
             <button 
                onClick={() => setIsAnnotationMode(true)}
                className="bg-cine-accent/90 backdrop-blur-md text-black text-[9px] px-3 py-1.5 rounded-[2px] border border-cine-accent hover:brightness-110 flex items-center gap-2 transition-all uppercase tracking-widest font-mono font-bold"
             >
                <Monitor size={10} />
                全屏标注
             </button>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cine-border relative z-10">
          <button 
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-3.5 text-[9px] font-mono uppercase tracking-[0.2em] font-bold transition-all ${activeTab === 'view' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            画面属性
          </button>
          {isSliceView && (
              <button 
                onClick={() => setActiveTab('edit')}
                className={`flex-1 py-3.5 text-[9px] font-mono uppercase tracking-[0.2em] font-bold transition-all ${activeTab === 'edit' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                AI 重绘
              </button>
          )}
          <button 
            onClick={() => setActiveTab('analyze')}
            className={`flex-1 py-3.5 text-[9px] font-mono uppercase tracking-[0.2em] font-bold transition-all ${activeTab === 'analyze' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            视觉分析
          </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-7 custom-scrollbar relative z-10">
        
        {activeTab === 'view' && activeItem && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Panel Info */}
                {isSliceView && (
                    <div className="space-y-4">
                        <div className="p-3 bg-cine-accent/5 border border-cine-accent/20 rounded-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-cine-accent/20 flex items-center justify-center text-cine-accent font-bold text-xs">
                                    {currentSliceIndex + 1}
                                </div>
                                <div>
                                    <p className="text-[10px] text-cine-accent font-bold uppercase tracking-wider">当前分镜 Panel</p>
                                    <p className="text-[8px] text-zinc-400 font-mono">INDEX: {currentSliceIndex} / {selectedImage?.slices?.length}</p>
                                </div>
                            </div>
                        </div>

                        {/* Inference Prompt Display */}
                        {currentSlicePrompt && (
                             <div className="space-y-2">
                                <label className="text-zinc-500 text-[8px] uppercase font-bold tracking-widest font-mono">镜头推理逻辑 (INFERENCE PROMPT)</label>
                                <div className="bg-black/30 border border-zinc-800 rounded-sm p-4 text-[11px] text-zinc-300 font-mono leading-relaxed italic">
                                    {currentSlicePrompt}
                                </div>
                             </div>
                        )}
                    </div>
                )}

                {/* Metadata */}
                <div className="space-y-4">
                    <h3 className="text-zinc-300 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                        <Fingerprint size={12} className="text-zinc-500" />
                        元数据 (METADATA)
                    </h3>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-[10px] font-mono">
                        <div className="flex flex-col gap-1">
                            <span className="uppercase text-zinc-500 text-[8px] tracking-widest">类型</span>
                            <span className="text-zinc-200 font-bold">
                                {selectedImage ? (selectedImage.nodeType === 'lens_lab' ? '实验室分镜' : '分镜节点') : '原始资产'}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="uppercase text-zinc-500 text-[8px] tracking-widest">比例</span>
                            <span className="text-zinc-200 font-bold">
                                {selectedImage ? selectedImage.aspectRatio : 'ORIGINAL'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-2">
                     <a href={displayUrl || '#'} download={`Cine-${activeItem.id}.png`} className="block">
                         <Button variant="primary" size="md" className="w-full gap-3 py-6 h-12 shadow-xl border-zinc-800 bg-zinc-900/50">
                             <Download size={14} /> 下载无损原图
                         </Button>
                     </a>
                </div>
            </div>
        )}

        {activeTab === 'edit' && isSliceView && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 h-full flex flex-col pb-10">
                 {/* Model Selector */}
                 <div className="space-y-3">
                    <label className="text-zinc-300 text-[9px] font-bold uppercase tracking-[0.2em]">渲染引擎 (MODEL)</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => setUseProModel(false)}
                            className={`flex flex-col items-center justify-center gap-1.5 p-3 border rounded-sm transition-all ${!useProModel ? 'border-cine-accent bg-cine-accent/5' : 'border-zinc-800 bg-black/40 hover:border-zinc-700'}`}
                        >
                            <span className={`text-[10px] font-bold font-mono tracking-widest ${!useProModel ? 'text-cine-accent' : 'text-zinc-400'}`}>NANOBANANA</span>
                            <span className="text-[7px] text-zinc-500 uppercase font-mono tracking-tighter">Fast Edit</span>
                        </button>
                        <button 
                            onClick={() => setUseProModel(true)}
                            className={`flex flex-col items-center justify-center gap-1.5 p-3 border rounded-sm transition-all ${useProModel ? 'border-cine-accent bg-cine-accent/5 shadow-[0_0_15px_rgba(255,122,0,0.1)]' : 'border-zinc-800 bg-black/40 hover:border-zinc-700'}`}
                        >
                            <span className={`text-[10px] font-bold font-mono tracking-widest ${useProModel ? 'text-cine-accent' : 'text-zinc-400'}`}>PRO ENGINE</span>
                            <span className="text-[7px] text-zinc-500 uppercase font-mono tracking-tighter">High Fidelity</span>
                        </button>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-zinc-300 text-[9px] font-bold uppercase tracking-[0.2em]">重绘指令</label>
                    <textarea 
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        className="w-full bg-black/40 border border-zinc-800/80 rounded-sm p-4 text-[11px] text-zinc-200 focus:border-cine-accent focus:ring-0 resize-none font-mono min-h-[80px] leading-relaxed transition-all placeholder:text-zinc-700"
                        placeholder="例如：给角色戴上墨镜，或者改变背景灯光..."
                    />
                 </div>

                 {/* Annotation Status */}
                 {annotatedRef && (
                     <div className="p-3 bg-cine-accent/10 border border-cine-accent/30 rounded-sm flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <Check size={14} className="text-cine-accent" />
                             <span className="text-[9px] text-cine-accent font-bold uppercase font-mono tracking-widest">视觉标注已载入</span>
                         </div>
                         <button onClick={() => setAnnotatedRef(null)} className="text-cine-accent hover:text-white"><X size={12} /></button>
                     </div>
                 )}

                 {/* Reference Images */}
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-zinc-300 text-[9px] font-bold uppercase tracking-[0.2em]">参考图库 (REFERENCES)</label>
                        <button onClick={() => editRefInputRef.current?.click()} className="text-[8px] text-cine-accent font-bold font-mono border border-cine-accent/30 px-2 py-0.5 rounded-full hover:bg-cine-accent/10 transition-all flex items-center gap-1">
                            <Plus size={10} /> ADD
                        </button>
                        <input type="file" ref={editRefInputRef} className="hidden" multiple accept="image/*" onChange={handleRefImageUpload} />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {annotatedRef && (
                            <div className="relative aspect-square bg-zinc-900 border border-cine-accent rounded-sm overflow-hidden group">
                                <img src={annotatedRef} className="w-full h-full object-cover" />
                                <div className="absolute top-1 left-1 bg-cine-accent text-black text-[7px] font-bold px-1 rounded-[1px]">标注</div>
                            </div>
                        )}
                        {editRefImages.map((url, idx) => (
                            <div key={idx} className="relative aspect-square bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden group">
                                <img src={url} className="w-full h-full object-cover opacity-60" />
                                <div className="absolute top-1 left-1 bg-zinc-700 text-white text-[7px] font-bold px-1 rounded-[1px]">REF {idx + 1}</div>
                                <button onClick={() => removeRefImage(idx)} className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X size={8} />
                                </button>
                            </div>
                        ))}
                    </div>
                 </div>

                 {/* High Fidelity Upscale */}
                 {useProModel && (
                    <div className="space-y-3 pt-2">
                        <label className="text-zinc-300 text-[9px] font-bold uppercase tracking-[0.2em]">高清放大 (UPSCALE)</label>
                        <div className="flex gap-2">
                            {[ImageSize.K1, ImageSize.K2, ImageSize.K4].map((sz) => (
                                <button 
                                    key={sz}
                                    onClick={() => setUpscaleSize(sz)}
                                    className={`flex-1 h-9 border rounded-sm text-[9px] font-mono font-bold transition-all ${upscaleSize === sz ? 'border-cine-accent text-cine-accent bg-cine-accent/5' : 'border-zinc-800 text-zinc-400 bg-black/40 hover:border-zinc-700'}`}
                                >
                                    {sz} 导出
                                </button>
                            ))}
                        </div>
                    </div>
                 )}

                 <div className="space-y-4 pt-4">
                    <Button 
                        variant="accent" 
                        size="md" 
                        className="w-full gap-2.5 h-12 shadow-[0_0_20px_rgba(255,122,0,0.2)]"
                        onClick={handleEdit}
                        disabled={!editPrompt.trim() && !annotatedRef}
                    >
                        <Wand2 size={14} />
                        执行 AI 精准重绘
                    </Button>
                 </div>

                 {/* Version history */}
                 {historyForCurrentSlice.length > 0 && (
                     <div className="pt-6 border-t border-zinc-800/50">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-zinc-300 text-[9px] font-bold uppercase tracking-[0.2em]">往期版本</span>
                            <span className="text-zinc-500 text-[8px] font-mono">{historyForCurrentSlice.length} VERSIONS</span>
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
                <div className="space-y-3">
                    <label className="text-zinc-300 text-[10px] font-bold uppercase tracking-[0.2em]">分析指令</label>
                    <textarea 
                        value={analysisPrompt}
                        onChange={(e) => setAnalysisPrompt(e.target.value)}
                        className="w-full bg-black/40 border border-zinc-800/80 rounded-sm p-4 text-[11px] text-zinc-200 focus:border-cine-accent focus:ring-0 resize-none font-mono min-h-[80px] leading-relaxed transition-all"
                    />
                    <Button 
                        variant="accent" 
                        size="md" 
                        className="w-full gap-2.5 h-11"
                        onClick={() => onAnalyze(analysisPrompt)}
                        disabled={isAnalyzing}
                    >
                         {isAnalyzing ? <Wand2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                         开始视觉分析
                    </Button>
                </div>

                <div className="flex-1 min-h-0 flex flex-col space-y-3 pt-2 border-t border-zinc-800/50">
                    <div className="flex-1 bg-black/50 border border-zinc-900/80 rounded-sm p-5 overflow-y-auto custom-scrollbar shadow-inner relative">
                        {analysisResult ? (
                            <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-mono tracking-tight">{analysisResult}</p>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4 opacity-30">
                                <Sparkle size={24} />
                                <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-center">等待 AI 分析反馈</span>
                            </div>
                        )}
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
                      <h3 className="text-white font-mono text-xs font-bold tracking-widest uppercase">版本历史管理</h3>
                  </div>
                  <button onClick={() => setShowHistoryModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                      <X size={20} />
                  </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8">
                  <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                          <label className="text-cine-accent text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
                              当前活跃版本
                          </label>
                          <div className="aspect-video bg-zinc-900 border-2 border-cine-accent rounded-sm overflow-hidden shadow-lg">
                              <img src={selectedImage.slices![currentSliceIndex]} className="w-full h-full object-cover" />
                          </div>
                      </div>

                      <div className="space-y-4">
                          <label className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
                              往期记录 ({historyForCurrentSlice.length})
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
                                          <div className="px-4 py-2 bg-cine-accent text-black font-mono text-[10px] font-bold tracking-widest rounded-sm">
                                              恢复此版本
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
