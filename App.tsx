
import React, { useState, useEffect, useCallback } from 'react';
import { AssetBay } from './components/AssetBay';
import { DirectorDeck } from './components/DirectorDeck';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { CameraEditor } from './components/CameraEditor';
import { CollageEditor } from './components/CollageEditor';
import { ScriptEditor } from './components/ScriptEditor';
import { Asset, GeneratedImage, AspectRatio, PanelAspectRatio, ImageSize, CollageData } from './types';
import { generateMultiViewGrid, fileToBase64, analyzeAsset, ReferenceImageData, editImage } from './services/geminiService';
import { saveToStorage, loadFromStorage } from './services/persistenceService';
import { AlertCircle, X as XIcon, LayoutGrid, Key as KeyIcon, ExternalLink } from 'lucide-react';
import { Button } from './components/Button';
// @ts-ignore
import JSZip from 'jszip';

const App: React.FC = () => {
  // 核心状态
  const [assets, setAssets] = useState<Asset[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [history, setHistory] = useState<GeneratedImage[][]>([]);
  
  // UI 状态
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>(undefined);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);
  const [gridSize, setGridSize] = useState(2);
  const [panelAspectRatio, setPanelAspectRatio] = useState<PanelAspectRatio>(PanelAspectRatio.P16_9);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.WIDE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K4);
  const [prompt, setPrompt] = useState<string>('');
  const [panelPrompts, setPanelPrompts] = useState<string[]>([]);
  
  // 弹窗状态
  const [isCameraEditorOpen, setIsCameraEditorOpen] = useState(false);
  const [isCollageEditorOpen, setIsCollageEditorOpen] = useState(false);
  const [isScriptEditorOpen, setIsScriptEditorOpen] = useState(false);
  const [activeCollage, setActiveCollage] = useState<CollageData | null>(null);
  
  // 运行状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>(''); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isKeyRequired, setIsKeyRequired] = useState(false);

  // 初始化：检查 API Key 状态 (仅在 AI Studio 环境下)
  useEffect(() => {
    const checkKeyStatus = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) setIsKeyRequired(true);
      } else {
        // 生产环境下，如果 process.env.API_KEY 彻底为空，则显示警告
        const key = (process.env as any).API_KEY;
        if (!key || key.length < 5) {
          setIsKeyRequired(true);
        }
      }
    };
    checkKeyStatus();
  }, []);

  // 比例联动
  useEffect(() => {
    switch (panelAspectRatio) {
      case PanelAspectRatio.P16_9: setAspectRatio(AspectRatio.WIDE); break;
      case PanelAspectRatio.P9_16: setAspectRatio(AspectRatio.MOBILE); break;
      case PanelAspectRatio.P3_4: setAspectRatio(AspectRatio.PORTRAIT); break;
      case PanelAspectRatio.P4_3: setAspectRatio(AspectRatio.STANDARD); break;
      case PanelAspectRatio.P1_1: setAspectRatio(AspectRatio.SQUARE); break;
    }
  }, [panelAspectRatio]);

  // 持久化加载
  useEffect(() => {
    loadFromStorage<GeneratedImage[]>('cine_images').then(saved => {
        if (saved) setImages(saved);
    });
  }, []);

  useEffect(() => {
    saveToStorage('cine_images', images);
  }, [images]);

  const updateImagesWithHistory = useCallback((newImages: GeneratedImage[]) => {
    setHistory(prev => [...prev, images].slice(-30)); 
    setImages(newImages);
  }, [images]);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsKeyRequired(false);
    } else {
      // 在 Vercel 环境下，只能提示用户去后台设置
      alert("请确保您已在 Vercel 项目设置的 Environment Variables 中添加了 API_KEY 变量，并已重新部署项目。");
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setGenerationStep('初始化渲染引擎...');
    
    try {
      const categorizedRefs: ReferenceImageData[] = [];
      for (const asset of assets) {
        const b64 = await fileToBase64(asset.file);
        categorizedRefs.push({
          mimeType: asset.file.type,
          data: b64,
          category: asset.category,
          roleIndex: asset.index
        });
      }

      setGenerationStep('生成连续分镜中...');
      const result = await generateMultiViewGrid(
        prompt,
        gridSize,
        panelAspectRatio,
        aspectRatio,
        imageSize,
        categorizedRefs,
        undefined,
        panelPrompts,
        activeCollage || undefined
      );

      const newNode: GeneratedImage = {
        id: crypto.randomUUID(),
        url: result.fullImage,
        slices: result.slices,
        prompt: prompt,
        aspectRatio: aspectRatio,
        panelAspectRatio: panelAspectRatio,
        timestamp: Date.now(),
        nodeType: 'render',
        position: { x: 400, y: 100 },
        gridRows: gridSize,
        gridCols: gridSize,
        sliceHistory: {}
      };

      updateImagesWithHistory([...images, newNode]);
      setSelectedImageId(newNode.id);
      setGenerationStep('');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("API Key")) {
        setIsKeyRequired(true);
      }
      setError(err.message || '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditSlice = async (imageId: string, sliceIndex: number, editPrompt: string, usePro: boolean, refImage?: string, size: ImageSize = ImageSize.K1) => {
    const targetImage = images.find(i => i.id === imageId);
    if (!targetImage || !targetImage.slices) return;

    setIsGenerating(true);
    try {
      const modelName = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      const updatedUrl = await editImage(
        targetImage.slices[sliceIndex],
        editPrompt,
        modelName,
        targetImage.panelAspectRatio || '16:9',
        refImage,
        size
      );

      const newSlices = [...targetImage.slices];
      const oldUrl = newSlices[sliceIndex];
      newSlices[sliceIndex] = updatedUrl;

      const newHistory = { ...(targetImage.sliceHistory || {}) };
      if (!newHistory[sliceIndex]) newHistory[sliceIndex] = [];
      newHistory[sliceIndex] = [oldUrl, ...newHistory[sliceIndex]].slice(0, 10);

      updateImagesWithHistory(images.map(img => img.id === imageId ? {
        ...img,
        slices: newSlices,
        sliceHistory: newHistory
      } : img));
    } catch (err: any) {
      setError(err.message || '重绘失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const renders = images.filter(i => i.nodeType === 'render');
    for (let i = 0; i < renders.length; i++) {
      const node = renders[i];
      const folder = zip.folder(`Scene-${i + 1}`);
      if (node.url) folder?.file('full_grid.png', node.url.split(',')[1], { base64: true });
      if (node.slices) {
        node.slices.forEach((s, idx) => {
          folder?.file(`panel-${idx + 1}.png`, s.split(',')[1], { base64: true });
        });
      }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'OrangeStudio-Export.zip';
    link.click();
  };

  const selectedImage = images.find(i => i.id === selectedImageId) || null;
  const selectedAsset = assets.find(a => a.id === selectedAssetId) || null;

  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white overflow-hidden font-sans">
      {/* 遮罩层：当检测不到 Key 时显示 */}
      {isKeyRequired && (
        <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="max-w-[480px] w-full bg-[#0d0d0d] border border-zinc-800 rounded-lg p-12 space-y-8 shadow-[0_0_100px_rgba(255,122,0,0.15)] relative overflow-hidden">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-[#FF7A00]/10 blur-[60px] pointer-events-none"></div>
             <div className="relative space-y-6">
                <div className="w-20 h-20 bg-[#FF7A00]/10 rounded-full flex items-center justify-center mx-auto border border-[#FF7A00]/20 mb-2">
                   <KeyIcon size={32} className="text-[#FF7A00]" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight uppercase font-mono">缺失 API 授权</h2>
                <div className="space-y-4 text-zinc-400 text-sm font-mono leading-relaxed">
                   <p>要启用 <span className="text-white">Gemini 3 Pro</span> 电影级渲染引擎，您必须选择或配置有效的 API KEY。</p>
                   {!window.aistudio && (
                     <p className="bg-red-950/30 text-red-400 p-4 border border-red-900/50 rounded-sm">
                       检测到您正在直接访问网页。请确保在 Vercel 环境变量中设置了 <span className="font-bold text-white underline">API_KEY</span> 变量并重新部署。
                     </p>
                   )}
                </div>
                <div className="pt-6 space-y-4">
                  <Button variant="accent" className="w-full h-14 text-sm font-bold tracking-[0.2em]" onClick={handleOpenKeySelector}>
                    {window.aistudio ? "点击选择 API KEY" : "我已配置，刷新页面"}
                  </Button>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="inline-flex items-center gap-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-widest font-mono">
                    计费说明文档 <ExternalLink size={10} />
                  </a>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-[340px] border-r border-zinc-800 flex flex-col bg-cine-dark">
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 flex-1">
          <AssetBay 
            assets={assets}
            onAddAsset={async (files, category) => {
              const newAssets: Asset[] = [];
              for (const file of Array.from(files)) {
                const preview = URL.createObjectURL(file);
                const count = assets.filter(a => a.category === category).length + newAssets.length + 1;
                newAssets.push({ id: crypto.randomUUID(), file, previewUrl: preview, type: 'image', category, index: count });
              }
              setAssets(prev => [...prev, ...newAssets]);
            }}
            onRemoveAsset={(id) => setAssets(prev => prev.filter(a => a.id !== id))}
            onSelectAsset={(a) => { setSelectedAssetId(a.id); setSelectedImageId(undefined); }}
            selectedAssetId={selectedAssetId}
            onOpenCollage={() => setIsCollageEditorOpen(true)}
          />
          <DirectorDeck 
            gridSize={gridSize} setGridSize={setGridSize}
            aspectRatio={aspectRatio} panelAspectRatio={panelAspectRatio} setPanelAspectRatio={setPanelAspectRatio}
            imageSize={imageSize} setImageSize={setImageSize}
            prompt={prompt} setPrompt={setPrompt}
            onGenerate={handleGenerate} isGenerating={isGenerating}
            onOpenScriptDeconstruct={() => setIsScriptEditorOpen(true)}
            onGenerateCamera={() => setIsCameraEditorOpen(true)}
          />
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative">
        <Canvas 
          images={images} assets={assets}
          onSelect={(img) => { setSelectedImageId(img.id); setSelectedAssetId(undefined); }}
          selectedId={selectedImageId} onDelete={(id) => updateImagesWithHistory(images.filter(i => i.id !== id))}
          onUpdateNodePosition={(id, x, y) => setImages(prev => prev.map(img => img.id === id ? { ...img, position: { x, y } } : img))}
          onDownloadAll={handleDownloadAll} onDeselectAll={() => setSelectedImageId(undefined)}
        />
        {generationStep && (
           <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center">
             <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-cine-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-cine-accent font-mono text-sm tracking-[0.3em] font-bold uppercase">{generationStep}</p>
             </div>
           </div>
        )}
      </div>

      {/* Inspector */}
      {(selectedImage || selectedAsset) && (
        <div className="w-[400px] border-l border-zinc-800 bg-cine-dark">
          <Inspector 
            selectedImage={selectedImage} selectedAsset={selectedAsset}
            onClose={() => { setSelectedImageId(undefined); setSelectedAssetId(undefined); }}
            onAnalyze={async (p) => {
              setIsAnalyzing(true);
              try {
                const item = selectedImage || selectedAsset;
                if (!item) return;
                const url = selectedImage ? (selectedImage.slices?.[0] || selectedImage.url) : (selectedAsset?.previewUrl || '');
                const b64 = url.includes(',') ? url.split(',')[1] : '';
                const result = await analyzeAsset(b64, 'image/png', p);
                setAnalysisResult(result);
              } catch (e) { setAnalysisResult('分析失败'); } finally { setIsAnalyzing(false); }
            }}
            isAnalyzing={isAnalyzing} analysisResult={analysisResult} onEditSlice={handleEditSlice}
          />
        </div>
      )}

      {/* Modals */}
      <CameraEditor 
        isOpen={isCameraEditorOpen} onClose={() => setIsCameraEditorOpen(false)}
        rows={gridSize} cols={gridSize} mainPrompt={prompt} initialPrompts={panelPrompts} onSave={setPanelPrompts}
        currentImage={selectedImage || undefined} onRegenSlice={(idx, p) => handleEditSlice(selectedImageId!, idx, p, true)}
        isGenerating={isGenerating}
      />
      <CollageEditor isOpen={isCollageEditorOpen} onClose={() => setIsCollageEditorOpen(false)} onSave={(url, r, c, ar) => { setActiveCollage({ url, rows: r, cols: c, aspectRatio: ar }); setIsCollageEditorOpen(false); }} />
      <ScriptEditor isOpen={isScriptEditorOpen} onClose={() => setIsScriptEditorOpen(false)} onApplyScripts={(summary, scripts) => { setPrompt(summary); setPanelPrompts(scripts); }} defaultPanelCount={gridSize * gridSize} />

      {error && (
        <div className="fixed bottom-6 right-6 z-[300] bg-red-950 border border-red-500 text-red-200 px-6 py-4 rounded-md flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-4">
          <AlertCircle size={20} />
          <span className="text-sm font-mono">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 hover:text-white"><XIcon size={16} /></button>
        </div>
      )}
    </div>
  );
};

export default App;
