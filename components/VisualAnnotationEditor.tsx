
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Square, Circle, Pencil, MoveUpRight, Check, Palette, Type, MousePointer2, Eraser, Trash2, ArrowRight } from 'lucide-react';
import { Button } from './Button';

interface Shape {
  id: string;
  type: 'rect' | 'ellipse' | 'path' | 'arrow';
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface VisualAnnotationEditorProps {
  imageUrl: string;
  onClose: () => void;
  onConfirm: (mergedBase64: string) => void;
}

export const VisualAnnotationEditor: React.FC<VisualAnnotationEditorProps> = ({ imageUrl, onClose, onConfirm }) => {
  const [tool, setTool] = useState<'rect' | 'ellipse' | 'path' | 'arrow'>('rect');
  const [color, setColor] = useState('#FF0000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const colors = ['#FF0000', '#00FF00', '#00FFFF', '#FFFF00', '#FFFFFF', '#FF00FF'];

  // Calculate scaling to fit image while maintaining native resolution logic
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0, top: 0, left: 0, scale: 1 });

  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const iw = img.width;
      const ih = img.height;
      
      const scale = Math.min(cw / iw, ch / ih) * 0.9;
      const dw = iw * scale;
      const dh = ih * scale;
      
      setImageLayout({
        width: dw,
        height: dh,
        left: (cw - dw) / 2,
        top: (ch - dh) / 2,
        scale
      });
    };
  }, [imageUrl]);

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (clientX - rect.left),
      y: (clientY - rect.top)
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const pos = getMousePos(e);
    setCurrentPoints([pos]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    if (tool === 'path') {
      setCurrentPoints(prev => [...prev, pos]);
    } else {
      setCurrentPoints(prev => [prev[0], pos]);
    }
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Only save shape if it has enough points for its type
    const minPoints = (tool === 'path') ? 1 : 2;
    if (currentPoints.length >= minPoints) {
      const newShape: Shape = {
        id: crypto.randomUUID(),
        type: tool,
        points: [...currentPoints],
        color,
        width: strokeWidth
      };
      setShapes([...shapes, newShape]);
    }
    setCurrentPoints([]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawShape = (shape: Shape | { type: string, points: {x:number, y:number}[], color: string, width: number }) => {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const p = shape.points;
      if (!p || p.length < 1) return;

      if (shape.type === 'rect') {
        if (p.length < 2) return;
        ctx.strokeRect(p[0].x, p[0].y, p[1].x - p[0].x, p[1].y - p[0].y);
      } else if (shape.type === 'ellipse') {
        if (p.length < 2) return;
        const rx = Math.abs(p[1].x - p[0].x) / 2;
        const ry = Math.abs(p[1].y - p[0].y) / 2;
        const cx = (p[0].x + p[1].x) / 2;
        const cy = (p[0].y + p[1].y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.type === 'path') {
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
        ctx.stroke();
      } else if (shape.type === 'arrow') {
        if (p.length < 2) return;
        // Draw start circle
        ctx.beginPath();
        ctx.arc(p[0].x, p[0].y, shape.width * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.stroke();

        // Draw arrow head
        const angle = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
        const headLen = shape.width * 4;
        ctx.beginPath();
        ctx.moveTo(p[1].x, p[1].y);
        ctx.lineTo(p[1].x - headLen * Math.cos(angle - Math.PI / 6), p[1].y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(p[1].x - headLen * Math.cos(angle + Math.PI / 6), p[1].y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    };

    shapes.forEach(drawShape);
    if (isDrawing && currentPoints.length > 0) {
      drawShape({ type: tool, points: currentPoints, color, width: strokeWidth });
    }
  }, [shapes, isDrawing, currentPoints, tool, color, strokeWidth]);

  const handleFlattenAndConfirm = () => {
    const finalCanvas = document.createElement('canvas');
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      finalCanvas.width = img.width;
      finalCanvas.height = img.height;
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) return;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Draw all shapes scaled to original resolution
      const scale = 1 / imageLayout.scale;
      shapes.forEach(shape => {
        if (!shape.points || shape.points.length < 1) return;

        ctx.strokeStyle = shape.color;
        ctx.fillStyle = shape.color;
        ctx.lineWidth = shape.width * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const p = shape.points.map(pt => ({ x: pt.x * scale, y: pt.y * scale }));
        
        if (shape.type === 'rect') {
          if (p.length < 2) return;
          ctx.strokeRect(p[0].x, p[0].y, p[1].x - p[0].x, p[1].y - p[0].y);
        } else if (shape.type === 'ellipse') {
          if (p.length < 2) return;
          const rx = Math.abs(p[1].x - p[0].x) / 2;
          const ry = Math.abs(p[1].y - p[0].y) / 2;
          const cx = (p[0].x + p[1].x) / 2;
          const cy = (p[0].y + p[1].y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (shape.type === 'path') {
          ctx.beginPath();
          ctx.moveTo(p[0].x, p[0].y);
          p.forEach(pt => ctx.lineTo(pt.x, pt.y));
          ctx.stroke();
        } else if (shape.type === 'arrow') {
          if (p.length < 2) return;
          ctx.beginPath();
          ctx.arc(p[0].x, p[0].y, (shape.width * scale) * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(p[0].x, p[0].y);
          ctx.lineTo(p[1].x, p[1].y);
          ctx.stroke();
          const angle = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
          const headLen = (shape.width * scale) * 4;
          ctx.beginPath();
          ctx.moveTo(p[1].x, p[1].y);
          ctx.lineTo(p[1].x - headLen * Math.cos(angle - Math.PI / 6), p[1].y - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(p[1].x - headLen * Math.cos(angle + Math.PI / 6), p[1].y - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }
      });

      onConfirm(finalCanvas.toDataURL('image/png'));
    };
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/98 flex flex-col animate-in fade-in duration-300 overflow-hidden" ref={containerRef}>
      {/* Top Toolbar */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
            <X size={18} /> 返回监视器
          </button>
          <div className="h-6 w-[1px] bg-zinc-700"></div>
          <div className="flex gap-1.5">
            <ToolBtn active={tool === 'rect'} onClick={() => setTool('rect')} icon={<Square size={16} />} label="矩形" />
            <ToolBtn active={tool === 'ellipse'} onClick={() => setTool('ellipse')} icon={<Circle size={16} />} label="椭圆" />
            <ToolBtn active={tool === 'path'} onClick={() => setTool('path')} icon={<Pencil size={16} />} label="手动" />
            <ToolBtn active={tool === 'arrow'} onClick={() => setTool('arrow')} icon={<MoveUpRight size={16} />} label="箭头" />
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
             <span className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-widest">粗细</span>
             <input type="range" min="1" max="10" step="1" value={strokeWidth} onChange={(e) => setStrokeWidth(parseInt(e.target.value))} className="w-24 accent-cine-accent" />
          </div>
          <div className="flex gap-2">
            {colors.map(c => (
              <button 
                key={c} 
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-white scale-125' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="h-6 w-[1px] bg-zinc-700"></div>
          <button onClick={() => setShapes([])} className="text-zinc-500 hover:text-red-400 p-2"><Trash2 size={18} /></button>
          <Button variant="accent" size="sm" onClick={handleFlattenAndConfirm} className="gap-2 px-6">
            <Check size={16} /> 确定标注并重绘
          </Button>
        </div>
      </div>

      {/* Editor Canvas Area */}
      <div className="flex-1 relative cursor-crosshair flex items-center justify-center p-8 select-none">
        {imageLayout.width > 0 && (
          <div 
            style={{ 
              width: imageLayout.width, 
              height: imageLayout.height, 
              position: 'relative',
              boxShadow: '0 0 50px rgba(0,0,0,0.5)'
            }}
          >
            <img src={imageUrl} className="w-full h-full object-contain pointer-events-none" alt="Editor Base" />
            <canvas
              ref={canvasRef}
              width={imageLayout.width}
              height={imageLayout.height}
              className="absolute inset-0 z-10"
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-zinc-800 text-[10px] text-zinc-500 font-mono tracking-widest flex items-center gap-3">
        <MousePointer2 size={12} className="text-cine-accent" />
        点击并拖动以在分镜中创建视觉引导标注
      </div>
    </div>
  );
};

const ToolBtn = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-2 rounded-sm transition-all min-w-[48px] ${active ? 'bg-cine-accent text-black shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
  >
    {icon}
    <span className="text-[8px] font-bold uppercase font-mono">{label}</span>
  </button>
);
