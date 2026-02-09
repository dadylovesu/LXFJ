
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
  onSwapSlices?: (sourceId: string, sourceIdx: number, targetId: string, targetIdx: number) => void;
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
    onSwapSlices?: (sourceId: string, sourceIdx: number, targetId: string, targetIdx: number) => void;
}

const Node = memo(({ image, selected, onSelect, onDelete, onMouseDown, allAssets, onHeightChange, isDraggingThis, onSwapSlices }: NodeProps) => {
    const [expandedSlice, setExpandedSlice] = useState<string | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
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
            case 'prompt': return 'bg-blue-900/40 border-blue-800';
            case 'asset_group': return 'bg-purple-900/40 border-purple-800';
            case 'render': return 'bg-cine-panel border-cine-accent/30';
            case 'lens_lab': return 'bg-cine-panel border-cine-accent/60';
            default: return 'bg-zinc-800';
        }
    };

    const getIcon = () => {
        switch (image.nodeType) {
            case 'prompt': return <Type size={10} />;
            case 'asset_group': return <Images size={10} />;
            case 'render': return <MonitorPlay size={10} />;
            case 'lens_lab': return <Camera size={10} />;
            default: return null;
        }
    };

    const getLabel = () => {
        switch (image.nodeType) {
            case 'prompt': return 'PROMPT INPUT';
            case 'asset_group': return 'STYLE REFERENCES';
            case 'render': return 'SCENE BOARD';
            case 'lens_lab': return 'LENS LAB SEQUENCE';
            default: return 'NODE';
        }
    };

    const width = 320;
    const isRenderNode = image.nodeType === 'render' || image.nodeType === 'lens_lab';
    const hasSlices = isRenderNode && image.slices && image.slices.length > 0;
    const cols = image.gridCols || 2;
    
    const nodeAspectRatio = useMemo(() => {
        if (image.aspectRatio) return image.aspectRatio.replace(':', '/');
        return '16/9';
    }, [image.aspectRatio]);

    // Enhanced Drag and Drop Logic
    const handleSliceDragStart = (e: React.DragEvent, idx: number) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData("sourceNodeId", image.id);
        e.dataTransfer.setData("sourceSliceIdx", idx.toString());
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = "0.4";
    };

    const handleSliceDragEnd = (e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = "1";
    };

    const handleSliceDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault(); // MANDATORY for dropping
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIdx !== idx) setDragOverIdx(idx);
    };

    const handleSliceDrop = (e: React.DragEvent, targetIdx: number) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverIdx(null);
        
        const sourceId = e.dataTransfer.getData("sourceNodeId");
        const sourceIdxStr = e.dataTransfer.getData("sourceSliceIdx");
        
        if (sourceId && sourceIdxStr !== "" && onSwapSlices) {
            const sourceIdx = parseInt(sourceIdxStr);
            onSwapSlices(sourceId, sourceIdx, image.id, targetIdx);
        }
    };

    return (
        <div 
            ref={nodeRef}
            className={`absolute group bg-zinc-950 border rounded-md shadow-2xl transition-shadow duration-150 will-change-transform select-none ${
                selected ? 'border-cine-accent ring-1 ring-cine-accent/50 z-30' : 'border-zinc-800 hover:border-zinc-600 z-10'
            } ${isDraggingThis ? 'cursor-grabbing opacity-90 scale-[1.01] shadow-cine-accent/20 z-40' : 'cursor-default'}`}
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
            <div className={`px-3 py-2 border-b flex justify-between items-center rounded-t-md cursor-grab active:cursor-grabbing ${getHeaderColor()}`}>
                 <div className="flex items-center gap-2 text-zinc-200 pointer-events-none">
                     {getIcon()}
                     <span className="text-[9px] font-mono uppercase tracking-wider font-bold">{getLabel()}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-zinc-500 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                 </div>
            </div>

            <div className="p-2 bg-black/80">
                {image.nodeType === 'prompt' && (
                    <div className="p-3 text-zinc-200 text-xs font-mono leading-relaxed bg-zinc-900 rounded-sm border border-zinc-800 min-h-[80px]">
                        "{image.textData}"
                    </div>
                )}

                {isRenderNode && (
                    <div className="space-y-2">
                        {image.textData && (
                             <div className="p-2 bg-zinc-900/50 rounded-sm border border-zinc-800/50">
                                 <p className="text-[10px] text-zinc-200 font-mono leading-relaxed line-clamp-3 opacity-60">
                                     {image.textData}
                                 </p>
                             </div>
                        )}
                        <div 
                            className="relative w-full bg-zinc-900 rounded-sm border border-zinc-800 overflow-hidden pointer-events-auto"
                            style={{ aspectRatio: nodeAspectRatio }}
                        >
                            {expandedSlice ? (
                                <div className="w-full h-full relative group/expanded">
                                    <img src={expandedSlice} className="w-full h-full object-contain bg-black" alt="Expanded" />
                                    <button className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded hover:bg-red-500 transition-colors" onClick={(e) => {e.stopPropagation(); setExpandedSlice(null);}}><X size={14} /></button>
                                </div>
                            ) : (
                                hasSlices ? (
                                    <div 
                                        className="grid w-full h-full gap-0 bg-black"
                                        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                                    >
                                        {image.slices!.map((sliceUrl, idx) => (
                                            <div 
                                                key={idx} 
                                                draggable
                                                onDragStart={(e) => handleSliceDragStart(e, idx)}
                                                onDragEnd={handleSliceDragEnd}
                                                onDragOver={(e) => handleSliceDragOver(e, idx)}
                                                onDragLeave={() => setDragOverIdx(null)}
                                                onDrop={(e) => handleSliceDrop(e, idx)}
                                                className={`relative w-full h-full overflow-hidden cursor-pointer group/slice transition-all duration-300 ${dragOverIdx === idx ? 'ring-2 ring-cine-accent ring-inset z-50 bg-cine-accent/20' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); setExpandedSlice(sliceUrl); onSelect(); }}
                                            >
                                                <img src={sliceUrl} className="w-full h-full object-cover group-hover/slice:scale-105 transition-transform duration-700" />
                                                <div className="absolute inset-0 bg-white/0 group-hover/slice:bg-white/5 transition-colors pointer-events-none" />
                                                
                                                {dragOverIdx === idx && (
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <MonitorPlay size={24} className="text-cine-accent animate-pulse" />
                                                    </div>
                                                )}

                                                {image.sliceHistory?.[idx] && image.sliceHistory[idx].length > 0 && (
                                                    <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 backdrop-blur-md rounded-[1px] text-cine-accent opacity-0 group-hover/slice:opacity-100 transition-opacity">
                                                        <History size={8} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <img src={image.url} className="w-full h-full object-cover" alt="Node" draggable={false} />
                                )
                            )}
                        </div>
                    </div>
                )}
            </div>
            {image.nodeType !== 'slice' && (
                 <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-zinc-300 rounded-full border-2 border-zinc-950 group-hover:bg-cine-accent transition-colors z-20"></div>
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
    const controlPointOffset = Math.max(verticalDist * 0.5, 50);
    const path = `M ${sx} ${sy} C ${sx} ${sy + controlPointOffset}, ${ex} ${ey - controlPointOffset}, ${ex} ${ey}`;
    return (
        <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '1px', height: '1px', overflow: 'visible', zIndex: 0 }}>
             <defs>
                 <linearGradient id={`grad-${sx}-${sy}-${ex}`} gradientUnits="userSpaceOnUse" x1={sx} y1={sy} x2={ex} y2={ey}>
                     <stop offset="0%" stopColor="#444" />
                     <stop offset="50%" stopColor="#FF7A00" stopOpacity={0.8} />
                     <stop offset="100%" stopColor="#444" />
                 </linearGradient>
             </defs>
             <path d={path} stroke="#333" strokeWidth={2} fill="none" />
             <path d={path} stroke={`url(#grad-${sx}-${sy}-${ex})`} strokeWidth={2} fill="none" className="animate-flow" strokeDasharray="10 10" />
        </svg>
    );
});

const DetailViewOverlay: React.FC<{ image: GeneratedImage; onClose: () => void }> = ({ image, onClose }) => {
    const [expandedSlice, setExpandedSlice] = useState<string | null>(null);
    const containerAspectRatio = useMemo(() => image.aspectRatio ? image.aspectRatio.replace(':', '/') : '16/9', [image.aspectRatio]);
    return (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="h-14 px-6 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-4">
                     <button onClick={onClose} className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors text-xs font-mono uppercase tracking-wider"><ArrowLeft size={16} /> 返回</button>
                     <div className="h-4 w-[1px] bg-zinc-700"></div>
                     <span className="text-white text-xs font-bold font-mono">{image.prompt.substring(0, 50)}...</span>
                </div>
            </div>
            <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
                <div className="relative w-full max-w-5xl h-full flex flex-col justify-center">
                    <div className="relative w-full bg-zinc-900 shadow-2xl rounded-sm overflow-hidden mx-auto" style={{ aspectRatio: containerAspectRatio, maxHeight: '80vh' }}>
                        {expandedSlice ? (
                             <div className="w-full h-full relative group">
                                <img src={expandedSlice} className="w-full h-full object-contain bg-black" />
                                <button className="absolute top-4 right-4 bg-black/50 hover:bg-red-500 text-white p-2 rounded-full" onClick={() => setExpandedSlice(null)}><X size={20} /></button>
                             </div>
                        ) : (
                            <img src={image.url} className="w-full h-full object-contain" onClick={() => { if(image.slices) setExpandedSlice(image.slices[0]); }} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Canvas: React.FC<CanvasProps> = ({ images, assets, onSelect, selectedId, onDelete, onUpdateNodePosition, onDownloadAll, onDeselectAll, onSwapSlices }) => {
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
      setNodeHeights(prev => prev[id] === height ? prev : { ...prev, [id]: height });
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
      if (image && image.position) setLocalDragPos({ x: image.position.x, y: image.position.y });
      lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, [images]);

  const handleMouseMove = (e: React.MouseEvent) => {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (isDraggingCanvas) setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      else if (draggingNodeId && localDragPos) setLocalDragPos(prev => prev ? ({ x: prev.x + (dx / scale), y: prev.y + (dy / scale) }) : null);
  };

  const handleMouseUp = () => {
      if (draggingNodeId && localDragPos) onUpdateNodePosition(draggingNodeId, localDragPos.x, localDragPos.y);
      setIsDraggingCanvas(false); setDraggingNodeId(null); setLocalDragPos(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (viewMode !== 'workflow' || !containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newScale = Math.min(Math.max(0.2, scale - e.deltaY * 0.001), 3);
      const worldX = (mouseX - pan.x) / scale;
      const worldY = (mouseY - pan.y) / scale;
      setPan({ x: mouseX - worldX * newScale, y: mouseY - worldY * newScale });
      setScale(newScale);
  };

  const renderedNodes = useMemo(() => images.map(img => img.id === draggingNodeId && localDragPos ? { ...img, position: localDragPos } : img), [images, draggingNodeId, localDragPos]);

  return (
    <div className={`flex flex-col h-full bg-black relative selection:bg-cine-accent selection:text-black ${draggingNodeId ? 'select-none cursor-grabbing' : ''}`}>
      {detailViewItem && <DetailViewOverlay image={detailViewItem} onClose={() => setDetailViewItem(null)} />}
      <div className="absolute top-0 left-0 right-0 h-14 px-6 flex items-center justify-between z-20 bg-gradient-to-b from-black via-black/90 to-transparent pointer-events-none">
         <div className="flex items-center gap-4 pointer-events-auto">
             <span className="text-zinc-300 text-[10px] uppercase tracking-[0.2em] font-mono font-bold">画布 CANVAS / {images.length} TASKS</span>
         </div>
         <div className="flex items-center gap-2 pointer-events-auto">
             <div className="flex bg-zinc-900/80 rounded-sm p-0.5 border border-zinc-800 backdrop-blur-sm mr-4">
                 <button onClick={() => setViewMode('workflow')} className={`p-1.5 rounded-[1px] transition-all flex items-center gap-1.5 px-2 ${viewMode === 'workflow' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}><Workflow size={14} />{viewMode === 'workflow' && <span className="text-[10px] font-mono uppercase">Node Graph</span>}</button>
                 <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-[1px] transition-all ${viewMode === 'grid' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}><LayoutGrid size={14} /></button>
                 <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-[1px] transition-all ${viewMode === 'table' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}><List size={14} /></button>
             </div>
             {images.length > 0 && <Button variant="ghost" size="sm" onClick={onDownloadAll} className="flex items-center gap-2 border border-zinc-800 bg-black/50 text-[10px] h-7"><Archive size={12} />下载 ZIP</Button>}
         </div>
      </div>
      <div className="flex-1 relative overflow-hidden bg-[#0a0a0a]">
        {images.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-10 select-none animate-in fade-in duration-500 z-10 relative">
                <div className="text-center mb-12 space-y-4">
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-3"><div className="w-3 h-3 bg-cine-accent rounded-sm shadow-[0_0_15px_rgba(255,122,0,0.6)]"></div>OrangeStudio 橙意机构</h1>
                    <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">专业的连续分镜创作器。拖拽切片即可跨组互换分镜，拼凑完美创作序列。</p>
                </div>
            </div>
        ) : (
            <>
                {viewMode === 'workflow' && (
                    <div className={`w-full h-full overflow-hidden bg-[#050505] ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`} ref={containerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}>
                         <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: `${20 * scale}px ${20 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />
                         <div className="absolute origin-top-left will-change-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
                             {renderedNodes.map(img => img.parentId ? <ConnectionLine key={`link-${img.parentId}-${img.id}`} start={renderedNodes.find(p => p.id === img.parentId)!.position!} end={img.position!} startWidth={320} startHeight={nodeHeights[img.parentId!] || 200} /> : null)}
                             {renderedNodes.map(img => (
                                 <Node key={img.id} image={img} allAssets={assets} selected={selectedId === img.id} onSelect={() => onSelect(img)} onDelete={() => onDelete(img.id)} onMouseDown={(e) => handleNodeMouseDown(e, img.id)} onHeightChange={handleHeightChange} isDraggingThis={draggingNodeId === img.id} onSwapSlices={onSwapSlices} />
                             ))}
                         </div>
                    </div>
                )}
                {(viewMode === 'grid' || viewMode === 'table') && (
                    <div className="h-full overflow-y-auto p-6 pt-20 custom-scrollbar">
                        <div className={`grid gap-0 items-start ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-1'}`}>
                            {images.map((img) => (
                                <div key={img.id} className={`group relative bg-zinc-900 border transition-all cursor-pointer overflow-hidden ${selectedId === img.id ? 'border-cine-accent ring-1' : 'border-zinc-800'} ${viewMode === 'table' ? 'flex flex-row gap-4 p-4' : ''}`} onClick={() => onSelect(img)}>
                                    <div className={`${viewMode === 'table' ? 'w-48' : 'w-full'} relative aspect-video`}><img src={img.url} className="w-full h-full object-cover" /></div>
                                    {viewMode === 'table' && <div className="flex-1 min-w-0"><p className="text-zinc-200 text-xs font-mono truncate">{img.prompt}</p></div>}
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
