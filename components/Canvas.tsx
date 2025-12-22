
import React, { useState, useRef, useLayoutEffect } from 'react';
import { GeneratedImage, Asset } from '../types';
import { Trash2, Archive, LayoutGrid, List, UploadCloud, MonitorPlay, Workflow, Type, Images, Video, X, Maximize2, ArrowLeft } from 'lucide-react';
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
}

const Node: React.FC<NodeProps> = ({ image, selected, onSelect, onDelete, onMouseDown, allAssets, onHeightChange }) => {
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
            case 'render': return 'bg-cine-panel border-cine-accent/30';
            default: return 'bg-zinc-800';
        }
    };

    const getIcon = () => {
        switch (image.nodeType) {
            case 'render': return <MonitorPlay size={10} />;
            default: return null;
        }
    };

    const getLabel = () => {
        switch (image.nodeType) {
            case 'render': return '场景故事板 (BOARD)';
            default: return '分镜节点';
        }
    };

    const width = 320;
    const isRenderNode = image.nodeType === 'render';
    const hasSlices = isRenderNode && image.slices && image.slices.length > 0;
    const cols = image.gridCols || 2;

    return (
        <div 
            ref={nodeRef}
            className={`absolute group bg-zinc-950 border rounded-md shadow-2xl transition-shadow duration-300 ${
                selected ? 'border-cine-accent ring-1 ring-cine-accent/50 z-30' : 'border-zinc-800 hover:border-zinc-600 z-10'
            }`}
            style={{ 
                left: image.position?.x || 0, 
                top: image.position?.y || 0,
                width: width,
            }}
            onMouseDown={(e) => {
                e.stopPropagation(); 
                onMouseDown(e); 
                onSelect();
            }}
        >
            <div className={`px-3 py-2 border-b flex justify-between items-center rounded-t-md cursor-grab active:cursor-grabbing ${getHeaderColor()}`}>
                 <div className="flex items-center gap-2 text-zinc-300">
                     {getIcon()}
                     <span className="text-[9px] font-mono uppercase tracking-wider font-bold">
                         {getLabel()}
                     </span>
                 </div>
                 <div className="flex items-center gap-2">
                     {expandedSlice && (
                         <button onClick={(e) => { e.stopPropagation(); setExpandedSlice(null); }} className="text-cine-accent hover:text-white">
                             <LayoutGrid size={12} />
                         </button>
                     )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="text-zinc-500 hover:text-red-500 transition-colors"
                        title="删除节点"
                    >
                        <Trash2 size={12} />
                    </button>
                 </div>
            </div>

            <div className="p-2 bg-black/80">
                {image.nodeType === 'render' && (
                    <div className="space-y-2">
                        {image.textData && (
                             <div className="p-2 bg-zinc-900/50 rounded-sm border border-zinc-800/50">
                                 <div className="flex items-center gap-1.5 mb-1 opacity-50">
                                     <Type size={8} />
                                     <span className="text-[8px] font-mono uppercase tracking-wider">创作指令</span>
                                 </div>
                                 <p className="text-[10px] text-zinc-300 font-mono leading-relaxed line-clamp-4">
                                     {image.textData}
                                 </p>
                             </div>
                        )}

                        <div 
                            className="relative w-full bg-zinc-900 rounded-sm border border-zinc-800 overflow-hidden"
                            style={{ aspectRatio: image.aspectRatio ? image.aspectRatio.replace(':', '/') : '16/9' }}
                        >
                            {expandedSlice ? (
                                <div className="w-full h-full relative group/expanded">
                                    <img src={expandedSlice} className="w-full h-full object-contain bg-black" alt="展开" />
                                    <button 
                                        className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded hover:bg-red-500 transition-colors"
                                        onClick={(e) => {e.stopPropagation(); setExpandedSlice(null);}}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                hasSlices ? (
                                    <div 
                                        className="grid w-full h-full gap-[1px] bg-black"
                                        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                                    >
                                        {image.slices!.map((sliceUrl, idx) => (
                                            <div 
                                                key={idx} 
                                                className="relative w-full h-full overflow-hidden cursor-pointer group/slice"
                                                onClick={(e) => { e.stopPropagation(); setExpandedSlice(sliceUrl); }}
                                            >
                                                <img src={sliceUrl} className="w-full h-full object-cover hover:scale-110 transition-transform duration-300" />
                                                <div className="absolute inset-0 bg-white/0 group-hover/slice:bg-white/10 transition-colors pointer-events-none" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <img src={image.url} className="w-full h-full object-cover" alt="Node" draggable={false} />
                                )
                            )}
                        </div>

                        {image.cameraDescription && (
                            <div className="flex items-start gap-2 p-2 bg-cine-accent/5 border border-cine-accent/20 rounded-[2px]">
                                <Video size={12} className="text-cine-accent mt-0.5 flex-shrink-0" />
                                <p className="text-[9px] text-zinc-300 font-mono leading-relaxed">
                                    <span className="text-cine-accent/70 uppercase">镜头运动:</span> {image.cameraDescription}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-zinc-400 rounded-full border-2 border-zinc-950 group-hover:bg-cine-accent transition-colors z-20"></div>
        </div>
    );
};

const ConnectionLine: React.FC<{ start: {x:number, y:number}, end: {x:number, y:number}, startHeight: number, startWidth: number }> = ({ start, end, startHeight, startWidth }) => {
    const sx = start.x + (startWidth / 2);
    const sy = start.y + startHeight; 
    const ex = end.x + (startWidth / 2);
    const ey = end.y;
    const verticalDist = Math.abs(ey - sy);
    const controlPointOffset = Math.max(verticalDist * 0.5, 50);
    const path = `M ${sx} ${sy} C ${sx} ${sy + controlPointOffset}, ${ex} ${ey - controlPointOffset}, ${ex} ${ey}`;
    return (
        <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '1px', height: '1px', overflow: 'visible', zIndex: 0 }}>
             <path d={path} stroke="#333" strokeWidth={2} fill="none" />
             <path d={path} stroke="#FF7A00" strokeWidth={2} fill="none" strokeDasharray="10 10" className="animate-flow" />
             <style>{`@keyframes flow { from { stroke-dashoffset: 20; } to { stroke-dashoffset: 0; } } .animate-flow { animation: flow 1s linear infinite; }`}</style>
        </svg>
    );
};

const DetailViewOverlay: React.FC<{ image: GeneratedImage; onClose: () => void }> = ({ image, onClose }) => {
    const [expandedSlice, setExpandedSlice] = useState<string | null>(null);
    const hasSlices = image.slices && image.slices.length > 0;
    const cols = image.gridCols || 2;
    return (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col animate-in fade-in duration-200">
            <div className="h-14 px-6 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50">
                <button onClick={onClose} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs font-mono uppercase tracking-wider">
                    <ArrowLeft size={16} /> 返回 (Back)
                </button>
                <span className="text-white text-xs font-bold">{image.prompt.substring(0, 50)}...</span>
            </div>
            <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
                <div 
                    className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-800 shadow-2xl rounded-sm overflow-hidden"
                    style={{ aspectRatio: image.aspectRatio ? image.aspectRatio.replace(':', '/') : '16/9', maxHeight: '85vh' }}
                >
                    {expandedSlice ? (
                         <div className="w-full h-full relative group">
                            <img src={expandedSlice} className="w-full h-full object-contain bg-black" alt="Expanded" />
                            <button className="absolute top-4 right-4 bg-black/50 hover:bg-red-500 text-white p-2 rounded-full" onClick={() => setExpandedSlice(null)}>
                                <X size={20} />
                            </button>
                         </div>
                    ) : (
                        hasSlices ? (
                            <div className="grid w-full h-full gap-[2px] bg-black" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                                {image.slices!.map((sliceUrl, idx) => (
                                    <div key={idx} className="relative w-full h-full overflow-hidden cursor-pointer group/slice" onClick={() => setExpandedSlice(sliceUrl)}>
                                        <img src={sliceUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover/slice:scale-105" />
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
    );
};

export const Canvas: React.FC<CanvasProps> = ({ images, assets, onSelect, selectedId, onDelete, onUpdateNodePosition, onDownloadAll, onDeselectAll }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('workflow');
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  const [detailViewItem, setDetailViewItem] = useState<GeneratedImage | null>(null);

  const handleHeightChange = (id: string, height: number) => {
      setNodeHeights(prev => (prev[id] === height ? prev : { ...prev, [id]: height }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (e.target === containerRef.current) {
        setIsDraggingCanvas(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        if (onDeselectAll) onDeselectAll();
      }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
      setDraggingNodeId(id);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (isDraggingCanvas) {
          setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      } else if (draggingNodeId) {
          const image = images.find(i => i.id === draggingNodeId);
          if (image && image.position) {
              onUpdateNodePosition(draggingNodeId, image.position.x + dx / scale, image.position.y + dy / scale);
          }
      }
  };

  const handleMouseUp = () => { setIsDraggingCanvas(false); setDraggingNodeId(null); };

  const handleWheel = (e: React.WheelEvent) => {
      if (viewMode !== 'workflow' || !containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newScale = Math.min(Math.max(0.2, scale - e.deltaY * 0.001), 3);
      const worldX = (mouseX - pan.x) / scale;
      const worldY = (mouseY - pan.y) / scale;
      setScale(newScale);
      setPan({ x: mouseX - worldX * newScale, y: mouseY - worldY * newScale });
  };

  return (
    <div className="flex flex-col h-full bg-black relative">
      {detailViewItem && <DetailViewOverlay image={detailViewItem} onClose={() => setDetailViewItem(null)} />}
      <div className="absolute top-0 left-0 right-0 h-14 px-6 flex items-center justify-between z-20 bg-gradient-to-b from-black to-transparent pointer-events-none">
         <div className="pointer-events-auto">
             <span className="text-cine-text-muted text-[10px] uppercase tracking-[0.2em] font-mono font-bold">
               创作画布 / {images.filter(i => i.nodeType === 'render').length} 个分镜任务
             </span>
         </div>
         <div className="flex items-center gap-2 pointer-events-auto">
             <div className="flex bg-zinc-900/80 rounded-sm p-0.5 border border-zinc-800 backdrop-blur-sm mr-4">
                 <button onClick={() => setViewMode('workflow')} className={`p-1.5 px-3 rounded-[1px] transition-all flex items-center gap-2 ${viewMode === 'workflow' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                     <Workflow size={14} />
                     <span className="text-[10px] font-mono">工作流</span>
                 </button>
                 <button onClick={() => setViewMode('grid')} className={`p-1.5 px-3 rounded-[1px] transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                     <LayoutGrid size={14} />
                     <span className="text-[10px] font-mono">网格</span>
                 </button>
             </div>
             {images.length > 0 && (
                 <Button variant="ghost" size="sm" onClick={onDownloadAll} className="flex items-center gap-2 border border-zinc-800 bg-black/50 backdrop-blur hover:bg-zinc-800 text-[10px] h-7">
                     <Archive size={12} />
                     <span className="uppercase tracking-wider">打包下载 ZIP</span>
                 </Button>
             )}
         </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-[#050505]">
        {images.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-10 select-none animate-in fade-in duration-500 z-10 relative text-center">
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-3 mb-4">
                    <div className="w-3 h-3 bg-cine-accent rounded-sm shadow-[0_0_15px_rgba(255,122,0,0.6)]"></div>
                    橙意机构 影视分镜系统
                </h1>
                <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">
                    专业的影视视觉辅助工具。支持动态宫格配置、智能镜头分析及高保真资产一致性生成。
                </p>
            </div>
        ) : (
            <>
                {viewMode === 'workflow' && (
                    <div className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing" ref={containerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel}>
                         <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: `${20 * scale}px ${20 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />
                         <div className="absolute origin-top-left transition-transform duration-75" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
                             {images.map(img => {
                                 if (img.parentId) {
                                     const parent = images.find(p => p.id === img.parentId);
                                     if (parent && parent.position && img.position) {
                                         return <ConnectionLine key={`link-${parent.id}-${img.id}`} start={parent.position} end={img.position} startWidth={320} startHeight={nodeHeights[parent.id] || 200} />
                                     }
                                 }
                                 return null;
                             })}
                             {images.map(img => (
                                 <Node key={img.id} image={img} allAssets={assets} selected={selectedId === img.id} onSelect={() => onSelect(img)} onDelete={() => onDelete(img.id)} onMouseDown={(e) => handleNodeMouseDown(e, img.id)} onHeightChange={handleHeightChange} />
                             ))}
                         </div>
                    </div>
                )}
                {(viewMode === 'grid') && (
                    <div className="h-full overflow-y-auto p-6 pt-20 custom-scrollbar">
                        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-start">
                            {images.filter(i => i.nodeType === 'render').map((img) => (
                                <div key={img.id} className={`group relative bg-zinc-900 border transition-all duration-200 cursor-pointer overflow-hidden rounded-sm ${selectedId === img.id ? 'border-cine-accent ring-1 ring-cine-accent/50' : 'border-zinc-800 hover:border-zinc-600'}`} onClick={() => { onSelect(img); setDetailViewItem(img); }}>
                                    <div className="w-full relative aspect-video pointer-events-none">
                                        <img src={img.url} alt="node" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="p-2">
                                        <p className="text-zinc-300 text-[10px] font-mono line-clamp-2">{img.prompt}</p>
                                    </div>
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
