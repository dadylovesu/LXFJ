import React, { useState, useRef, useLayoutEffect, useCallback, memo, useMemo } from 'react';
import { GeneratedImage, Asset } from '../types';
import { Trash2, Archive, LayoutGrid, List, MonitorPlay, Workflow, Type, Images, Video, X, Maximize2, ArrowLeft, History, Camera } from 'lucide-react';
import { Button } from './Button';

interface CanvasProps {
  images: GeneratedImage[];
  assets: Asset[]; 
  onSelect: (image: GeneratedImage) => void;
  selectedId: string | undefined;
  onDelete: (id: string) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onDownloadAll: () => void;
  onDeselectAll?: () => void;
}

type ViewMode = 'grid' | 'table' | 'workflow';

interface NodeProps {
    image: GeneratedImage;
    selected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onMouseDown: (e: React.MouseEvent) => void;
    allAssets?: Asset[]; 
    onHeightChange?: (id: string, height: number) => void;
    isDraggingThis?: boolean;
}

const Node = memo(({ image, selected, onSelect, onDelete, onMouseDown, allAssets, onHeightChange, isDraggingThis }: NodeProps) => {
    const [expandedSlice, setExpandedSlice] = useState<string | null>(null);
    const nodeRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!nodeRef.current || !onHeightChange) return;
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                onHeightChange(image.id, entry.contentRect.height);
            }
        });
        observer.observe(nodeRef.current);
        return () => observer.disconnect();
    }, [image.id, onHeightChange]);

    const getHeaderColor = () => {
        switch (image.nodeType) {
            case 'prompt': return 'bg-blue-800 border-blue-600';
            case 'asset_group': return 'bg-purple-800 border-purple-600';
            case 'render': return 'bg-cine-panel border-cine-accent';
            case 'lens_lab': return 'bg-cine-panel border-cine-accent';
            case 'slice': return 'bg-zinc-800 border-zinc-600';
            default: return 'bg-zinc-800';
        }
    };

    const getIcon = () => {
        switch (image.nodeType) {
            case 'prompt': return <Type size={14} />;
            case 'asset_group': return <Images size={14} />;
            case 'render': return <MonitorPlay size={14} />;
            case 'lens_lab': return <Camera size={14} />;
            default: return null;
        }
    };

    const getLabel = () => {
        switch (image.nodeType) {
            case 'prompt': return '文本输入 (PROMPT)';
            case 'asset_group': return '参考素材组';
            case 'render': return '全景分镜节点';
            case 'lens_lab': return '镜头实验室序列';
            case 'slice': return '单分镜格';
            default: return 'NODE';
        }
    };

    const width = 360; // 稍微加宽
    const isRenderNode = image.nodeType === 'render' || image.nodeType === 'lens_lab';
    const hasSlices = isRenderNode && image.slices && image.slices.length > 0;
    const cols = image.gridCols || 2;
    
    const nodeAspectRatio = useMemo(() => {
        if (image.aspectRatio) return image.aspectRatio.replace(':', '/');
        return '16/9';
    }, [image.aspectRatio]);

    return (
        <div 
            ref={nodeRef}
            className={`absolute group bg-zinc-950 border-2 rounded-lg shadow-2xl transition-shadow duration-150 will-change-transform select-none ${
                selected ? 'border-cine-accent ring-4 ring-cine-accent/30 z-30' : 'border-zinc-800 hover:border-zinc-500 z-10'
            } ${isDraggingThis ? 'cursor-grabbing opacity-95 scale-[1.02] z-40' : 'cursor-default'}`}
            style={{ 
                transform: `translate3d(${image.position?.x || 0}px, ${image.position?.y || 0}px, 0)`,
                width: width,
            }}
            onMouseDown={(e) => {
                e.stopPropagation(); 
                onMouseDown(e); 
                onSelect();
            }}
        >
            {/* Node Header */}
            <div className={`px-4 py-3 border-b flex justify-between items-center rounded-t-lg cursor-grab active:cursor-grabbing ${getHeaderColor()}`}>
                 <div className="flex items-center gap-3 text-white pointer-events-none">
                     {getIcon()}
                     <span className="text-[12px] font-black uppercase tracking-wider">
                         {getLabel()}
                     </span>
                 </div>
                 <div className="flex items-center gap-3">
                     {expandedSlice && (
                         <button onClick={(e) => { e.stopPropagation(); setExpandedSlice(null); }} className="text-white hover:text-cine-accent">
                             <LayoutGrid size={16} />
                         </button>
                     )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="text-white hover:text-red-500 transition-colors p-1 bg-black/20 rounded"
                    >
                        <Trash2 size={16} />
                    </button>
                 </div>
            </div>

            {/* Content Body */}
            <div className="p-3 bg-black/90 pointer-events-none">
                {image.nodeType === 'prompt' && (
                    <div className="p-4 text-white text-[13px] font-bold leading-relaxed bg-zinc-900/80 rounded-sm border border-zinc-700 min-h-[100px] shadow-inner italic">
                        "{image.textData}"
                    </div>
                )}

                {image.nodeType === 'asset_group' && (
                    <div className="grid grid-cols-3 gap-2">
                        {image.assetIds?.map(id => {
                            const asset = allAssets?.find(a => a.id === id);
                            if (!asset) return null;
                            return (
                                <div key={id} className="aspect-square bg-zinc-800 rounded-sm overflow-hidden border-2 border-zinc-700">
                                    <img src={asset.previewUrl} className="w-full h-full object-cover" />
                                </div>
                            );
                        })}
                    </div>
                )}

                {isRenderNode && (
                    <div className="space-y-3">
                        {image.textData && (
                             <div className="p-3 bg-zinc-900 rounded-sm border border-zinc-700">
                                 <div className="flex items-center gap-2 mb-2 opacity-100">
                                     {image.nodeType === 'lens_lab' ? <Camera size={12} className="text-cine-accent" /> : <Type size={12} className="text-cine-accent" />}
                                     <span className="text-[10px] font-black text-white uppercase tracking-wider">
                                         {image.nodeType === 'lens_lab' ? 'Lab Parameters' : '导演指令 (Prompt)'}
                                     </span>
                                 </div>
                                 <p className="text-[12px] text-white font-bold leading-relaxed line-clamp-4">
                                     {image.textData}
                                 </p>
                             </div>
                        )}

                        <div 
                            className="relative w-full bg-zinc-900 rounded-sm border-2 border-zinc-800 overflow-hidden pointer-events-auto shadow-2xl"
                            style={{ aspectRatio: nodeAspectRatio }}
                        >
                            {expandedSlice ? (
                                <div className="w-full h-full relative group/expanded">
                                    <img src={expandedSlice} className="w-full h-full object-contain bg-black" alt="Expanded" />
                                    <button 
                                        className="absolute top-3 right-3 bg-black/80 text-white p-2 rounded-full hover:bg-red-500 transition-all shadow-xl"
                                        onClick={(e) => {e.stopPropagation(); setExpandedSlice(null);}}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ) : (
                                hasSlices ? (
                                    <div 
                                        className="grid w-full h-full gap-0.5 bg-zinc-800"
                                        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                                    >
                                        {image.slices!.map((sliceUrl, idx) => (
                                            <div 
                                                key={idx} 
                                                className="relative w-full h-full overflow-hidden cursor-pointer group/slice"
                                                onClick={(e) => { e.stopPropagation(); setExpandedSlice(sliceUrl); onSelect(); }}
                                            >
                                                <img src={sliceUrl} className="w-full h-full object-cover group-hover/slice:scale-105 transition-transform duration-700" />
                                                <div className="absolute inset-0 bg-white/0 group-hover/slice:bg-white/10 transition-colors pointer-events-none" />
                                                
                                                {image.sliceHistory?.[idx] && image.sliceHistory[idx].length > 0 && (
                                                    <div className="absolute bottom-2 right-2 px-1.5 py-1 bg-cine-accent text-black rounded-[2px] shadow-lg opacity-100">
                                                        <History size={12} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <img 
                                        src={image.url} 
                                        className="w-full h-full object-cover" 
                                        alt="Node" 
                                        draggable={false}
                                    />
                                )
                            )}
                        </div>

                        {image.cameraDescription && (
                            <div className="flex items-start gap-3 p-3 bg-cine-accent/10 border-2 border-cine-accent/40 rounded-[4px] shadow-lg">
                                <Video size={16} className="text-cine-accent mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] text-white font-black leading-relaxed">
                                    <span className="text-cine-accent uppercase">镜头语言:</span> {image.cameraDescription}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* HANDLES */}
            {(image.nodeType !== 'prompt' && image.nodeType !== 'lens_lab') && (
                 <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-4 h-4 bg-zinc-300 rounded-full border-2 border-zinc-950 z-20 shadow-lg"></div>
            )}
            {image.nodeType !== 'slice' && (
                 <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 bg-white rounded-full border-2 border-zinc-950 group-hover:bg-cine-accent transition-colors z-20 shadow-lg"></div>
            )}
        </div>
    );
});

const ConnectionLine = memo(({ start, end, startHeight, startWidth }: { start: {x:number, y:number}, end: {x:number, y:number}, startHeight: number, startWidth: number }) => {
    const sx = start.x + (startWidth / 2);
    const sy = start.y + startHeight; 
    const ex = end.x + (startWidth / 2);
    const ey = end.y;

    const verticalDist = Math.abs(ey - sy);
    const controlPointOffset = Math.max(verticalDist * 0.5, 60);

    const path = `M ${sx} ${sy} C ${sx} ${sy + controlPointOffset}, ${ex} ${ey - controlPointOffset}, ${ex} ${ey}`;

    return (
        <svg 
            className="absolute top-0 left-0 pointer-events-none" 
            style={{ width: '1px', height: '1px', overflow: 'visible', zIndex: 0 }}
        >
             <defs>
                 <linearGradient id={`grad-${sx}-${sy}-${ex}`} gradientUnits="userSpaceOnUse" x1={sx} y1={sy} x2={ex} y2={ey}>
                     <stop offset="0%" stopColor="#666" />
                     <stop offset="50%" stopColor="#FF7A00" stopOpacity={1} />
                     <stop offset="100%" stopColor="#666" />
                 </linearGradient>
             </defs>
             <path d={path} stroke="#555" strokeWidth={3} fill="none" />
             <path d={path} stroke={`url(#grad-${sx}-${sy}-${ex})`} strokeWidth={3} fill="none" className="animate-flow" strokeDasharray="12 12" />
        </svg>
    );
});

const DetailViewOverlay: React.FC<{ image: GeneratedImage; onClose: () => void }> = ({ image, onClose }) => {
    const [expandedSlice, setExpandedSlice] = useState<string | null>(null);
    const hasSlices = image.slices && image.slices.length > 0;
    const cols = image.gridCols || 2;
    
    const containerAspectRatio = useMemo(() => {
        if (image.aspectRatio) return image.aspectRatio.replace(':', '/');
        return '16/9';
    }, [image.aspectRatio]);

    return (
        <div className="absolute inset-0 bg-black/98 z-[100] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="h-20 px-8 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-xl">
                <div className="flex items-center gap-6">
                     <button onClick={onClose} className="flex items-center gap-3 text-white hover:text-cine-accent transition-all text-[14px] font-black uppercase tracking-widest">
                        <ArrowLeft size={24} />
                        返回工作区 (BACK)
                    </button>
                    <div className="h-8 w-[2px] bg-zinc-700"></div>
                    <span className="text-white text-[16px] font-black tracking-wider truncate max-w-lg">{image.prompt}</span>
                </div>
                <button onClick={onClose} className="p-2 text-white hover:rotate-90 transition-all"><X size={32} /></button>
            </div>

            <div className="flex-1 p-10 flex items-center justify-center overflow-hidden relative">
                <div className="relative w-full max-w-6xl h-full flex flex-col justify-center">
                    <div 
                        className="relative w-full bg-black shadow-[0_0_100px_rgba(0,0,0,1)] rounded-sm overflow-hidden mx-auto border-2 border-zinc-800"
                        style={{ aspectRatio: containerAspectRatio, maxHeight: '85vh' }}
                    >
                        {expandedSlice ? (
                             <div className="w-full h-full relative group">
                                <img src={expandedSlice} className="w-full h-full object-contain bg-black" alt="Expanded" />
                                <button 
                                    className="absolute top-6 right-6 bg-black/80 hover:bg-red-500 text-white p-3 rounded-full backdrop-blur-xl transition-all border-2 border-white/20 shadow-2xl"
                                    onClick={() => setExpandedSlice(null)}
                                >
                                    <X size={32} />
                                </button>
                             </div>
                        ) : (
                            hasSlices ? (
                                <div 
                                    className="grid w-full h-full gap-1 bg-zinc-900"
                                    style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                                >
                                    {image.slices!.map((sliceUrl, idx) => (
                                        <div key={idx} className="relative w-full h-full overflow-hidden cursor-pointer group/slice" onClick={() => setExpandedSlice(sliceUrl)}>
                                            <img src={sliceUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover/slice:scale-110" />
                                            <div className="absolute inset-0 bg-black/0 group-hover/slice:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/slice:opacity-100">
                                                <Maximize2 className="text-white drop-shadow-2xl" size={64} />
                                            </div>
                                            {image.sliceHistory?.[idx] && image.sliceHistory[idx].length > 0 && (
                                                <div className="absolute top-6 left-6 flex items-center gap-3 bg-cine-accent text-black px-4 py-2 rounded-sm text-[12px] font-black font-mono tracking-widest shadow-2xl animate-pulse">
                                                    <History size={16} />
                                                    RE-RENDERED v.{image.sliceHistory[idx].length + 1}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <img src={image.url} className="w-full h-full object-contain" />
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Canvas: React.FC<CanvasProps> = ({ images, assets, onSelect, selectedId, onDelete, onUpdateNodePosition, onDownloadAll, onDeselectAll }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('workflow');
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [localDragPos, setLocalDragPos] = useState<{x: number, y: number} | null>(null);
  
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  const [detailViewItem, setDetailViewItem] = useState<GeneratedImage | null>(null);

  const handleHeightChange = useCallback((id: string, height: number) => {
      setNodeHeights(prev => {
          if (prev[id] === height) return prev;
          return { ...prev, [id]: height };
      });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setIsDraggingCanvas(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        if (onDeselectAll) onDeselectAll();
      }
  };

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
      window.getSelection()?.removeAllRanges();
      setDraggingNodeId(id);
      
      const image = images.find(i => i.id === id);
      if (image && image.position) {
          setLocalDragPos({ x: image.position.x, y: image.position.y });
      }
      
      lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, [images]);

  const handleMouseMove = (e: React.MouseEvent) => {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      if (isDraggingCanvas) {
          setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      } else if (draggingNodeId && localDragPos) {
          setLocalDragPos(prev => prev ? ({
              x: prev.x + (dx / scale),
              y: prev.y + (dy / scale)
          }) : null);
      }
  };

  const handleMouseUp = () => {
      if (draggingNodeId && localDragPos) {
          onUpdateNodePosition(draggingNodeId, localDragPos.x, localDragPos.y);
      }
      setIsDraggingCanvas(false);
      setDraggingNodeId(null);
      setLocalDragPos(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (viewMode !== 'workflow' || !containerRef.current) return;
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newScale = Math.min(Math.max(0.15, scale - e.deltaY * zoomSensitivity), 4);
      const worldX = (mouseX - pan.x) / scale;
      const worldY = (mouseY - pan.y) / scale;
      const newPanX = mouseX - worldX * newScale;
      const newPanY = mouseY - worldY * newScale;
      setScale(newScale);
      setPan({ x: newPanX, y: newPanY });
  };

  const handleItemClick = (img: GeneratedImage) => {
      onSelect(img);
      setDetailViewItem(img);
  };

  const renderedNodes = useMemo(() => {
      return images.map(img => {
          if (img.id === draggingNodeId && localDragPos) {
              return { ...img, position: localDragPos };
          }
          return img;
      });
  }, [images, draggingNodeId, localDragPos]);

  return (
    <div className={`flex flex-col h-full bg-black relative selection:bg-cine-accent selection:text-black ${draggingNodeId ? 'select-none cursor-grabbing' : ''}`}>
      {detailViewItem && <DetailViewOverlay image={detailViewItem} onClose={() => setDetailViewItem(null)} />}
      <div className="absolute top-0 left-0 right-0 h-20 px-8 flex items-center justify-between z-20 bg-gradient-to-b from-black via-black/90 to-transparent pointer-events-none">
         <div className="flex items-center gap-6 pointer-events-auto">
             <span className="text-white text-[12px] uppercase tracking-[0.2em] font-black">
               <span className="text-cine-accent">工作区 (CANVAS)</span> / 已渲染 {images.filter(i => i.nodeType === 'render' || i.nodeType === 'lens_lab').length} 个分镜组
             </span>
         </div>
         <div className="flex items-center gap-3 pointer-events-auto">
             <div className="flex bg-zinc-900/90 rounded-sm p-1 border border-zinc-700 backdrop-blur-xl shadow-2xl">
                 <button onClick={() => setViewMode('workflow')} className={`p-2 rounded-[1px] transition-all flex items-center gap-2 px-4 ${viewMode === 'workflow' ? 'bg-zinc-700 text-white shadow-xl' : 'text-zinc-400 hover:text-white'}`}>
                     <Workflow size={18} />
                     <span className="text-[12px] font-black uppercase tracking-widest">节点视图</span>
                 </button>
                 <button onClick={() => setViewMode('grid')} className={`p-2 rounded-[1px] transition-all px-4 ${viewMode === 'grid' ? 'bg-zinc-700 text-white shadow-xl' : 'text-zinc-400 hover:text-white'}`}>
                     <LayoutGrid size={18} />
                 </button>
                 <button onClick={() => setViewMode('table')} className={`p-2 rounded-[1px] transition-all px-4 ${viewMode === 'table' ? 'bg-zinc-700 text-white shadow-xl' : 'text-zinc-400 hover:text-white'}`}>
                     <List size={18} />
                 </button>
             </div>
             {images.length > 0 && (
                 <Button variant="primary" size="md" onClick={onDownloadAll} className="flex items-center gap-2 border border-zinc-600 bg-zinc-800/80 backdrop-blur-xl hover:bg-zinc-700 text-[11px] h-10 px-5 shadow-2xl">
                     <Archive size={16} />
                     <span className="uppercase tracking-widest font-black">导出素材 (ZIP)</span>
                 </Button>
             )}
         </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-[#050505]">
        {images.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 select-none animate-in fade-in duration-700 z-10 relative">
                <div className="text-center mb-16 space-y-6">
                    <h1 className="text-4xl font-black text-white tracking-tighter flex items-center justify-center gap-4">
                        <div className="w-4 h-4 bg-cine-accent rounded-sm shadow-[0_0_25px_rgba(255,122,0,0.8)]"></div>
                        OrangeStudio 橙意机构
                    </h1>
                    <p className="text-zinc-200 text-[18px] max-w-2xl mx-auto leading-relaxed font-bold">
                        专业的连续分镜创作器。现支持 <span className="text-cine-accent underline decoration-2 underline-offset-4">无缝宫格渲染</span>，<br/>以及 <span className="text-white border-b-2 border-white/30">分镜局部 AI 精准重绘</span>。
                    </p>
                </div>
            </div>
        ) : (
            <>
                {viewMode === 'workflow' && (
                    <div 
                        className={`w-full h-full overflow-hidden bg-[#050505] ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`} 
                        ref={containerRef} 
                        onMouseDown={handleMouseDown} 
                        onMouseMove={handleMouseMove} 
                        onMouseUp={handleMouseUp} 
                        onMouseLeave={handleMouseUp} 
                        onWheel={handleWheel}
                    >
                         <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(#555 1px, transparent 1px)', backgroundSize: `${30 * scale}px ${30 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />
                         <div className="absolute origin-top-left will-change-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
                             {renderedNodes.map(img => {
                                 if (img.parentId) {
                                     const parent = renderedNodes.find(p => p.id === img.parentId);
                                     if (parent && parent.position && img.position) {
                                         return <ConnectionLine key={`link-${parent.id}-${img.id}`} start={parent.position} end={img.position} startWidth={360} startHeight={nodeHeights[parent.id] || 250} />
                                     }
                                 }
                                 return null;
                             })}
                             {renderedNodes.map(img => (
                                 <Node 
                                    key={img.id} 
                                    image={img} 
                                    allAssets={assets} 
                                    selected={selectedId === img.id} 
                                    onSelect={() => onSelect(img)} 
                                    onDelete={() => onDelete(img.id)} 
                                    onMouseDown={(e) => handleNodeMouseDown(e, img.id)} 
                                    onHeightChange={handleHeightChange} 
                                    isDraggingThis={draggingNodeId === img.id}
                                 />
                             ))}
                         </div>
                    </div>
                )}
                {(viewMode === 'grid' || viewMode === 'table') && (
                    <div className="h-full overflow-y-auto p-10 pt-28 custom-scrollbar">
                        <div className={`grid gap-4 items-start ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                            {images.filter(i => i.nodeType === 'render' || i.nodeType === 'lens_lab').map((img) => (
                                <div key={img.id} className={`group relative bg-zinc-900 border-2 transition-all duration-300 cursor-pointer overflow-hidden rounded-md shadow-xl ${selectedId === img.id ? 'border-cine-accent ring-2 ring-cine-accent/50' : 'border-zinc-800 hover:border-zinc-500'} ${viewMode === 'table' ? 'flex flex-row gap-6 p-6' : ''}`} onClick={() => handleItemClick(img)}>
                                    <div className={`${viewMode === 'table' ? 'w-64' : 'w-full'} relative aspect-video pointer-events-none border-b-2 border-zinc-800`}>
                                        <img src={img.url} alt="node" className="w-full h-full object-cover" />
                                        <div className="absolute top-3 left-3 px-3 py-1 rounded-[2px] text-[10px] font-black tracking-wider border-2 backdrop-blur-xl bg-cine-accent text-black border-cine-accent shadow-2xl">
                                            {img.nodeType.toUpperCase()}
                                        </div>
                                    </div>
                                    {viewMode === 'table' && (
                                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-3">
                                            <p className="text-white text-[16px] font-black truncate">{img.prompt}</p>
                                            <div className="flex gap-4">
                                                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-[10px] font-bold rounded">ID: {img.id.slice(0,8)}</span>
                                                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-[10px] font-bold rounded">AR: {img.aspectRatio}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};