
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Lock, Zap, ChevronDown, ChevronUp, Trash2, Box, Info } from 'lucide-react';
import { Button } from './Button';
import { LensLabParams, ImageSize, PanelAspectRatio, AspectRatio } from '../types';
import { fileToBase64 } from '../services/geminiService';

interface OmniViewLensLabProps {
  gridSize: number;
  imageSize: ImageSize;
  panelAspectRatio: PanelAspectRatio;
  containerAspectRatio: AspectRatio;
  onRenderSequence: (anchorImage: string, queue: LensLabParams[]) => void;
  isGenerating: boolean;
}

export const OmniViewLensLab: React.FC<OmniViewLensLabProps> = ({
  gridSize,
  imageSize,
  panelAspectRatio,
  containerAspectRatio,
  onRenderSequence,
  isGenerating
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorImage, setAnchorImage] = useState<string | null>(null);
  const [queue, setQueue] = useState<LensLabParams[]>([]);
  const [currentParams, setCurrentParams] = useState<LensLabParams>({
    focalLength: 35,
    pitch: 0,
    yaw: 0
  });

  const totalSlots = gridSize * gridSize;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-reset queue if grid size changes
  useEffect(() => {
    setQueue([]);
  }, [gridSize]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const b64 = await fileToBase64(file);
      setAnchorImage(`data:${file.type};base64,${b64}`);
    }
  };

  const handleLockShot = () => {
    if (queue.length < totalSlots) {
      setQueue([...queue, { ...currentParams }]);
    }
  };

  const handleClear = () => {
    setQueue([]);
    setAnchorImage(null);
  };

  const isQueueFull = queue.length === totalSlots;

  // 格式化俯仰角显示
  const getPitchLabel = (val: number) => {
    if (val === 0) return "平视 0°";
    return val > 0 ? `俯视 ${val}°` : `仰角 ${Math.abs(val)}°`;
  };

  // 格式化环绕角显示
  const getYawLabel = (val: number) => {
    if (val === 0) return "正前方 0°";
    return val > 0 ? `向右旋转 ${val}°` : `向左旋转 ${Math.abs(val)}°`;
  };

  return (
    <div className="border border-zinc-800 rounded-sm bg-zinc-900/40 backdrop-blur-md overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Camera size={14} className={`${isOpen ? 'text-cine-accent' : 'text-zinc-400'}`} />
          <span className={`text-[13px] font-mono font-bold uppercase tracking-[0.2em] ${isOpen ? 'text-zinc-100' : 'text-zinc-400'}`}>
            全方位镜头实验室 (OMNI-VIEW LENS LAB)
          </span>
        </div>
        {isOpen ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
      </button>

      {isOpen && (
        <div className="p-4 space-y-5 border-t border-zinc-800/50 animate-in fade-in slide-in-from-top-2">
          {/* Anchor Image Input */}
          <div className="space-y-3">
            <label className="text-[12px] text-zinc-400 font-mono uppercase tracking-widest flex items-center justify-between">
              锚点基准图 (ANCHOR IMAGE)
              {anchorImage && <button onClick={() => setAnchorImage(null)} className="text-red-500 hover:underline">移除</button>}
            </label>
            {!anchorImage ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-video border border-dashed border-zinc-800 rounded-sm flex flex-col items-center justify-center gap-2 hover:border-cine-accent/50 hover:bg-cine-accent/5 cursor-pointer transition-all"
              >
                <Upload size={18} className="text-zinc-500" />
                <span className="text-[12px] font-mono text-zinc-500">点击上传锚点图像</span>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
              </div>
            ) : (
              <div className="aspect-video relative rounded-sm overflow-hidden border border-zinc-700">
                <img src={anchorImage} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-cine-accent text-black text-[10px] font-bold font-mono rounded-[1px]">ANCHOR</div>
              </div>
            )}
          </div>

          {/* Slider Group */}
          <div className="space-y-4 pt-2">
             {/* Focal Length */}
             <div className="space-y-2">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Focal Length (焦段)</span>
                   <span className="text-[13px] text-cine-accent font-mono font-bold">{currentParams.focalLength}mm</span>
                </div>
                <input 
                  type="range" min="15" max="250" step="1" 
                  value={currentParams.focalLength}
                  onChange={(e) => setCurrentParams({...currentParams, focalLength: parseInt(e.target.value)})}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cine-accent"
                />
             </div>

             {/* Pitch */}
             <div className="space-y-2">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Camera Pitch (俯仰角)</span>
                   <span className="text-[13px] text-cine-accent font-mono font-bold">{getPitchLabel(currentParams.pitch)}</span>
                </div>
                <input 
                  type="range" min="-90" max="90" step="1" 
                  value={currentParams.pitch}
                  onChange={(e) => setCurrentParams({...currentParams, pitch: parseInt(e.target.value)})}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cine-accent"
                />
             </div>

             {/* Yaw */}
             <div className="space-y-2">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Camera Yaw (环绕角)</span>
                   <span className="text-[13px] text-cine-accent font-mono font-bold">{getYawLabel(currentParams.yaw)}</span>
                </div>
                <input 
                  type="range" min="-180" max="180" step="1" 
                  value={currentParams.yaw}
                  onChange={(e) => setCurrentParams({...currentParams, yaw: parseInt(e.target.value)})}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cine-accent"
                />
             </div>
          </div>

          {/* Queue Status */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-end">
               <span className="text-[12px] text-zinc-400 font-mono uppercase tracking-widest">装填进度 (QUEUE)</span>
               <span className="text-[13px] text-zinc-200 font-mono font-bold">{queue.length} / {totalSlots}</span>
            </div>
            <div className="flex gap-1 h-1">
               {[...Array(totalSlots)].map((_, i) => (
                 <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${i < queue.length ? 'bg-cine-accent' : 'bg-zinc-800'}`}></div>
               ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
             <Button 
                variant="primary" size="sm" className="w-full h-10 border-dashed"
                disabled={!anchorImage || isQueueFull}
                onClick={handleLockShot}
             >
                <Lock size={12} className="mr-2" />
                {isQueueFull ? '参数已填满' : `锁定参数: ${getPitchLabel(currentParams.pitch)}, ${getYawLabel(currentParams.yaw)}`}
             </Button>

             <Button 
                variant="accent" size="md" className="w-full h-12 shadow-[0_0_20px_rgba(255,122,0,0.2)]"
                disabled={!anchorImage || !isQueueFull || isGenerating}
                onClick={() => anchorImage && onRenderSequence(anchorImage, queue)}
             >
                {isGenerating ? <Zap size={14} className="animate-spin mr-2" /> : <Zap size={14} className="mr-2" />}
                执行多角度渲染 (RENDER SEQUENCE)
             </Button>
             
             {queue.length > 0 && (
               <button onClick={handleClear} className="w-full text-center text-[12px] text-zinc-500 hover:text-red-500 font-mono uppercase py-2 flex items-center justify-center gap-2">
                 <Trash2 size={10} /> 重置实验参数
               </button>
             )}
          </div>

          <div className="p-3 bg-black/40 rounded-sm border border-zinc-800 flex items-start gap-3">
             <Info size={14} className="text-zinc-500 mt-0.5" />
             <p className="text-[12px] text-zinc-500 font-mono leading-relaxed">
               镜头参数已锁定。向左滑动俯仰角为仰拍，向右为俯拍；环绕角向左旋转模拟左侧视角。
             </p>
          </div>
        </div>
      )}
    </div>
  );
};
