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

// --- Infinite Canvas Sub-components ---

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
            case 'prompt': return 'bg-blue-900/60 border-blue-400/30';
            case 'asset_group': return 'bg-purple-900/60 border-purple-400/30';
            case 'render': return 'bg-cine-panel border-cine-accent/50';
            case 'lens_lab': return 'bg-cine-panel border-cine-accent/70';
            default: return 'bg-zinc-800 border-zinc-600';
        }
    };

    const getIcon = () => {
        switch (image.nodeType) {
            case 'prompt': return <Type size={12} />;
            case 'asset_group': return <Images size={12} />;
            case 'render': return <MonitorPlay size={12} />;
            case 'lens_lab': return <Camera size={12} />;
            default: return null;
        }
    };

    const getLabel = () => {
        switch (image.nodeType) {
            case 'prompt': return '文本输入指令';
            case 'asset_group': return '风格参考资产';
            case 'render': return '场景分镜板';
            case 'lens_lab': return '镜头实验室序列';
            default: return 'NODE';
        }
    };

    const width = 340;
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
            className={`absolute group bg-zinc-950 border-2 rounded-md shadow-2xl transition-all duration-150 will-change-transform select-none ${
                selected ? 'border-cine-accent ring-2 ring-cine-accent/50 z-30' : 'border-zinc-800 hover:border-zinc-500 z-10'
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
            {/* Node Header */}
            <div className={`px-4 py-2.5 border-b-2 flex justify-between items-center rounded-t-md cursor-grab active:cursor-grabbing ${getHeaderColor()}`}>
                 <div className="flex items-center gap-2.5 text-white pointer-events-none">
                     {getIcon()}
                     <span className="text-[12px] font-black uppercase tracking-wider">
                         {getLabel()}
                     </span>
                 </div>
                 <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="text-white hover:text-red-500 transition-colors bg-black/40 p-1.5 rounded-full"
                    >
                        <Trash2 size={14} />
                    </button>
                 </div>
            </div>

            {/* Content Body */}
            <div className="p-3 bg-black/90 pointer-events-none">
                {image.nodeType === 'prompt' && (
                    <div className="p-4 text-white text-[13px] font-bold leading-relaxed bg-zinc-900 border border-zinc-700 rounded-sm">
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
                             <div className="p-3 bg-zinc-900 border border-zinc-700 rounded-sm">
                                 <div className="flex items-center gap-2 mb-2">
                                     {image.nodeType === 'lens_lab' ? <Camera size={12} className="text-cine-accent" /> : <Type size={12} className="text-cine-accent" />}
                                     <span className="text-[11px] font-black text-zinc-100 uppercase tracking-widest">
                                         {image.nodeType === 'lens_lab' ? '参数设定 (LAB)' : '导演指令 (PROMPT)'}
                                     </span>
                                 </div>
                                 <p className="text-[12px] text-white font-bold leading-relaxed line-clamp-4">
                                     {image.textData}
                                 </p>
                             </div>
                        )}

                        <div 
                            className="relative w-full bg-zinc-900 rounded-sm border-2 border-zinc-700 overflow-hidden pointer-events-auto shadow-2xl"
                            style={{ aspectRatio: nodeAspectRatio }}
                        >
                            {expandedSlice ? (
                                <div className="w-full h-full relative group/expanded">
                                    <img src={expandedSlice} className="w-full h-full object-contain bg-black" alt="Expanded" />
                                    <button 
                                        className="absolute top-3 right-3 bg-black/80 text-white p-2 rounded hover:bg-red-500 transition-colors border border-zinc-600"
                                        onClick={(e) => {e.stopPropagation(); setExpandedSlice(null);}}
                                    >
                                        <X size={18} />
                                    </button>
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
                                                className="relative w-full h-full overflow-hidden cursor-pointer group/slice"
                                                onClick={(e) => { e.stopPropagation(); setExpandedSlice(sliceUrl); onSelect(); }}
                                            >
                                                <img src={sliceUrl} className="w-full h-full object-cover group-hover/slice:scale-110 transition-transform duration-700" />
                                                <div className="absolute inset-0 bg-white/0 group-hover/slice:bg-white/10 transition-colors pointer-events-none" />
                                                
                                                {image.sliceHistory?.[idx] && image.sliceHistory[idx].length > 0 && (
                                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-cine-accent text-black font-black text-[9px] rounded-[2px] shadow-lg">
                                                        V{image.sliceHistory[idx].length + 1}
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
                            <div className="flex items-start gap-3 p-3 bg-cine-accent/10 border-2 border-cine-accent/40 rounded-[2px] shadow-lg">
                                <Video size={16} className="text-cine-accent mt-0.5 flex-shrink-0" />
                                <p className="text-[12px] text-white font-black leading-relaxed">
                                    <span className="text-cine-accent uppercase mr-2">镜头逻辑:</span> {image.cameraDescription}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* HANDLES */}
            {(image.nodeType !== 'prompt' && image.nodeType !== 'lens_lab') && (
                 <div className="absolute left-1/2 -translate-x-1/2 -top-2.5 w-4 h-4 bg-zinc-300 rounded-full border-2 border-black z-20 shadow-lg"></div>
            )}
            {image.nodeType !== 'slice' && (
                 <div className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 w-4 h-4 bg-cine-accent rounded-full border-2 border-black group-hover:scale-125 transition-transform z-20 shadow-[0_0_10px_rgba(255,122,0,0.6)]"></div>
            )}
        </div>
    );
});

// ... ConnectionLine remains same, but maybe slightly thicker ...

export const Canvas: React.FC<CanvasProps> = ({ images, assets, onSelect, selectedId, onDelete, onUpdateNodePosition, onDownloadAll, onDeselectAll }) => {
  // ... View Mode and Pan/Scale logic remains same ...
  // Updating labels in header:
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
      const newScale = Math.min(Math.max(0.2, scale - e.deltaY * zoomSensitivity), 3);
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
      <div className="absolute top-0 left-0 right-0 h-16 px-8 flex items-center justify-between z-20 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none">
         <div className="flex items-center gap-4 pointer-events-auto">
             <span className="text-white text-[12px] uppercase tracking-[0.25em] font-black">
               分镜创作画布 (CANVAS) / {images.filter(i => i.nodeType === 'render' || i.nodeType === 'lens_lab').length} 个场景
             </span>
         </div>
         <div className="flex items-center gap-4 pointer-events-auto">
             <div className="flex bg-zinc-900/90 rounded-sm p-1 border-2 border-zinc-700 backdrop-blur-md">
                 <button onClick={() => setViewMode('workflow')} className={`p-2 rounded-[1px] transition-all flex items-center gap-2 px-4 ${viewMode === 'workflow' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-300 hover:text-white'}`}>
                     <Workflow size={16} />
                     <span className="text-[12px] font-black uppercase tracking-widest">流程视图</span>
                 </button>
                 <button onClick={() => setViewMode('grid')} className={`p-2 rounded-[1px] transition-all px-4 ${viewMode === 'grid' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-300 hover:text-white'}`}>
                     <LayoutGrid size={16} />
                 </button>
                 <button onClick={() => setViewMode('table')} className={`p-2 rounded-[1px] transition-all px-4 ${viewMode === 'table' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-300 hover:text-white'}`}>
                     <List size={16} />
                 </button>
             </div>
             {images.length > 0 && (
                 <Button variant="ghost" size="sm" onClick={onDownloadAll} className="flex items-center gap-3 border-2 border-zinc-700 bg-black/60 backdrop-blur hover:bg-zinc-800 text-[11px] h-10 px-6 font-black">
                     <Archive size={14} className="text-cine-accent" />
                     <span className="uppercase tracking-widest text-white">下载工程包 (.ZIP)</span>
                 </Button>
             )}
         </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-[#080808]">
        {images.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 select-none animate-in fade-in duration-500 z-10 relative">
                <div className="text-center mb-16 space-y-6">
                    <h1 className="text-5xl font-black text-white tracking-tighter flex items-center justify-center gap-6">
                        <div className="w-5 h-5 bg-cine-accent rounded-sm shadow-[0_0_20px_rgba(255,122,0,0.8)]"></div>
                        OrangeStudio 橙意机构
                    </h1>
                    <p className="text-zinc-100 text-[18px] max-w-2xl mx-auto leading-relaxed font-bold">
                        新一代导演辅助工具。现已支持 <span className="text-cine-accent font-black">3D 一致性镜头重绘</span> 与 <span className="text-white border-b-2 border-cine-accent">无损工程导出</span>。
                    </p>
                </div>
                <div className="p-8 bg-zinc-900/40 border-2 border-zinc-700 rounded-lg max-w-lg text-center backdrop-blur-md">
                     <p className="text-white font-bold text-[14px] leading-relaxed">
                         请从左侧资产库上传参考图，并在控制台输入场景描述开始创作。
                     </p>
                </div>
            </div>
        ) : (
             <div 
                className={`w-full h-full overflow-hidden bg-[#050505] ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`} 
                ref={containerRef} 
                onMouseDown={handleMouseDown} 
                onMouseMove={handleMouseMove} 
                onMouseUp={handleMouseUp} 
                onMouseLeave={handleMouseUp} 
                onWheel={handleWheel}
            >
                 <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: `${30 * scale}px ${30 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />
                 <div className="absolute origin-top-left will-change-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
                     {/* Links and Nodes Rendering... (Same Logic, Higher Contrast Lines) */}
                     {renderedNodes.map(img => {
                         if (img.parentId) {
                             const parent = renderedNodes.find(p => p.id === img.parentId);
                             if (parent && parent.position && img.position) {
                                 return <ConnectionLine key={`link-${parent.id}-${img.id}`} start={parent.position} end={img.position} startWidth={340} startHeight={nodeHeights[parent.id] || 200} />
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
      </div>
    </div>
  );
};

const DetailViewOverlay: React.FC<{ image: GeneratedImage; onClose: () => void }> = ({ image, onClose }) => {
    // ... Detail View Logic ...
    // Update text colors in DetailView as well
    const [expandedSlice, setExpandedSlice] = useState<string | null>(null);
    const hasSlices = image.slices && image.slices.length > 0;
    const cols = image.gridCols || 2;
    const containerAspectRatio = useMemo(() => {
        if (image.aspectRatio) return image.aspectRatio.replace(':', '/');
        return '16/9';
    }, [image.aspectRatio]);

    return (
        <div className="absolute inset-0 bg-black/98 z-[100] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="h-16 px-8 flex items-center justify-between border-b-2 border-zinc-800 bg-zinc-900/80">
                <div className="flex items-center gap-6">
                     <button onClick={onClose} className="flex items-center gap-3 text-white hover:text-cine-accent transition-all text-[14px] font-black uppercase tracking-widest">
                        <ArrowLeft size={20} />
                        返回画布
                    </button>
                    <div className="h-6 w-[2px] bg-zinc-700"></div>
                    <span className="text-white text-[15px] font-black">{image.prompt.substring(0, 60)}...</span>
                </div>
                <button onClick={onClose} className="p-2 text-white hover:rotate-90 transition-all"><X size={24} /></button>
            </div>
            <div className="flex-1 p-12 flex items-center justify-center overflow-hidden">
                <div className="relative w-full max-w-6xl h-full flex flex-col justify-center">
                    <div 
                        className="relative w-full bg-zinc-900 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-sm overflow-hidden mx-auto border-2 border-zinc-700"
                        style={{ aspectRatio: containerAspectRatio, maxHeight: '85vh' }}
                    >
                        {/* Display Image... */}
                        {expandedSlice ? (
                             <div className="w-full h-full relative">
                                <img src={expandedSlice} className="w-full h-full object-contain bg-black" />
                                <button className="absolute top-6 right-6 bg-black/80 text-white p-3 rounded-full hover:bg-red-500 border-2 border-zinc-600" onClick={() => setExpandedSlice(null)}>
                                    <X size={24} />
                                </button>
                             </div>
                        ) : (
                            hasSlices ? (
                                <div className="grid w-full h-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                                    {image.slices!.map((s, i) => (
                                        <div key={i} className="relative group cursor-zoom-in" onClick={() => setExpandedSlice(s)}>
                                            <img src={s} className="w-full h-full object-cover border-[1px] border-black" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <Maximize2 size={40} className="text-white" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <img src={image.url} className="w-full h-full object-contain" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ConnectionLine = memo(({ start, end, startHeight, startWidth }: { start: {x:number, y:number}, end: {x:number, y:number}, startHeight: number, startWidth: number }) => {
    const sx = start.x + (startWidth / 2);
    const sy = start.y + startHeight; 
    const ex = end.x + (startWidth / 2);
    const ey = end.y;
    const verticalDist = Math.abs(ey - sy);
    const controlPointOffset = Math.max(verticalDist * 0.5, 60);
    const path = `M ${sx} ${sy} C ${sx} ${sy + controlPointOffset}, ${ex} ${ey - controlPointOffset}, ${ex} ${ey}`;
    return (
        <svg className="absolute top-0 left-0 pointer-events-none overflow-visible z-0" style={{ width: '1px', height: '1px' }}>
             <path d={path} stroke="#555" strokeWidth={3} fill="none" />
             <path d={path} stroke="#FF7A00" strokeWidth={3} fill="none" strokeDasharray="12 12" className="animate-flow" />
        </svg>
    );
});