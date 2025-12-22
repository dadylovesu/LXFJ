
import React, { useRef, useState } from 'react';
import { X, Film, Image as ImageIcon, Plus, UploadCloud, UserSquare2, Mountain, Database } from 'lucide-react';
import { Asset, AssetCategory } from '../types';

interface AssetBayProps {
  assets: Asset[];
  onAddAsset: (files: FileList, category: AssetCategory) => void;
  onRemoveAsset: (id: string) => void;
  onSelectAsset: (asset: Asset) => void;
  selectedAssetId?: string;
}

export const AssetBay: React.FC<AssetBayProps> = ({ 
    assets, 
    onAddAsset, 
    onRemoveAsset, 
    onSelectAsset, 
    selectedAssetId
}) => {
  const roleInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [dragOverCategory, setDragOverCategory] = useState<AssetCategory | null>(null);

  const roles = assets.filter(a => a.category === 'role');
  const bgs = assets.filter(a => a.category === 'background');

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
        className={`space-y-3 p-2 rounded-md transition-all duration-300 ${dragOverCategory === category ? 'bg-cine-accent/5 ring-1 ring-cine-accent/30' : ''}`}
        onDragOver={(e) => handleDragOver(e, category)}
        onDragLeave={() => setDragOverCategory(null)}
        onDrop={(e) => handleDrop(e, category)}
    >
        <div className="flex items-center justify-between px-1">
            <span className="text-zinc-500 text-[9px] uppercase tracking-[0.2em] font-mono font-bold flex items-center gap-2">
                {icon}
                {title}
            </span>
            <span className="text-[8px] font-mono text-zinc-700">{list.length} 个资产</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
            <div 
                className="aspect-square border border-dashed border-zinc-800 bg-zinc-900/20 rounded-sm hover:border-cine-accent/50 hover:bg-cine-accent/5 transition-all cursor-pointer flex items-center justify-center group"
                onClick={() => inputRef.current?.click()}
                title="上传参考图"
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
                <Plus className="w-4 h-4 text-zinc-700 group-hover:text-cine-accent group-hover:scale-110 transition-all" />
            </div>

            {list.map((asset) => (
                <div 
                    key={asset.id} 
                    onClick={() => onSelectAsset(asset)}
                    className={`relative group aspect-square bg-zinc-950 border rounded-sm overflow-hidden cursor-pointer transition-all ${
                        selectedAssetId === asset.id 
                        ? 'border-cine-accent ring-1 ring-cine-accent/40 z-10' 
                        : 'border-zinc-800/80 hover:border-zinc-600'
                    }`}
                >
                    <img src={asset.previewUrl} alt="asset" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all" />
                    
                    {category === 'role' && (
                        <div className="absolute top-1 left-1 bg-cine-accent text-black text-[7px] font-bold px-1 py-0.5 rounded-[1px] shadow-sm">
                            角色 {asset.index}
                        </div>
                    )}
                    {category === 'background' && (
                        <div className="absolute top-1 left-1 bg-zinc-700 text-white text-[7px] font-bold px-1 py-0.5 rounded-[1px] shadow-sm">
                            场景
                        </div>
                    )}

                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemoveAsset(asset.id); }} 
                        className="absolute top-1 right-1 p-0.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={10} />
                    </button>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center gap-2 px-1 text-zinc-400">
         <Database size={10} />
         <span className="text-[10px] uppercase tracking-[0.25em] font-mono font-bold">01. 核心资产库 (ASSETS)</span>
      </div>

      <div className="space-y-4">
          {renderSection("角色/演员 (ROLES)", <UserSquare2 size={10} />, 'role', roles, roleInputRef)}
          <div className="h-[1px] bg-zinc-800/50 mx-2"></div>
          {renderSection("环境/场景 (BACKGROUNDS)", <Mountain size={10} />, 'background', bgs, bgInputRef)}
      </div>
    </div>
  );
};
