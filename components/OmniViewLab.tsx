
import React, { useState, useRef } from 'react';
import { Camera, X, Lock, Play, Trash2, Sliders, Layers, Info, UploadCloud, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './Button';
import { CameraParams } from '../types';

interface OmniViewLabProps {
  gridCount: number;
  onRender: (anchorBase64: string, params: CameraParams[]) => void;
  isRendering: boolean;
}

export const OmniViewLab: React.FC<OmniViewLabProps> = ({ gridCount, onRender, isRendering }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorImage, setAnchorImage] = useState<string | null>(null);
  const [paramsQueue, setParamsQueue] = useState<CameraParams[]>([]);
  const [currentParams, setCurrentParams] = useState<CameraParams>({ focalLength: 35, pitch: 0, yaw: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
          setAnchorImage(ev.target?.result as string);
          setParamsQueue([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const lockShot = () => {
    if (paramsQueue.length < gridCount) {
      setParamsQueue([...paramsQueue, { ...currentParams }]);
    }
  };

  const resetQueue = () => {
    setParamsQueue([]);
  };

  const isFull = paramsQueue.length >= gridCount;

  return (
    <div className="relative z-50 mb-4">
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full py-3 px-4 rounded-sm border transition-all flex items-center justify-between group ${
            isOpen ? 'bg-cine-accent text-black border-cine-accent font-bold' : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-cine-accent/50 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2.5">
            <Camera size={14} className={isOpen ? 'animate-pulse' : ''} />
            <span className="text-[10px] uppercase tracking-[0.2em] font-mono">Omni-View Lens Lab</span>
        </div>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Lab Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 p-5 bg-zinc-950/95 backdrop-blur-xl border border-cine-accent/30 rounded-sm shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-6">
                
                {/* Anchor Image Slot */}
                <div className="space-y-3">
                    <label className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest flex items-center gap-2">
                        <Layers size={12} /> Anchor Image (锚点图像)
                    </label>
                    <div 
                        onClick={() => !anchorImage && fileInputRef.current?.click()}
                        className={`aspect-video rounded-sm border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${
                            anchorImage ? 'border-zinc-800' : 'border-zinc-800 hover:border-cine-accent/50 bg-black/40'
                        }`}
                    >
                        {anchorImage ? (
                            <>
                                <img src={anchorImage} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button onClick={(e) => { e.stopPropagation(); setAnchorImage(null); }} className="p-2 bg-red-500 rounded-full text-white"><Trash2 size={16} /></button>
                                </div>
                            </>
                        ) : (
                            <>
                                <UploadCloud size={24} className="text-zinc-700 mb-2" />
                                <span className="text-[9px] font-mono text-zinc-600">点击上传参考锚点图</span>
                            </>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
                    </div>
                </div>

                {anchorImage && (
                    <>
                        {/* Control Sliders */}
                        <div className="space-y-5 p-4 bg-zinc-900/40 border border-zinc-800/40 rounded-sm">
                            {/* Focal Length */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-mono">
                                    <span className="text-zinc-500 uppercase tracking-widest">Focal Length (焦段)</span>
                                    <span className="text-cine-accent font-bold">{currentParams.focalLength}mm</span>
                                </div>
                                <input 
                                    type="range" min="15" max="250" step="5"
                                    value={currentParams.focalLength}
                                    onChange={(e) => setCurrentParams({...currentParams, focalLength: parseInt(e.target.value)})}
                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cine-accent"
                                />
                                <div className="flex justify-between text-[7px] text-zinc-700 font-mono">
                                    <span>WIDE</span>
                                    <span>TELE</span>
                                </div>
                            </div>

                            {/* Pitch */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-mono">
                                    <span className="text-zinc-500 uppercase tracking-widest">Camera Pitch (仰/俯)</span>
                                    <span className="text-cine-accent font-bold">{currentParams.pitch}°</span>
                                </div>
                                <input 
                                    type="range" min="-180" max="180" step="15"
                                    value={currentParams.pitch}
                                    onChange={(e) => setCurrentParams({...currentParams, pitch: parseInt(e.target.value)})}
                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cine-accent"
                                />
                            </div>

                            {/* Yaw */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-mono">
                                    <span className="text-zinc-500 uppercase tracking-widest">Camera Yaw (环绕)</span>
                                    <span className="text-cine-accent font-bold">{currentParams.yaw}°</span>
                                </div>
                                <input 
                                    type="range" min="-180" max="180" step="15"
                                    value={currentParams.yaw}
                                    onChange={(e) => setCurrentParams({...currentParams, yaw: parseInt(e.target.value)})}
                                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cine-accent"
                                />
                            </div>
                        </div>

                        {/* Queue Indicator */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">参数装填队列 (QUEUE)</span>
                                <span className="text-[10px] text-cine-accent font-mono font-bold">{paramsQueue.length} / {gridCount}</span>
                            </div>
                            <div className="flex gap-1.5">
                                {[...Array(gridCount)].map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`flex-1 h-1.5 rounded-[1px] transition-all duration-500 ${
                                            i < paramsQueue.length ? 'bg-cine-accent shadow-[0_0_8px_#FF7A00]' : 'bg-zinc-800'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                            <Button 
                                variant="primary" size="sm" 
                                onClick={resetQueue} 
                                disabled={paramsQueue.length === 0 || isRendering}
                                className="h-10 border-dashed border-zinc-800"
                            >
                                <Trash2 size={12} className="mr-2" /> 重置队列
                            </Button>
                            <Button 
                                variant="primary" size="sm" 
                                onClick={lockShot} 
                                disabled={isFull || isRendering}
                                className={`h-10 border-zinc-700 ${!isFull ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'opacity-40'}`}
                            >
                                <Lock size={12} className="mr-2" /> 
                                {isFull ? '已满' : `锁定第 ${paramsQueue.length + 1} 格`}
                            </Button>
                        </div>

                        <Button 
                            variant="accent" 
                            onClick={() => onRender(anchorImage, paramsQueue)} 
                            disabled={!isFull || isRendering} 
                            className="w-full h-12 shadow-[0_0_20px_rgba(255,122,0,0.3)] mt-2"
                        >
                            <Play size={14} className="mr-3" fill="black" /> 
                            {isRendering ? '渲染中...' : '执行多角度一致性渲染'}
                        </Button>
                    </>
                )}
                
                {/* Guidelines */}
                <div className="p-3 bg-black/40 rounded-[1px] border border-zinc-800/50 flex gap-3">
                    <Info size={14} className="text-cine-accent flex-shrink-0 mt-0.5" />
                    <p className="text-[8px] text-zinc-500 leading-relaxed font-mono">
                        本功能采用 Nanobanana Pro 3D 深度重绘逻辑。保持锚点图 ID 不变的情况下，通过改变虚拟相机外参模拟运动视角。推荐配置全部宫格后再执行渲染。
                    </p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
