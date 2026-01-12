
import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Send, Check, Trash2, Plus, Sparkles, Save, BookOpen, Layers, CheckCircle2, Circle, Hash, FileUp, Eraser, Edit3, FolderOpen, History, Film, Play, RotateCcw, Download } from 'lucide-react';
import { Button } from './Button';
import { ScriptItem, SavedPrompt, ScriptGroup } from '../types';
import { generateScriptLines, generateDirectorSummary, analyzeVideoToScript, fileToBase64 } from '../services/geminiService';
import { saveToStorage, loadFromStorage } from '../services/persistenceService';
import { generateUUID } from '../utils/uuid';

interface ScriptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyScripts: (summary: string, scripts: string[]) => void;
  defaultPanelCount: number;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ 
  isOpen, 
  onClose, 
  onApplyScripts,
  defaultPanelCount
}) => {
  const [activeMode, setActiveMode] = useState<'text' | 'video'>('text');
  const [instruction, setInstruction] = useState("");
  const [panelCount, setPanelCount] = useState(defaultPanelCount);
  
  // Text Attachment
  const [attachmentContent, setAttachmentContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Video Attachment
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoMimeType, setVideoMimeType] = useState<string>('');

  const [scriptItems, setScriptItems] = useState<ScriptItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [scriptGroups, setScriptGroups] = useState<ScriptGroup[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [activeTab, setActiveTab] = useState<'input' | 'history'>('input');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadFromStorage<SavedPrompt[]>('cine_saved_prompts').then(res => {
        if (res) setSavedPrompts(res);
      });
      loadFromStorage<ScriptGroup[]>('cine_script_groups').then(res => {
        if (res) setScriptGroups(res);
      });
      setPanelCount(defaultPanelCount);
    }
  }, [isOpen, defaultPanelCount]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => setAttachmentContent(ev.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const b64 = await fileToBase64(file);
      setVideoBase64(b64);
      setVideoMimeType(file.type);
      setVideoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleClearAttachment = () => {
      setFileName(null);
      setAttachmentContent(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearVideo = () => {
      setVideoBase64(null);
      setVideoPreviewUrl(null);
      setVideoMimeType('');
      if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (activeMode === 'text') {
        if (!instruction.trim() && !attachmentContent) return;
        setIsGenerating(true);
        try {
            const lines = await generateScriptLines(instruction, panelCount, attachmentContent || undefined);
            const newItems = lines.map(l => ({ id: generateUUID(), content: l, selected: false }));
            setScriptItems(newItems);
            saveAutoGroup(lines);
        } catch (err) { console.error(err); } finally { setIsGenerating(false); }
    } else {
        if (!videoBase64) return;
        setIsGenerating(true);
        try {
            const lines = await analyzeVideoToScript(videoBase64, videoMimeType);
            const newItems = lines.map(l => ({ id: generateUUID(), content: l, selected: false }));
            setScriptItems(newItems);
            saveAutoGroup(lines);
        } catch (err) { alert(err instanceof Error ? err.message : "反推失败"); } finally { setIsGenerating(false); }
    }
  };

  const saveAutoGroup = async (lines: string[]) => {
      const newGroup: ScriptGroup = {
          id: generateUUID(),
          name: `${activeMode === 'text' ? '智能拆解' : '视频反推'} ${scriptGroups.length + 1}`,
          scripts: lines,
          summary: activeMode === 'text' ? (instruction.slice(0, 50) || "文本拆解结果") : "从视频反推的分镜脚本",
          timestamp: Date.now()
      };
      const updatedGroups = [newGroup, ...scriptGroups];
      setScriptGroups(updatedGroups);
      await saveToStorage('cine_script_groups', updatedGroups);
  };

  const handleRenameGroup = async (id: string, newName: string) => {
      if (!newName.trim()) {
        setEditingGroupId(null);
        return;
      }
      const updated = scriptGroups.map(g => g.id === id ? { ...g, name: newName } : g);
      setScriptGroups(updated);
      await saveToStorage('cine_script_groups', updated);
      setEditingGroupId(null);
      setTempName("");
  };

  const handleDeleteGroup = async (id: string) => {
      const updated = scriptGroups.filter(g => g.id !== id);
      setScriptGroups(updated);
      await saveToStorage('cine_script_groups', updated);
  };

  const handleDownloadGroup = (group: ScriptGroup) => {
      const content = `橙意机构 - 分镜脚本专家导出\n项目名称: ${group.name}\n生成时间: ${new Date(group.timestamp).toLocaleString()}\n\n---\n\n` + 
                      group.scripts.map((s, i) => `[分镜 ${i + 1}]\n${s}`).join('\n\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${group.name}_脚本导出.txt`;
      link.click();
      URL.revokeObjectURL(url);
  };

  const handleLoadGroup = (group: ScriptGroup) => {
      setScriptItems(group.scripts.map(s => ({ id: generateUUID(), content: s, selected: true })));
      if (activeMode === 'text') setInstruction(group.summary || "");
      setActiveTab('input');
  };

  const handleSavePrompt = async () => {
    if (!instruction.trim()) return;
    const newPrompt: SavedPrompt = {
      id: generateUUID(),
      title: instruction.slice(0, 20) + (instruction.length > 20 ? "..." : ""),
      content: instruction,
      timestamp: Date.now()
    };
    const updated = [newPrompt, ...savedPrompts];
    setSavedPrompts(updated);
    await saveToStorage('cine_saved_prompts', updated);
  };

  const handleRemoveSavedPrompt = async (id: string) => {
    const updated = savedPrompts.filter(p => p.id !== id);
    setSavedPrompts(updated);
    await saveToStorage('cine_saved_prompts', updated);
  };

  const handleApply = async () => {
    const selectedItems = scriptItems.filter(i => i.selected);
    if (selectedItems.length === 0) return;
    setIsSummarizing(true);
    try {
        const selectedTexts = selectedItems.map(i => i.content);
        const summary = await generateDirectorSummary(selectedTexts);
        onApplyScripts(summary, selectedTexts);
        onClose();
    } catch (e) { console.error(e); } finally { setIsSummarizing(false); }
  };

  const toggleSelection = (id: string) => {
    setScriptItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const updateScriptContent = (id: string, content: string) => {
    setScriptItems(prev => prev.map(item => item.id === id ? { ...item, content } : item));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 animate-in fade-in duration-300">
      <div className="bg-cine-dark border border-zinc-800 w-full max-w-7xl rounded-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-cine-accent flex items-center justify-center shadow-[0_0_20px_rgba(255,122,0,0.3)]">
              <Sparkles size={22} className="text-black" />
            </div>
            <div>
              <h2 className="text-white font-mono uppercase tracking-[0.25em] text-sm font-bold">
                智能脚本专家 (AI SCRIPT EXPERT)
              </h2>
              <p className="text-[13px] text-zinc-200 font-mono mt-0.5 uppercase tracking-widest">
                支持文本拆解或视频分镜反推，自动同步至导演控制台
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-all hover:rotate-90">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Input & History */}
          <div className="w-[400px] border-r border-zinc-800 flex flex-col bg-zinc-900/30">
            <div className="flex border-b border-zinc-800">
                <button 
                    onClick={() => setActiveTab('input')}
                    className={`flex-1 py-4 text-[13px] font-mono uppercase tracking-widest font-bold transition-all ${activeTab === 'input' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                    核心输入区
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-4 text-[13px] font-mono uppercase tracking-widest font-bold transition-all ${activeTab === 'history' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                    脚本历史
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {activeTab === 'input' ? (
                    <>
                        {/* Mode Toggle */}
                        <div className="flex bg-black/40 p-1 rounded-sm border border-zinc-800">
                            <button 
                                onClick={() => setActiveMode('text')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[2px] text-[13px] font-mono font-bold transition-all ${activeMode === 'text' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                <FileText size={12} /> 文本拆解
                            </button>
                            <button 
                                onClick={() => setActiveMode('video')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[2px] text-[13px] font-mono font-bold transition-all ${activeMode === 'video' ? 'bg-cine-accent text-black' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                <Film size={12} /> 视频反推
                            </button>
                        </div>

                        {activeMode === 'text' ? (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="space-y-4">
                                    <label className="text-[13px] uppercase text-zinc-200 font-bold tracking-[0.2em] flex items-center gap-2">
                                        指令输入 (PROMPT)
                                    </label>
                                    <textarea 
                                        value={instruction}
                                        onChange={(e) => setInstruction(e.target.value)}
                                        placeholder="输入故事梗概，系统将为您拆解分镜..."
                                        className="w-full bg-black/40 border border-zinc-800 rounded-sm p-4 text-[12px] text-zinc-100 font-mono min-h-[160px] focus:border-cine-accent focus:ring-0 resize-none leading-relaxed"
                                    />
                                    <div className="flex gap-2">
                                        <Button variant="primary" size="sm" className="flex-1 text-[12px]" onClick={() => fileInputRef.current?.click()}>
                                            <FileUp size={12} className="mr-2" /> {fileName ? fileName.slice(0, 15) : '上传文档 (.txt)'}
                                        </Button>
                                        <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} />
                                        <Button variant="secondary" size="sm" onClick={handleSavePrompt} disabled={!instruction.trim()}>
                                            <Save size={14} />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[13px] uppercase text-zinc-200 font-bold tracking-[0.2em]">拆解条数</label>
                                    <input 
                                        type="number" 
                                        value={panelCount} 
                                        onChange={(e) => setPanelCount(parseInt(e.target.value) || 1)}
                                        className="w-full bg-black/40 border border-zinc-800 p-3 text-center text-cine-accent font-mono font-bold text-sm"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[13px] uppercase text-zinc-400 font-bold tracking-[0.2em]">常用指令</label>
                                    <div className="space-y-2">
                                        {savedPrompts.map(p => (
                                            <div key={p.id} className="bg-black/40 border border-zinc-800 p-2 text-[12px] font-mono text-zinc-300 truncate cursor-pointer hover:border-zinc-600" onClick={() => setInstruction(p.content)}>
                                                {p.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="space-y-4">
                                    <label className="text-[13px] uppercase text-zinc-200 font-bold tracking-[0.2em] flex items-center gap-2">
                                        视频源文件 (VIDEO SOURCE)
                                    </label>
                                    {!videoPreviewUrl ? (
                                        <div 
                                            onClick={() => videoInputRef.current?.click()}
                                            className="aspect-video border border-dashed border-zinc-800 rounded-sm flex flex-col items-center justify-center gap-3 hover:border-cine-accent/50 hover:bg-cine-accent/5 cursor-pointer transition-all"
                                        >
                                            <Film size={24} className="text-zinc-500" />
                                            <span className="text-[13px] font-mono text-zinc-500 uppercase">点击上传视频文件</span>
                                            <span className="text-[10px] text-zinc-600">SUPPORTED: MP4, WEBM</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="aspect-video bg-black rounded-sm border border-zinc-800 overflow-hidden relative group">
                                                <video src={videoPreviewUrl} className="w-full h-full object-contain" controls />
                                                <button onClick={handleClearVideo} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <div className="p-3 bg-cine-accent/5 border border-cine-accent/20 rounded-sm flex items-start gap-3">
                                                <Sparkles size={14} className="text-cine-accent mt-0.5" />
                                                <p className="text-[12px] text-zinc-300 font-mono leading-relaxed">
                                                    视频反推将自动识别镜头切换点（Shot Cuts），并按导演视角反向推导出专业的景别、构图及动态描述。
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} />
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="space-y-4">
                         {scriptGroups.map(group => (
                             <div key={group.id} className="bg-black/40 border border-zinc-800 rounded-sm p-4 hover:border-cine-accent/30 transition-all cursor-pointer group/card" onClick={() => handleLoadGroup(group)}>
                                 <div className="flex items-center justify-between mb-2">
                                     {editingGroupId === group.id ? (
                                         <div className="flex items-center gap-2 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                                             <input 
                                                autoFocus
                                                value={tempName}
                                                onChange={e => setTempName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleRenameGroup(group.id, tempName)}
                                                className="bg-black border border-cine-accent text-zinc-100 text-[13px] font-mono px-2 py-1 w-full rounded-sm"
                                             />
                                             <button onClick={() => handleRenameGroup(group.id, tempName)} className="text-cine-accent"><Check size={14} /></button>
                                             <button onClick={() => setEditingGroupId(null)} className="text-zinc-400"><X size={14} /></button>
                                         </div>
                                     ) : (
                                         <span className="text-[13px] text-zinc-100 font-bold font-mono truncate">{group.name}</span>
                                     )}
                                     
                                     {editingGroupId !== group.id && (
                                         <div className="flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingGroupId(group.id); setTempName(group.name); }} 
                                                className="text-zinc-400 hover:text-white"
                                                title="重命名"
                                             >
                                                <Edit3 size={12} />
                                             </button>
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); handleDownloadGroup(group); }} 
                                                className="text-zinc-400 hover:text-cine-accent"
                                                title="下载为文本"
                                             >
                                                <Download size={12} />
                                             </button>
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }} 
                                                className="text-zinc-400 hover:text-red-500"
                                                title="删除记录"
                                             >
                                                <Trash2 size={12} />
                                             </button>
                                         </div>
                                     )}
                                 </div>
                                 <p className="text-[10px] text-zinc-400 font-mono line-clamp-2 leading-relaxed">{group.summary || '无梗概'}</p>
                             </div>
                         ))}
                    </div>
                )}
            </div>

            {activeTab === 'input' && (
                <div className="p-6 border-t border-zinc-800">
                    <Button 
                        variant="accent" 
                        className="w-full h-12 gap-3 shadow-lg"
                        onClick={handleGenerate}
                        disabled={isGenerating || (activeMode === 'text' && !instruction.trim() && !attachmentContent) || (activeMode === 'video' && !videoBase64)}
                    >
                        {isGenerating ? <RotateCcw size={16} className="animate-spin" /> : (activeMode === 'text' ? <Send size={16} /> : <Play size={16} />)}
                        {isGenerating ? '正在深度分析中...' : (activeMode === 'text' ? '执行文本拆解' : '执行视频反推')}
                    </Button>
                </div>
            )}
          </div>

          {/* Right: Preview Area */}
          <div className="flex-1 bg-black/60 p-8 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <label className="text-[13px] uppercase text-zinc-200 font-bold tracking-[0.2em] flex items-center gap-2">
                <Layers size={14} /> 逻辑反推结果 (SHOT LIST)
              </label>
              <div className="flex gap-4">
                <button onClick={() => setScriptItems(s => s.map(i => ({...i, selected: true})))} className="text-[12px] text-zinc-400 hover:text-white font-mono uppercase tracking-widest transition-all">全选</button>
                <button onClick={() => setScriptItems(s => s.map(i => ({...i, selected: false})))} className="text-[12px] text-zinc-400 hover:text-white font-mono uppercase tracking-widest transition-all">清除</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
               <div className="space-y-4">
                 {scriptItems.map((item, idx) => (
                   <div key={item.id} className={`flex gap-4 p-4 border rounded-sm transition-all ${item.selected ? 'border-cine-accent/50 bg-cine-accent/5' : 'border-zinc-800 bg-zinc-900/40'}`}>
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[13px] font-bold font-mono ${item.selected ? 'bg-cine-accent text-black border-cine-accent' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                        {idx + 1}
                      </div>
                      <textarea 
                        value={item.content}
                        onChange={(e) => updateScriptContent(item.id, e.target.value)}
                        className="flex-1 bg-transparent border-none p-0 text-[12px] text-zinc-100 font-mono focus:ring-0 resize-none min-h-[60px] leading-relaxed"
                      />
                      <button 
                        onClick={() => toggleSelection(item.id)}
                        className={`px-4 h-9 rounded-sm transition-all border text-[12px] font-mono font-bold ${item.selected ? 'bg-cine-accent text-black border-cine-accent' : 'bg-black/40 text-zinc-400 border-zinc-800'}`}
                      >
                        {item.selected ? '已选用' : '选用'}
                      </button>
                   </div>
                 ))}
                 {!isGenerating && scriptItems.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 py-20">
                     <Sparkles size={32} className="opacity-20" />
                     <p className="font-mono text-[13px] uppercase tracking-[0.3em]">等待输入指令或上传视频素材...</p>
                   </div>
                 )}
               </div>
            </div>

            <div className="mt-8 flex justify-end gap-4 border-t border-zinc-800 pt-6">
               <Button variant="ghost" onClick={onClose} className="px-8 h-12 border border-zinc-800">取消</Button>
               <Button 
                variant="accent" 
                className="px-12 h-12 shadow-xl min-w-[220px]"
                onClick={handleApply}
                disabled={isSummarizing || scriptItems.filter(i => i.selected).length === 0}
               >
                 {isSummarizing ? <RotateCcw size={18} className="animate-spin mr-3" /> : <Check size={18} className="mr-3" />}
                 {isSummarizing ? '正在同步数据...' : '应用并同步 (SYNC)'}
               </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
