
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
import JSZip from 'jszip';

const App: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>(undefined);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);
  
  // 历史记录栈
  const [undoStack, setUndoStack] = useState<GeneratedImage[][]>([]);
  const [redoStack, setRedoStack] = useState<GeneratedImage[][]>([]);

  const [gridRows, setGridRows] = useState(2);
  const [gridCols, setGridCols] = useState(2);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.WIDE);
  const [imageSize, setImageSize] = useState<ImageSize>(AspectRatio.WIDE as any === '16:9' ? ImageSize.K4 : ImageSize.K1); 
  // 初始化补偿
  useEffect(() => { setImageSize(ImageSize.K4); }, []);

  const [prompt, setPrompt] = useState<string>('');
  const [cameraTrack, setCameraTrack] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>(''); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 辅助函数：保存当前状态到历史
  const pushToHistory = useCallback((currentImages: GeneratedImage[]) => {
    setUndoStack(prev => [...prev, currentImages]);
    setRedoStack([]); // 发生新动作，清空重做栈
  }, []);

  useEffect(() => {
    loadFromStorage<GeneratedImage[]>('cine_images').then(saved => {
        if (saved) setImages(saved);
    });
  }, []);

  useEffect(() => {
    saveToStorage('cine_images', images);
  }, [images]);

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果焦点在输入框内，不触发快捷键
      const isTyping = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
      if (isTyping) return;

      // 删除键
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedImageId) {
          handleDelete(selectedImageId);
        }
      }

      // Ctrl + Z (撤销)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Ctrl + Shift + Z 或 Ctrl + Y (重做)
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageId, undoStack, redoStack, images]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, images]);
    setUndoStack(prev => prev.slice(0, -1));
    setImages(previous);
  }, [undoStack, images]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, images]);
    setRedoStack(prev => prev.slice(0, -1));
    setImages(next);
  }, [redoStack, images]);

  const handleDelete = (id: string) => {
    pushToHistory(images);
    setImages(prev => prev.filter(i => i.id !== id));
    if (selectedImageId === id) setSelectedImageId(undefined);
  };

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
    if (!prompt.trim()) {
        setError("请输入创作指令。");
        return;
    }
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
          previousContextImage,
          cameraTrack
      );
      
      setGenerationStep("正在同步镜头数据...");
      const finalCameraDescription = cameraTrack.trim() || await generateCameraMovement(prompt);

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
          cameraDescription: finalCameraDescription,
          slices: finalResult.slices,
          slicePrompts: finalResult.slicePrompts,
          gridRows,
          gridCols
      };

      // 保存历史
      pushToHistory(images);
      setImages(prev => [...prev, finalNode]);
      setSelectedImageId(finalNode.id);

    } catch (err: any) {
      setError(err.message || "生成失败");
    } finally {
      setIsGenerating(false);
      setGenerationStep("");
    }
  };

  const handleDownloadAll = async () => {
    if (images.length === 0) return;
    
    const zip = new JSZip();
    const renderNodes = images.filter(i => i.nodeType === 'render');
    
    for (let i = 0; i < renderNodes.length; i++) {
        const node = renderNodes[i];
        const sceneFolder = zip.folder(`场景_${i + 1}`);
        if (!sceneFolder) continue;

        const masterData = (node.fullGridUrl || node.url).split(',')[1];
        sceneFolder.file(`完整分镜网格.png`, masterData, { base64: true });

        if (node.slices) {
            for (let s = 0; s < node.slices.length; s++) {
                const sliceData = node.slices[s].split(',')[1];
                sceneFolder.file(`单帧_${s + 1}.png`, sliceData, { base64: true });
            }
        }
        
        sceneFolder.file(`导演描述.txt`, `总提示词: ${node.prompt}\n\n镜头运动: ${node.cameraDescription || '无'}\n\n分镜描述:\n${node.slicePrompts?.join('\n') || ''}`);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `橙意机构-分镜导出-${new Date().getTime()}.zip`;
    link.click();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cine-black text-zinc-400 font-sans">
      <aside className="w-[340px] flex flex-col border-r border-cine-border bg-cine-dark z-20 shadow-2xl">
        <div className="p-5 border-b border-cine-border bg-cine-black/50 flex justify-between items-center">
            <h1 className="text-white text-xs font-bold tracking-[0.15em] uppercase font-mono flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-cine-accent rounded-[1px]"></span>
                橙意机构 - 连续分镜
            </h1>
            <button onClick={() => { if(confirm("确定要重置当前工作区吗？所有进度将丢失。")) { setImages([]); clearStorage(); setUndoStack([]); setRedoStack([]); } }} className="text-zinc-700 hover:text-red-500 transition-colors" title="重置工作区">
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
                cameraTrack={cameraTrack} setCameraTrack={setCameraTrack}
                onGenerate={handleGenerate}
                onStop={() => setIsGenerating(false)}
                isGenerating={isGenerating}
                onEnhancePrompt={async () => setPrompt(await enhancePrompt(prompt))}
                onGenerateCamera={async () => {
                    const cam = await generateCameraMovement(prompt);
                    setAnalysisResult(cam);
                    setCameraTrack(cam);
                }}
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
            onDelete={handleDelete} 
            onUpdateNodePosition={(id, x, y) => {
                // 拖拽位置更新不频繁记录历史，仅更新当前状态
                setImages(prev => prev.map(img => img.id === id ? { ...img, position: { x, y } } : img));
            }}
            onDownloadAll={handleDownloadAll}
            assets={assets} 
            onDeselectAll={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
        />
        
        {isGenerating && (
            <div className="absolute inset-0 bg-cine-black/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center space-y-8">
                 <div className="w-16 h-16 border-t-2 border-cine-accent rounded-full animate-spin"></div>
                 <div className="text-center space-y-2">
                     <p className="text-white font-mono tracking-[0.3em] text-sm uppercase font-bold">{generationStep}</p>
                     <p className="text-cine-accent/50 font-mono text-[10px]">AI 引擎: GEMINI 3 PRO</p>
                 </div>
            </div>
        )}

        {/* 快捷操作提示 (撤销/重做) */}
        <div className="absolute bottom-6 right-6 flex items-center gap-3 z-30 pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
            <div className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-sm text-[9px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-4 pointer-events-auto">
                <span className={undoStack.length > 0 ? "text-cine-accent" : ""}>Undo: Ctrl+Z</span>
                <span className={redoStack.length > 0 ? "text-cine-accent" : ""}>Redo: Ctrl+Y</span>
                {selectedImageId && <span className="text-red-500/70">Delete: Del</span>}
            </div>
        </div>

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
