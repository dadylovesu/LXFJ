import React, { useRef, useState } from 'react';
import { X, Film, Image as ImageIcon, Plus, UploadCloud, UserSquare2, Mountain, Database, Box, LayoutGrid } from 'lucide-react';
import { Asset, AssetCategory } from '../types';

interface AssetBayProps {
  assets: Asset[];
  onAddAsset: (files: FileList, category: AssetCategory) => void;
  onRemoveAsset: (id: string) => void;
  onSelectAsset: (asset: Asset) => void;
  selectedAssetId?: string;
  onOpenCollage: () => void;
}

export const AssetBay: React.FC<AssetBayProps> = ({ 
    assets, 
    onAddAsset, 
    onRemoveAsset, 
    onSelectAsset, 
    selectedAssetId,
    onOpenCollage
}) => {
  const roleInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const propInputRef = useRef<HTMLInputElement>(null);
  const [dragOverCategory, setDragOverCategory] = useState<AssetCategory | null>(null);

  const roles = assets.filter(a => a.category === 'role');
  const bgs = assets.filter(a => a.category === 'background');
  const props = assets.filter(a => a.category === 'prop');

  const handleDragOver = (e: React.DragEvent, category: AssetCategory) => {
    e.preventDefault();
    setDragOverCategory(category);
  };

  const handleDrop = (e: React.DragEvent, category: AssetCategory) => {
    e.preventDefault();
    setDragOverCategory(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddAsset(e.dataTransfer.files, category);
    }
  };

  const renderSection = (title: string, icon: React.ReactNode, category: AssetCategory, list: Asset[], inputRef: React.RefObject<HTMLInputElement>) => (
    <div 
        className={`space-y-4 p-2 rounded-md transition-all duration-300 ${dragOverCategory === category ? 'bg-cine-accent/10 ring-1 ring-cine-accent/50' : ''}`}
        onDragOver={(e) => handleDragOver(e, category)}
        onDragLeave={() => setDragOverCategory(null)}
        onDrop={(e) => handleDrop(e, category)}
    >
        <div className="flex items-center justify-between px-1">
            <span className="text-white text-[11px] uppercase tracking-[0.15em] font-bold flex items-center gap-2">
                {icon}
                {title}
            </span>
            <span className="text-[10px] font-bold text-zinc-300">{list.length} REF</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
            <div 
                className="aspect-square border-2 border-dashed border-zinc-700 bg-zinc-800/20 rounded-sm hover:border-cine-accent/60 hover:bg-cine-accent/10 transition-all cursor-pointer flex items-center justify-center group"
                onClick={() => inputRef.current?.click()}
            >
                <input 
                    type="file" 
                    ref={inputRef} 
                    className="hidden" 
                    multiple 
                    accept="image/*"
                    onChange={(e) => {
                        if(e.target.files) onAddAsset(e.target.files, category);
                        e.target.value = '';
                    }}
                />
                <Plus className="w-5 h-5 text-white group-hover:text-cine-accent group-hover:scale-110 transition-all" />
            </div>

            {list.map((asset) => (
                <div 
                    key={asset.id} 
                    onClick={() => onSelectAsset(asset)}
                    className={`relative group aspect-square bg-zinc-950 border-2 rounded-sm overflow-hidden cursor-pointer transition-all ${
                        selectedAssetId === asset.id 
                        ? 'border-cine-accent ring-2 ring-cine-accent/40 z-10' 
                        : 'border-zinc-800 hover:border-zinc-500'
                    }`}
                >
                    <img src={asset.previewUrl} alt="asset" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all" />
                    
                    {/* Badge */}
                    {category === 'role' && (
                        <div className="absolute top-1.5 left-1.5 bg-cine-accent text-black text-[9px] font-black px-1.5 py-0.5 rounded-[1px] shadow-lg">
                            R{asset.index}
                        </div>
                    )}
                    {category === 'prop' && (
                        <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-[1px] shadow-lg">
                            P{asset.index}
                        </div>
                    )}
                    {category === 'background' && (
                        <div className="absolute top-1.5 left-1.5 bg-zinc-100 text-black text-[9px] font-black px-1.5 py-0.5 rounded-[1px] shadow-lg">
                            BG
                        </div>
                    )}

                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemoveAsset(asset.id); }} 
                        className="absolute top-1.5 right-1.5 p-1 text-white bg-black/60 rounded-full hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={12} />
                    </button>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3 text-white">
             <Database size={12} className="text-cine-accent" />
             <span className="text-[11px] uppercase tracking-[0.2em] font-black">01. 核心资产库 (ASSETS)</span>
          </div>
          <button 
            onClick={onOpenCollage}
            className="flex items-center gap-2 px-3 py-2 bg-cine-accent text-black text-[10px] font-black tracking-widest rounded-[2px] shadow-[0_0_15px_rgba(255,122,0,0.3)] hover:brightness-110 active:scale-95 transition-all"
          >
             <LayoutGrid size={14} />
             COLLAGE
          </button>
      </div>

      <div className="space-y-4">
          {renderSection("角色/演员 (ROLES)", <UserSquare2 size={12} />, 'role', roles, roleInputRef)}
          <div className="h-[1px] bg-zinc-700/50 mx-2"></div>
          {renderSection("关键道具 (PROPS)", <Box size={12} />, 'prop', props, propInputRef)}
          <div className="h-[1px] bg-zinc-700/50 mx-2"></div>
          {renderSection("环境/场景 (BACKGROUNDS)", <Mountain size={12} />, 'background', bgs, bgInputRef)}
      </div>
    </div>
  );
};