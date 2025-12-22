
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssetBay } from './components/AssetBay';
import { DirectorDeck } from './components/DirectorDeck';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { Asset, GeneratedImage, AspectRatio, ImageSize, AssetCategory } from './types';
import { generateMultiViewGrid, fileToBase64, enhancePrompt, analyzeAsset, ReferenceImageData, generateCameraMovement } from './services/geminiService';
import { saveToStorage, loadFromStorage, clearStorage } from './services/persistenceService';
import { AlertCircle, X as XIcon, Trash2 } from 'lucide-react';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>(undefined);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);
  
  const [gridRows, setGridRows] = useState(2);
  const [gridCols, setGridCols] = useState(2);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.WIDE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K4);
  const [prompt, setPrompt] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>(''); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadFromStorage<GeneratedImage[]>('cine_images').then(saved => {
        if (saved) setImages(saved);
    });
  }, []);

  useEffect(() => {
    saveToStorage('cine_images', images);
  }, [images]);

  const handleAddAsset = (files: FileList, category: AssetCategory) => {
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const categoryCount = assets.filter(a => a.category === category).length;
      const newAsset: Asset = {
        id: crypto.randomUUID(),
        file,
        previewUrl: url,
        type: 'image',
        category,
        index: category === 'role' ? categoryCount + 1 : undefined
      };
      setAssets((prev) => [...prev, newAsset]);
    });
  };

  const handleRemoveAsset = (id: string) => {
    setAssets((prev) => {
        const filtered = prev.filter((a) => a.id !== id);
        // Re-index roles
        let roleIdx = 1;
        return filtered.map(a => {
            if (a.category === 'role') {
                return { ...a, index: roleIdx++ };
            }
            return a;
        });
    });
    if (selectedAssetId === id) setSelectedAssetId(undefined);
  };

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      const timestamp = Date.now();
      const parentNode = images.find(i => i.id === selectedImageId && i.nodeType === 'render');
      
      let startX = 100;
      let startY = 100;
      let previousContextImage = undefined;
      
      if (parentNode) {
          startX = (parentNode.position?.x || 0); 
          startY = (parentNode.position?.y || 0) + 480; 
          previousContextImage = parentNode.fullGridUrl || parentNode.url;
      } else {
          const rootNodes = images.filter(i => !i.parentId);
          startX = rootNodes.length === 0 ? 100 : (rootNodes[rootNodes.length-1].position?.x || 100) + 420;
      }

      setGenerationStep("正在根据角色与背景资产构思分镜...");
      
      const referenceData: ReferenceImageData[] = [];
      for (const asset of assets) {
          referenceData.push({
             data: await fileToBase64(asset.file),
             mimeType: asset.file.type,
             category: asset.category,
             roleIndex: asset.index
          });
      }

      const finalResult = await generateMultiViewGrid(
          prompt, 
          gridRows, 
          gridCols, 
          aspectRatio, 
          imageSize, 
          referenceData,
          previousContextImage 
      );
      
      setGenerationStep("正在分析画面动线...");
      const cameraMove = await generateCameraMovement(prompt);

      const finalNode: GeneratedImage = {
          id: crypto.randomUUID(),
          url: finalResult.fullImage,
          fullGridUrl: finalResult.fullImage,
          prompt: prompt,
          textData: prompt, 
          assetIds: assets.map(a => a.id), 
          aspectRatio,
          timestamp: timestamp + 1,
          nodeType: 'render',
          parentId: parentNode?.id, 
          position: { x: startX, y: startY },
          cameraDescription: cameraMove,
          slices: finalResult.slices,
          gridRows,
          gridCols
      };

      setImages(prev => [...prev, finalNode]);
      setSelectedImageId(finalNode.id);

    } catch (err: any) {
      setError(err.message || "生成失败");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cine-black text-zinc-400 font-sans">
      <aside className="w-[340px] flex flex-col border-r border-cine-border bg-cine-dark z-20 shadow-2xl">
        <div className="p-5 border-b border-cine-border bg-cine-black/50 flex justify-between items-center">
            <h1 className="text-white text-xs font-bold tracking-[0.15em] uppercase font-mono flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-cine-accent rounded-[1px]"></span>
                橙意机构 - 连续分镜
            </h1>
            <button onClick={() => { if(confirm("重置工作区？")) { setImages([]); clearStorage(); } }} className="text-zinc-700 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
        </div>

        <div className="flex-1 flex flex-col p-4 gap-7 overflow-y-auto custom-scrollbar">
            <AssetBay 
                assets={assets} 
                onAddAsset={handleAddAsset} 
                onRemoveAsset={handleRemoveAsset} 
                onSelectAsset={(a) => { setSelectedAssetId(a.id); setSelectedImageId(undefined); }}
                selectedAssetId={selectedAssetId}
            />

            <DirectorDeck 
                gridRows={gridRows} setGridRows={setGridRows}
                gridCols={gridCols} setGridCols={setGridCols}
                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                imageSize={imageSize} setImageSize={setImageSize}
                prompt={prompt} setPrompt={setPrompt}
                onGenerate={handleGenerate}
                onStop={() => setIsGenerating(false)}
                isGenerating={isGenerating}
                onEnhancePrompt={async () => setPrompt(await enhancePrompt(prompt))}
                onGenerateCamera={async () => setAnalysisResult(await generateCameraMovement(prompt))}
                isContinuing={!!(selectedImageId && images.find(i => i.id === selectedImageId)?.nodeType === 'render')}
                onDeselect={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
            />
        </div>
      </aside>

      <main className="flex-1 relative bg-cine-black">
        <Canvas
            images={images} 
            onSelect={(i) => { setSelectedImageId(i.id); setSelectedAssetId(undefined); }} 
            selectedId={selectedImageId}
            onDelete={(id) => setImages(prev => prev.filter(i => i.id !== id))} 
            onUpdateNodePosition={(id, x, y) => setImages(prev => prev.map(img => img.id === id ? { ...img, position: { x, y } } : img))}
            onDownloadAll={() => {}}
            assets={assets} 
            onDeselectAll={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
        />
        
        {isGenerating && (
            <div className="absolute inset-0 bg-cine-black/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center space-y-8">
                 <div className="w-16 h-16 border-t-2 border-cine-accent rounded-full animate-spin"></div>
                 <div className="text-center space-y-2">
                     <p className="text-white font-mono tracking-[0.3em] text-sm uppercase font-bold">{generationStep}</p>
                     <p className="text-cine-accent/50 font-mono text-[10px]">AI ENGINE: GEMINI 3 PRO</p>
                 </div>
            </div>
        )}

        {error && (
            <div className="absolute bottom-8 left-8 z-50 bg-red-950/80 backdrop-blur border border-red-500/30 text-red-200 p-4 rounded-md text-xs flex gap-3">
                <AlertCircle size={16} className="text-red-400" />
                <span className="font-mono">{error}</span>
                <button onClick={() => setError(null)}><XIcon size={14} /></button>
            </div>
        )}
      </main>

      <aside className="w-[360px] bg-cine-dark border-l border-cine-border z-20">
         <Inspector 
            selectedImage={images.find(i => i.id === selectedImageId) || null}
            selectedAsset={assets.find(a => a.id === selectedAssetId) || null}
            onClose={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
            onAnalyze={async (p) => { 
                setIsAnalyzing(true);
                const asset = assets.find(a => a.id === selectedAssetId);
                if (asset) setAnalysisResult(await analyzeAsset(await fileToBase64(asset.file), asset.file.type, p));
                setIsAnalyzing(false);
            }}
            isAnalyzing={isAnalyzing}
            analysisResult={analysisResult}
         />
      </aside>
    </div>
  );
};

export default App;
