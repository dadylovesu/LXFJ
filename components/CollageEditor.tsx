
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, LayoutGrid, GripHorizontal, Image as ImageIcon, Trash2, Plus, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { Button } from './Button';
import { AspectRatio } from '../types';

interface CollageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (base64Url: string, rows: number, cols: number, aspectRatio: string) => void;
  defaultAspectRatio?: string;
}

export const CollageEditor: React.FC<CollageEditorProps> = ({ 
  isOpen, 
  onClose, 
  onSave,
  defaultAspectRatio = '16:9'
}) => {
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [slots, setSlots] = useState<(File | null)[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const totalSlots = rows * cols;
    setSlots(prev => {
        const newSlots = new Array(totalSlots).fill(null);
        for(let i=0; i<Math.min(prev.length, totalSlots); i++) {
            newSlots[i] = prev[i];
        }
        return newSlots;
    });
  }, [rows, cols]);

  if (!isOpen) return null;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    const newSlots = [...slots];
    const temp = newSlots[index];
    newSlots[index] = newSlots[draggedIndex];
    newSlots[draggedIndex] = temp;
    setSlots(newSlots);
    setDraggedIndex(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles = Array.from(e.target.files);
          setSlots(prev => {
              const next = [...prev];
              let fileIdx = 0;
              for (let i = 0; i < next.length && fileIdx < newFiles.length; i++) {
                  if (next[i] === null) {
                      next[i] = newFiles[fileIdx];
                      fileIdx++;
                  }
              }
              return next;
          });
      }
      e.target.value = ''; 
  };

  const handleRemoveSlot = (index: number) => {
      setSlots(prev => {
          const next = [...prev];
          next[index] = null;
          return next;
      });
  };

  const handleSave = async () => {
      const activeSlots = slots.map((f, i) => ({ file: f, index: i })).filter(s => s.file !== null);
      if (activeSlots.length === 0) return;

      const canvas = document.createElement('canvas');
      const baseSize = 2048; 
      // We use a square base canvas for the transport grid to prevent distortion
      canvas.width = baseSize;
      canvas.height = baseSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill background to clearly separate slots if contain leaves gaps
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const slotW = canvas.width / cols;
      const slotH = canvas.height / rows;

      const loadImg = (file: File): Promise<HTMLImageElement> => new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = URL.createObjectURL(file);
      });

      for (let i = 0; i < slots.length; i++) {
          const file = slots[i];
          if (!file) continue;
          
          const img = await loadImg(file);
          const r = Math.floor(i / cols);
          const c = i % cols;
          
          const dx = c * slotW;
          const dy = r * slotH;
          
          // Use "CONTAIN" logic so the full reference is visible for camera angle recognition
          const imgRatio = img.width / img.height;
          const targetRatio = slotW / slotH;
          let dw, dh, offsetX, offsetY;
          
          if (imgRatio > targetRatio) {
              dw = slotW;
              dh = slotW / imgRatio;
              offsetX = 0;
              offsetY = (slotH - dh) / 2;
          } else {
              dh = slotH;
              dw = slotH * imgRatio;
              offsetX = (slotW - dw) / 2;
              offsetY = 0;
          }
          
          ctx.drawImage(img, 0, 0, img.width, img.height, dx + offsetX, dy + offsetY, dw, dh);
          
          // ADD SPATIAL INDEX LABEL TO HELP AI VISION (1:1 Correspondence)
          ctx.fillStyle = 'rgba(255, 122, 0, 0.9)';
          ctx.fillRect(dx + 10, dy + 10, 100, 100);
          ctx.fillStyle = 'white';
          ctx.font = 'bold 60px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((i + 1).toString(), dx + 60, dy + 60);
          
          // DRAW PANEL BORDERS FOR CLARITY
          ctx.strokeStyle = '#333333';
          ctx.lineWidth = 4;
          ctx.strokeRect(dx, dy, slotW, slotH);
      }

      // Use '1:1' as internal transport AR
      onSave(canvas.toDataURL('image/png'), rows, cols, '1:1');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-cine-dark border border-zinc-800 w-full max-w-6xl rounded-lg shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-md bg-cine-accent flex items-center justify-center shadow-[0_0_20px_rgba(255,122,0,0.3)]">
                  <LayoutGrid size={22} className="text-black" />
               </div>
               <div>
                  <h2 className="text-white font-mono uppercase tracking-[0.25em] text-sm font-bold">
                    镜头组参考编辑器 (SHOT GROUP EDITOR)
                  </h2>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5 uppercase tracking-widest">Create structural references to guide camera angles</p>
               </div>
            </div>
            <button onClick={onClose} className="text-zinc-600 hover:text-white transition-all hover:rotate-90 duration-300">
                <X size={20} />
            </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            <div className="w-72 border-r border-zinc-800 p-6 space-y-8 bg-zinc-900/30 overflow-y-auto custom-scrollbar">
                
                {/* Layout Select */}
                <div className="space-y-4">
                    <label className="text-[10px] uppercase text-zinc-500 font-bold tracking-[0.2em] flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-cine-accent rounded-full"></span>
                       网格布局 (GRID LAYOUT)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => { setRows(2); setCols(2); }}
                            className={`flex flex-col items-center gap-2 p-3 border rounded-sm transition-all ${rows === 2 && cols === 2 ? 'border-cine-accent bg-cine-accent/5' : 'border-zinc-800 bg-black/40 hover:border-zinc-700'}`}
                        >
                            <LayoutGrid size={20} className={rows === 2 && cols === 2 ? 'text-cine-accent' : 'text-zinc-700'} />
                            <span className={`text-[10px] font-mono ${rows === 2 && cols === 2 ? 'text-cine-accent' : 'text-zinc-600'}`}>2x2 (4图)</span>
                        </button>
                        <button 
                            onClick={() => { setRows(3); setCols(3); }}
                            className={`flex flex-col items-center gap-2 p-3 border rounded-sm transition-all ${rows === 3 && cols === 3 ? 'border-cine-accent bg-cine-accent/5' : 'border-zinc-800 bg-black/40 hover:border-zinc-700'}`}
                        >
                            <div className="grid grid-cols-3 gap-0.5">
                                {[...Array(9)].map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-[1px] ${rows === 3 && cols === 3 ? 'bg-cine-accent' : 'bg-zinc-700'}`}></div>)}
                            </div>
                            <span className={`text-[10px] font-mono ${rows === 3 && cols === 3 ? 'text-cine-accent' : 'text-zinc-600'}`}>3x3 (9图)</span>
                        </button>
                    </div>
                </div>

                {/* Info Text */}
                <div className="space-y-4">
                    <label className="text-[10px] uppercase text-zinc-500 font-bold tracking-[0.2em] flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-cine-accent rounded-full"></span>
                       注意事项 (NOTICE)
                    </label>
                    <p className="text-[9px] text-zinc-500 font-mono leading-relaxed bg-black/40 p-3 rounded-sm border border-zinc-800">
                        系统将严格按照 <span className="text-cine-accent">从左到右、从上到下</span> 的顺序，将参考图的构图映射到生成结果中。
                    </p>
                </div>

                {/* File Action */}
                <div className="pt-6 border-t border-zinc-800 space-y-4">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-sm text-[11px] font-mono font-bold flex items-center justify-center gap-3 transition-all uppercase tracking-widest shadow-lg"
                    >
                        <Plus size={16} /> 添加参考图
                    </button>
                    <p className="text-[9px] text-zinc-600 font-mono text-center leading-relaxed">
                        支持拖拽排序。
                    </p>
                    <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileSelect} />
                </div>
            </div>

            <div className="flex-1 bg-black/60 p-12 flex items-center justify-center overflow-auto relative">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                <div 
                    className="bg-zinc-900 border border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative transition-all duration-500 ease-out"
                    style={{ width: '100%', maxWidth: '700px', aspectRatio: '1/1' }}
                >
                    <div 
                        className="grid w-full h-full gap-[2px] bg-zinc-950"
                        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                    >
                        {slots.map((file, index) => (
                            <div 
                                key={index}
                                className={`relative group border border-dashed border-zinc-800/50 flex items-center justify-center overflow-hidden transition-colors ${draggedIndex === index ? 'opacity-40' : 'opacity-100'} ${!file ? 'hover:bg-cine-accent/5 hover:border-cine-accent/30' : 'bg-black'}`}
                                draggable={!!file}
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={(e) => handleDrop(e, index)}
                            >
                                {file ? (
                                    <>
                                        <img src={URL.createObjectURL(file)} alt={`slot-${index}`} className="w-full h-full object-contain pointer-events-none group-hover:scale-105 transition-transform duration-700" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                            <GripHorizontal size={24} className="text-white cursor-grab active:cursor-grabbing mb-1" />
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleRemoveSlot(index); }} 
                                              className="bg-red-500/80 p-2 rounded-full text-white hover:bg-red-500 transition-colors shadow-lg"
                                            >
                                              <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-cine-accent/90 rounded-[1px] text-black font-mono text-[9px] font-bold tracking-widest pointer-events-none shadow-md">
                                            SLOT {String(index + 1).padStart(2, '0')}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-zinc-800 group-hover:text-zinc-600 transition-colors">
                                        <ImageIcon size={24} strokeWidth={1} />
                                        <span className="text-[10px] font-mono uppercase tracking-[0.2em]">{String(index + 1).padStart(2, '0')}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/60 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${slots.filter(s => s !== null).length === slots.length ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    ACTIVE: {slots.filter(s => s !== null).length} / {slots.length} REF SLOTS
                </span>
            </div>
            <div className="flex gap-4">
                <Button 
                    variant="ghost" 
                    onClick={onClose} 
                    className="px-8 h-12 text-[11px] font-bold text-zinc-400 hover:text-white border border-zinc-800"
                >
                    取消 (CANCEL)
                </Button>
                <Button 
                    variant="accent" 
                    onClick={handleSave} 
                    disabled={slots.every(s => s === null)} 
                    className="px-12 h-12 text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(255,122,0,0.4)]"
                >
                    <Check size={18} className="mr-3" /> 应用镜头组参考 (APPLY)
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};
