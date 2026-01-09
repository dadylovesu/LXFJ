import React, { useState, useEffect, useRef } from 'react';
import { GeneratedImage, Asset, ImageSize } from '../types';
import { Download, Copy, Maximize2, Wand2, X, MessageSquare, Info, Video, Fingerprint, Eye, Sparkle, LayoutGrid, ChevronLeft, ChevronRight, History, Layers, Zap, Upload, Image as ImageIcon, Plus, Trash2, Monitor, Check, RotateCcw } from 'lucide-react';
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
  
  // AI Edit States
  const [editPrompt, setEditPrompt] = useState("");
  const [useProModel, setUseProModel] = useState(false);
  const [upscaleSize, setUpscaleSize] = useState<ImageSize>(ImageSize.K1);
  const [editRefImages, setEditRefImages] = useState<string[]>([]);
  
  // History States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [previewHistoryUrl, setPreviewHistoryUrl] = useState<string | null>(null);
  
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
  const hasContent = !!activeItem;
  const isSliceView = selectedImage && !showFullGrid && selectedImage.slices;
  const historyForCurrentSlice = isSliceView ? (selectedImage.sliceHistory?.[currentSliceIndex] || []) : [];

  const handleEdit = () => {
    if (selectedImage && isSliceView && onEditSlice) {
      const primaryRef = annotatedRef || (editRefImages.length > 0 ? editRefImages[0] : undefined);
      
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

  // 点击宫格切换到单图
  const handleGridSliceClick = (index: number) => {
    setCurrentSliceIndex(index);
    setShowFullGrid(false);
  };

  if (!hasContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-white space-y-6 p-10 text-center bg-cine-dark">
        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center shadow-xl">
           <Eye size={28} className="text-zinc-500" />
        </div>
        <div className="space-y-3">
          <p className="font-bold text-[12px] uppercase tracking-[0.3em] text-white">监视器就绪 (IDLE)</p>
          <p className="text-[12px] text-zinc-300 leading-relaxed font-bold">请在画布中选择一个<br/>分镜任务查看细节。</p>
        </div>
      </div>
    );
  }

  const currentSlicePrompt = selectedImage?.panelPrompts?.[currentSliceIndex];

  return (
    <div className="h-full flex flex-col bg-cine-dark border-l border-zinc-800 animate-in slide-in-from-right-4 duration-300 w-full relative overflow-hidden">
      {/* 历史版本回溯弹窗 */}
      {showHistoryModal && selectedImage && isSliceView && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-xl flex flex-col p-10 animate-in fade-in duration-300">
           <div className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-6">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-cine-accent text-black rounded-sm flex items-center justify-center">
                    <History size={24} />
                 </div>
                 <div>
                    <h2 className="text-white font-black text-lg uppercase tracking-widest">分镜历史时光机 (VERSION HISTORY)</h2>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">节点 ID: {selectedImage.id.slice(0,8)} / 分镜索引: {currentSliceIndex + 1}</p>
                 </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-zinc-500 hover:text-white transition-all hover:rotate-90"><X size={32} /></button>
           </div>

           <div className="flex-1 overflow-x-auto flex gap-8 items-start pb-10 custom-scrollbar">
              {/* 当前版本 */}
              <div className="flex-shrink-0 w-[400px] space-y-4">
                 <div className="aspect-video bg-zinc-900 rounded-sm overflow-hidden border-2 border-cine-accent ring-4 ring-cine-accent/20">
                    <img src={selectedImage.slices![currentSliceIndex]} className="w-full h-full object-cover" />
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="bg-cine-accent text-black px-3 py-1 text-[10px] font-black uppercase rounded-[2px]">当前活跃版本 (ACTIVE)</span>
                 </div>
              </div>

              {/* 历史记录 */}
              {[...(selectedImage.sliceHistory?.[currentSliceIndex] || [])].reverse().map((url, idx, arr) => (
                 <div key={idx} className="flex-shrink-0 w-[400px] space-y-4 group">
                    <div className="aspect-video bg-zinc-900 rounded-sm overflow-hidden border-2 border-zinc-800 group-hover:border-zinc-500 transition-all relative">
                       <img src={url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                       <button 
                         onClick={() => setPreviewHistoryUrl(url)}
                         className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                          <Maximize2 className="text-white" size={32} />
                       </button>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-zinc-400 text-[10px] font-black uppercase">历史版本 V{arr.length - idx}</span>
                       <Button 
                          variant="primary" 
                          size="sm" 
                          className="gap-2 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                          onClick={() => {
                            if (onRevertSlice) onRevertSlice(selectedImage.id, currentSliceIndex, arr.length - 1 - idx);
                            setShowHistoryModal(false);
                          }}
                        >
                          <RotateCcw size={12} /> 恢复此版本
                       </Button>
                    </div>
                 </div>
              ))}
           </div>

           {/* 全屏大图预览覆盖层 */}
           {previewHistoryUrl && (
             <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-20 animate-in zoom-in-95 duration-200" onClick={() => setPreviewHistoryUrl(null)}>
                <img src={previewHistoryUrl} className="max-w-full max-h-full object-contain shadow-[0_0_100px_rgba(0,0,0,1)]" />
                <button className="absolute top-10 right-10 text-white"><X size={48} /></button>
             </div>
           )}
        </div>
      )}

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
      <div className="absolute top-0 right-0 w-80 h-80 bg-cine-accent/5 blur-[100px] pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-black/60 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
            <span className="text-white text-[12px] uppercase tracking-[0.2em] font-black">
                03. 导演监视器 (INSPECTOR)
            </span>
        </div>
        <button onClick={onClose} className="text-white hover:text-cine-accent transition-all hover:rotate-90 duration-300">
            <X size={20} />
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group shadow-2xl z-10 border-b border-zinc-800">
         {displayUrl ? (
             <div className="w-full h-full relative flex items-center justify-center">
                {/* 核心修改：如果是宫格图模式，渲染可点击的网格 */}
                {showFullGrid && selectedImage?.slices ? (
                    <div 
                      className="grid w-full h-full gap-0.5 bg-zinc-800"
                      style={{ gridTemplateColumns: `repeat(${selectedImage.gridCols || 2}, 1fr)` }}
                    >
                        {selectedImage.slices.map((sliceUrl, idx) => (
                            <div 
                                key={idx} 
                                className="relative group/slice cursor-pointer overflow-hidden"
                                onClick={() => handleGridSliceClick(idx)}
                            >
                                <img src={sliceUrl} className="w-full h-full object-cover group-hover/slice:scale-105 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-black/0 group-hover/slice:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover/slice:opacity-100">
                                    <span className="text-white font-black text-[10px] uppercase tracking-widest bg-black/60 px-2 py-1 border border-white/20">查看分镜 {idx + 1}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <img src={displayUrl} alt="Inspector View" className="max-w-full max-h-full object-contain" />
                        {!showFullGrid && (
                            <div 
                                onClick={() => setIsAnnotationMode(true)}
                                className="absolute inset-0 cursor-zoom-in flex items-center justify-center group/center"
                            >
                                <div className="bg-black/60 backdrop-blur-md border border-white/30 p-4 rounded-full opacity-0 group-hover/center:opacity-100 transition-all scale-90 group-hover/center:scale-100 shadow-2xl">
                                    <Maximize2 size={32} className="text-white" />
                                </div>
                            </div>
                        )}
                    </>
                )}
             </div>
         ) : (
             <div className="flex flex-col items-center gap-4 text-zinc-600">
                 <Video size={48} className="opacity-40" />
                 <span className="text-[11px] font-black uppercase tracking-[0.4em]">NO SIGNAL</span>
             </div>
         )}
         
         {/* Slice Navigation */}
         {selectedImage?.slices && !showFullGrid && (
             <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                 <button 
                    disabled={currentSliceIndex === 0}
                    onClick={() => setCurrentSliceIndex(prev => Math.max(0, prev - 1))}
                    className="p-2 bg-black/80 rounded-full text-white pointer-events-auto disabled:opacity-30 hover:bg-cine-accent hover:text-black transition-all shadow-xl"
                 >
                     <ChevronLeft size={24} />
                 </button>
                 <button 
                    disabled={currentSliceIndex === (selectedImage.slices.length - 1)}
                    onClick={() => setCurrentSliceIndex(prev => Math.min(selectedImage.slices!.length - 1, prev + 1))}
                    className="p-2 bg-black/80 rounded-full text-white pointer-events-auto disabled:opacity-30 hover:bg-cine-accent hover:text-black transition-all shadow-xl"
                 >
                     <ChevronRight size={24} />
                 </button>
             </div>
         )}

         {/* Grid Toggle Overlay */}
         <div className="absolute bottom-5 right-5 flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-3 group-hover:translate-y-0">
             {selectedImage?.fullGridUrl && (
                 <button 
                    onClick={() => setShowFullGrid(!showFullGrid)}
                    className="bg-black/80 backdrop-blur-md text-white text-[11px] px-4 py-2 rounded-[2px] border border-zinc-600 hover:border-cine-accent flex items-center gap-2 transition-all font-black uppercase tracking-widest shadow-2xl"
                 >
                    <LayoutGrid size={14} />
                    {showFullGrid ? "切换单图视图" : "查看宫格交互视图"}
                 </button>
             )}
             <button 
                onClick={() => setIsAnnotationMode(true)}
                className="bg-cine-accent text-black text-[11px] px-4 py-2 rounded-[2px] border border-cine-accent hover:brightness-110 flex items-center gap-2 transition-all font-black uppercase tracking-widest shadow-2xl"
             >
                <Monitor size={14} />
                视觉标注
             </button>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 relative z-10 bg-black/20">
          <button 
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'view' ? 'text-cine-accent bg-cine-accent/10' : 'text-zinc-300 hover:text-white'}`}
          >
            画面属性
          </button>
          {isSliceView && (
              <button 
                onClick={() => setActiveTab('edit')}
                className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'edit' ? 'text-cine-accent bg-cine-accent/10' : 'text-zinc-300 hover:text-white'}`}
              >
                AI 重绘
              </button>
          )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-7 space-y-8 custom-scrollbar relative z-10">
        
        {activeTab === 'view' && activeItem && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Panel Info */}
                {isSliceView && (
                    <div className="space-y-4">
                        <div className="p-4 bg-cine-accent/10 border border-cine-accent/30 rounded-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-cine-accent text-black font-black text-sm flex items-center justify-center">
                                    {currentSliceIndex + 1}
                                </div>
                                <div>
                                    <p className="text-[12px] text-cine-accent font-black uppercase tracking-wider">当前分镜 Panel</p>
                                    <p className="text-[10px] text-zinc-100 font-bold">INDEX: {currentSliceIndex + 1} / {selectedImage?.slices?.length}</p>
                                </div>
                            </div>

                            {/* 历史版本按钮 */}
                            {historyForCurrentSlice.length > 0 && (
                                <button 
                                  onClick={() => setShowHistoryModal(true)}
                                  className="flex items-center gap-2 bg-zinc-800 text-white px-3 py-1.5 rounded-[2px] border border-zinc-700 hover:border-cine-accent transition-all group"
                                >
                                   <History size={14} className="text-cine-accent group-hover:rotate-[-45deg] transition-transform" />
                                   <span className="text-[10px] font-black uppercase">历史 {historyForCurrentSlice.length}</span>
                                </button>
                            )}
                        </div>

                        {/* Inference Prompt Display */}
                        {currentSlicePrompt && (
                             <div className="space-y-3">
                                <label className="text-white text-[10px] uppercase font-black tracking-widest flex items-center gap-2">
                                    <Sparkle size={12} className="text-cine-accent" />
                                    镜头推理逻辑 (PROMPT)
                                </label>
                                <div className="bg-zinc-900 border border-zinc-700 rounded-sm p-5 text-[13px] text-white font-bold leading-relaxed italic shadow-inner">
                                    {currentSlicePrompt}
                                </div>
                             </div>
                        )}
                    </div>
                )}

                {/* Metadata */}
                <div className="space-y-4">
                    <h3 className="text-white text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border-l-4 border-cine-accent pl-3">
                        元数据 (METADATA)
                    </h3>
                    <div className="grid grid-cols-2 gap-6 text-[11px] font-bold">
                        <div className="flex flex-col gap-2 p-3 bg-zinc-900/60 border border-zinc-800 rounded-sm">
                            <span className="uppercase text-zinc-400 text-[10px] tracking-widest">任务类型</span>
                            <span className="text-white">
                                {selectedImage ? (selectedImage.nodeType === 'lens_lab' ? '一致性实验室' : '分镜重组渲染') : '原始参考资产'}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2 p-3 bg-zinc-900/60 border border-zinc-800 rounded-sm">
                            <span className="uppercase text-zinc-400 text-[10px] tracking-widest">画面比例</span>
                            <span className="text-white">
                                {selectedImage ? selectedImage.aspectRatio : 'ORIGINAL'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4">
                     <a href={displayUrl || '#'} download={`Cine-Export-${activeItem.id.slice(0,6)}.png`} className="block">
                         <Button variant="primary" size="lg" className="w-full gap-3 py-7 shadow-2xl border-zinc-600 bg-zinc-800/80">
                             <Download size={18} /> 下载 4K 无损原图
                         </Button>
                     </a>
                </div>
            </div>
        )}

        {activeTab === 'edit' && isSliceView && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 h-full flex flex-col pb-10">
                 {/* Model Selector */}
                 <div className="space-y-4">
                    <label className="text-white text-[11px] font-black uppercase tracking-[0.2em]">重绘引擎 (MODEL)</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setUseProModel(false)}
                            className={`flex flex-col items-center justify-center gap-2 p-4 border-2 rounded-sm transition-all ${!useProModel ? 'border-cine-accent bg-cine-accent/10' : 'border-zinc-800 bg-black/40 hover:border-zinc-700'}`}
                        >
                            <span className={`text-[12px] font-black tracking-widest ${!useProModel ? 'text-cine-accent' : 'text-zinc-400'}`}>NANOBANANA</span>
                            <span className="text-[10px] text-zinc-100 uppercase font-bold tracking-tighter">Fast Edit</span>
                        </button>
                        <button 
                            onClick={() => setUseProModel(true)}
                            className={`flex flex-col items-center justify-center gap-2 p-4 border-2 rounded-sm transition-all ${useProModel ? 'border-cine-accent bg-cine-accent/10 shadow-[0_0_15px_rgba(255,122,0,0.2)]' : 'border-zinc-800 bg-black/40 hover:border-zinc-700'}`}
                        >
                            <span className={`text-[12px] font-black tracking-widest ${useProModel ? 'text-cine-accent' : 'text-zinc-400'}`}>PRO ENGINE</span>
                            <span className="text-[10px] text-zinc-100 uppercase font-bold tracking-tighter">High Fidelity</span>
                        </button>
                    </div>
                 </div>

                 {/* 修改：恢复 Pro 模式下的分辨率选择 */}
                 {useProModel && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-white text-[11px] font-black uppercase tracking-[0.2em]">输出分辨率 (RESOLUTION)</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[ImageSize.K1, ImageSize.K2, ImageSize.K4].map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setUpscaleSize(size)}
                                    className={`h-11 border rounded-[1px] text-[11px] font-black transition-all duration-300 flex items-center justify-center ${
                                        upscaleSize === size 
                                        ? 'border-cine-accent text-cine-accent bg-cine-accent/10' 
                                        : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 bg-black/30'
                                    }`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>
                 )}

                 <div className="space-y-4">
                    <label className="text-white text-[11px] font-black uppercase tracking-[0.2em]">局部重绘指令</label>
                    <textarea 
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        className="w-full bg-black/50 border border-zinc-700 rounded-sm p-5 text-[14px] text-white font-bold focus:border-cine-accent focus:ring-0 resize-none min-h-[120px] leading-relaxed transition-all placeholder:text-zinc-600"
                        placeholder="例如：将背景改为落日黄昏，给角色穿上深色风衣..."
                    />
                 </div>

                 {annotatedRef && (
                     <div className="p-4 bg-cine-accent/10 border-2 border-cine-accent/50 rounded-sm flex items-center justify-between shadow-lg">
                         <div className="flex items-center gap-3">
                             <Check size={20} className="text-cine-accent" />
                             <span className="text-[11px] text-white font-black uppercase tracking-widest">视觉引导标注已载入</span>
                         </div>
                         <button onClick={() => setAnnotatedRef(null)} className="text-cine-accent hover:text-white p-1 bg-black/40 rounded"><X size={14} /></button>
                     </div>
                 )}

                 {/* Reference Images */}
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-white text-[11px] font-black uppercase tracking-[0.2em]">附加参考 (REFERENCES)</label>
                        <button onClick={() => editRefInputRef.current?.click()} className="text-[10px] text-black font-black bg-cine-accent px-3 py-1.5 rounded-sm hover:brightness-110 transition-all flex items-center gap-2 shadow-lg">
                            <Plus size={14} /> 上传图源
                        </button>
                        <input type="file" ref={editRefInputRef} className="hidden" multiple accept="image/*" onChange={handleRefImageUpload} />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                        {annotatedRef && (
                            <div className="relative aspect-square bg-zinc-900 border-2 border-cine-accent rounded-sm overflow-hidden group shadow-xl">
                                <img src={annotatedRef} className="w-full h-full object-cover" />
                                <div className="absolute top-1 left-1 bg-cine-accent text-black text-[9px] font-black px-1.5 rounded-[1px]">标注</div>
                            </div>
                        )}
                        {editRefImages.map((url, idx) => (
                            <div key={idx} className="relative aspect-square bg-zinc-900 border-2 border-zinc-700 rounded-sm overflow-hidden group">
                                <img src={url} className="w-full h-full object-cover opacity-70" />
                                <div className="absolute top-1 left-1 bg-zinc-100 text-black text-[9px] font-black px-1.5 rounded-[1px]">REF {idx + 1}</div>
                                <button onClick={() => removeRefImage(idx)} className="absolute top-1 right-1 p-1 bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                 </div>

                 <div className="space-y-5 pt-4">
                    <Button 
                        variant="accent" 
                        size="lg" 
                        className="w-full gap-3 py-7 shadow-[0_0_25px_rgba(255,122,0,0.3)] font-black text-[15px]"
                        onClick={handleEdit}
                        disabled={!editPrompt.trim() && !annotatedRef}
                    >
                        <Wand2 size={20} />
                        开始 AI 局部重绘
                    </Button>
                 </div>
             </div>
        )}

      </div>
    </div>
  );
};