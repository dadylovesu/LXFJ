
import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Send, Check, Trash2, Plus, Sparkles, Save, BookOpen, Layers, CheckCircle2, Circle, Hash, FileUp, Eraser, Edit3, FolderOpen, History } from 'lucide-react';
import { Button } from './Button';
import { ScriptItem, SavedPrompt, ScriptGroup } from '../types';
import { generateScriptLines, generateDirectorSummary } from '../services/geminiService';
import { saveToStorage, loadFromStorage } from '../services/persistenceService';

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
  const [instruction, setInstruction] = useState("");
  const [panelCount, setPanelCount] = useState(defaultPanelCount);
  const [attachmentContent, setAttachmentContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [scriptItems, setScriptItems] = useState<ScriptItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [scriptGroups, setScriptGroups] = useState<ScriptGroup[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'history'>('input');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleClearAttachment = () => {
      setFileName(null);
      setAttachmentContent(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!instruction.trim() && !attachmentContent) return;
    setIsGenerating(true);
    try {
        const lines = await generateScriptLines(instruction, panelCount, attachmentContent || undefined);
        const newItems = lines.map(l => ({ id: crypto.randomUUID(), content: l, selected: false }));
        setScriptItems(newItems);
        
        // AUTO-SAVE deconstructed lines to history group immediately
        const newGroup: ScriptGroup = {
            id: crypto.randomUUID(),
            name: `分镜脚本组 ${scriptGroups.length + 1}`,
            scripts: lines,
            summary: instruction.slice(0, 50) || "自动生成脚本",
            timestamp: Date.now()
        };
        const updatedGroups = [newGroup, ...scriptGroups];
        setScriptGroups(updatedGroups);
        await saveToStorage('cine_script_groups', updatedGroups);
        
    } catch (err) {
        console.error("Script generation failed:", err);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSaveGroup = async (customScripts?: string[]) => {
      const targetScripts = customScripts || (scriptItems.filter(s => s.selected).length > 0 
          ? scriptItems.filter(s => s.selected).map(s => s.content)
          : scriptItems.map(s => s.content));
      
      if (targetScripts.length === 0) return;

      const newGroup: ScriptGroup = {
          id: crypto.randomUUID(),
          name: `分镜脚本组 ${scriptGroups.length + 1}`,
          scripts: targetScripts,
          summary: instruction.slice(0, 50) || "已保存脚本",
          timestamp: Date.now()
      };
      
      const updated = [newGroup, ...scriptGroups];
      setScriptGroups(updated);
      await saveToStorage('cine_script_groups', updated);
  };

  const handleRenameGroup = async (id: string, newName: string) => {
      const updated = scriptGroups.map(g => g.id === id ? { ...g, name: newName } : g);
      setScriptGroups(updated);
      await saveToStorage('cine_script_groups', updated);
      setEditingGroupId(null);
  };

  const handleDeleteGroup = async (id: string) => {
      const updated = scriptGroups.filter(g => g.id !== id);
      setScriptGroups(updated);
      await saveToStorage('cine_script_groups', updated);
  };

  const handleLoadGroup = (group: ScriptGroup) => {
      setScriptItems(group.scripts.map(s => ({ id: crypto.randomUUID(), content: s, selected: true })));
      setInstruction(group.summary || "");
      setActiveTab('input');
  };

  const handleSavePrompt = async () => {
    if (!instruction.trim()) return;
    const newPrompt: SavedPrompt = {
      id: crypto.randomUUID(),
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
        
        // Manual save triggered by "Apply" to ensure the specific selected set is preserved
        await handleSaveGroup(selectedTexts);
        
        onApplyScripts(summary, selectedTexts);
        onClose();
    } catch (e) {
        console.error(e);
    } finally {
        setIsSummarizing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setScriptItems(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const updateScriptContent = (id: string, content: string) => {
    setScriptItems(prev => prev.map(item => 
      item.id === id ? { ...item, content } : item
    ));
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
                智能脚本拆解 (AI SCRIPT DECONSTRUCT)
              </h2>
              <p className="text-[10px] text-zinc-300 font-mono mt-0.5 uppercase tracking-widest">
                结构：时间，景别，拍摄角度，构图，角色标号+名称，角色的行为动作...
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-all hover:rotate-90">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Input & History Navigation */}
          <div className="w-[380px] border-r border-zinc-800 flex flex-col bg-zinc-900/30">
            <div className="flex border-b border-zinc-800">
                <button 
                    onClick={() => setActiveTab('input')}
                    className={`flex-1 py-4 text-[10px] font-mono uppercase tracking-widest font-bold transition-all ${activeTab === 'input' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    脚本生成
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-4 text-[10px] font-mono uppercase tracking-widest font-bold transition-all ${activeTab === 'history' ? 'text-cine-accent bg-cine-accent/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    脚本历史
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {activeTab === 'input' ? (
                    <>
                        <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase text-zinc-300 font-bold tracking-[0.2em] flex items-center gap-2">
                            <FileText size={12} /> 文档与提示词输入
                            </label>
                            {instruction.trim() && (
                                <button onClick={() => setInstruction("")} className="text-zinc-500 hover:text-red-500 transition-colors">
                                    <Eraser size={12} />
                                </button>
                            )}
                        </div>
                        <textarea 
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder="在此输入故事大纲、场景描述或点击下方上传文档..."
                            className="w-full bg-black/40 border border-zinc-800 rounded-sm p-4 text-[12px] text-zinc-200 font-mono min-h-[160px] focus:border-cine-accent focus:ring-0 resize-none leading-relaxed placeholder:text-zinc-600"
                        />
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Button 
                                variant="primary" 
                                size="sm" 
                                className="w-full text-[9px] h-9 pr-10" 
                                onClick={() => fileInputRef.current?.click()}
                                >
                                <FileUp size={12} className="mr-2" />
                                {fileName ? `${fileName.slice(0, 15)}...` : '上传文档 (.txt)'}
                                </Button>
                                {fileName && (
                                    <button onClick={handleClearAttachment} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-red-500">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} />
                            <Button variant="secondary" size="sm" className="h-9 w-9 p-0" onClick={handleSavePrompt} disabled={!instruction.trim()}>
                            <Save size={14} />
                            </Button>
                        </div>
                        </div>

                        <div className="space-y-4">
                        <label className="text-[10px] uppercase text-zinc-300 font-bold tracking-[0.2em] flex items-center gap-2">
                            <Hash size={12} /> 拆解脚本条数
                        </label>
                        <div className="flex items-center gap-4 bg-black/40 border border-zinc-800 p-3 rounded-sm">
                            <input 
                                type="number" 
                                min="1" 
                                max="64" 
                                value={panelCount} 
                                onChange={(e) => setPanelCount(Math.min(64, Math.max(1, parseInt(e.target.value) || 1)))}
                                className="flex-1 bg-transparent border-none text-cine-accent font-mono font-bold text-sm focus:ring-0 text-center"
                            />
                            <span className="text-[9px] text-zinc-500 font-mono uppercase">PANELS</span>
                        </div>
                        </div>

                        <div className="space-y-4">
                        <label className="text-[10px] uppercase text-zinc-300 font-bold tracking-[0.2em] flex items-center gap-2">
                            <BookOpen size={12} /> 已保存指令库
                        </label>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
                            {savedPrompts.map(p => (
                            <div key={p.id} className="group relative bg-black/40 border border-zinc-800/60 p-2.5 rounded-sm hover:border-zinc-600 transition-all cursor-pointer" onClick={() => setInstruction(p.content)}>
                                <div className="text-[9px] text-zinc-300 font-mono truncate pr-6">{p.title}</div>
                                <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveSavedPrompt(p.id); }}
                                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 transition-all"
                                >
                                <Trash2 size={11} />
                                </button>
                            </div>
                            ))}
                            {savedPrompts.length === 0 && <p className="text-[9px] text-zinc-600 font-mono italic p-2">暂无保存指令</p>}
                        </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                         <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase text-zinc-300 font-bold tracking-[0.2em] flex items-center gap-2">
                                <History size={12} /> 历史脚本组
                            </label>
                            <span className="text-[8px] text-zinc-500 font-mono uppercase">{scriptGroups.length} 组</span>
                         </div>
                         <div className="space-y-3">
                             {scriptGroups.map(group => (
                                 <div key={group.id} className="group relative bg-black/40 border border-zinc-800/60 rounded-sm p-3 hover:border-cine-accent/30 transition-all">
                                     <div className="flex items-center justify-between mb-2">
                                         {editingGroupId === group.id ? (
                                             <input 
                                                autoFocus
                                                defaultValue={group.name}
                                                onBlur={(e) => handleRenameGroup(group.id, e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleRenameGroup(group.id, (e.target as HTMLInputElement).value)}
                                                className="bg-zinc-900 border border-cine-accent text-[10px] text-zinc-200 font-mono px-2 py-1 rounded w-full mr-2"
                                             />
                                         ) : (
                                            <div className="flex items-center gap-2 truncate">
                                                <FolderOpen size={12} className="text-zinc-500" />
                                                <span className="text-[10px] text-zinc-200 font-bold font-mono tracking-wider truncate">{group.name}</span>
                                            </div>
                                         )}
                                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                            <button onClick={() => setEditingGroupId(group.id)} className="p-1 text-zinc-500 hover:text-white"><Edit3 size={11} /></button>
                                            <button onClick={() => handleDeleteGroup(group.id)} className="p-1 text-zinc-500 hover:text-red-500"><Trash2 size={11} /></button>
                                         </div>
                                     </div>
                                     <p className="text-[8px] text-zinc-500 font-mono line-clamp-2 mb-3 leading-relaxed">{group.summary || '无梗概'}</p>
                                     <Button 
                                        variant="primary" 
                                        size="sm" 
                                        className="w-full text-[8px] h-7 bg-zinc-800/50" 
                                        onClick={() => handleLoadGroup(group)}
                                     >
                                         载入此脚本组
                                     </Button>
                                 </div>
                             ))}
                             {scriptGroups.length === 0 && <p className="text-[9px] text-zinc-600 font-mono italic p-6 text-center">尚无保存的历史脚本组</p>}
                         </div>
                    </div>
                )}
            </div>

            {activeTab === 'input' && (
                <div className="mt-auto p-6 border-t border-zinc-800">
                    <Button 
                        variant="accent" 
                        className="w-full h-12 gap-3 shadow-lg"
                        onClick={handleGenerate}
                        disabled={isGenerating || (!instruction.trim() && !attachmentContent)}
                    >
                        {isGenerating ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Send size={16} />}
                        {isGenerating ? '正在智能拆解...' : '执行拆解任务'}
                    </Button>
                </div>
            )}
          </div>

          {/* Right: Results Area */}
          <div className="flex-1 bg-black/60 p-8 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <label className="text-[10px] uppercase text-zinc-300 font-bold tracking-[0.2em] flex items-center gap-2">
                <Layers size={14} /> 生成脚本详情 (PREVIEW)
              </label>
              <div className="flex gap-4">
                <button onClick={() => setScriptItems(s => s.map(i => ({...i, selected: true})))} className="text-[9px] text-zinc-400 hover:text-white font-mono uppercase tracking-widest border-b border-zinc-800 hover:border-white transition-all">全选</button>
                <button onClick={() => setScriptItems(s => s.map(i => ({...i, selected: false})))} className="text-[9px] text-zinc-400 hover:text-white font-mono uppercase tracking-widest border-b border-zinc-800 hover:border-white transition-all">取消全选</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
               <div className="grid grid-cols-1 gap-4">
                 {scriptItems.map((item, idx) => (
                   <div key={item.id} className={`flex gap-4 items-start p-4 bg-zinc-900/40 border rounded-sm transition-all duration-300 ${item.selected ? 'border-cine-accent/50 bg-cine-accent/5 shadow-[0_0_15px_rgba(255,122,0,0.05)]' : 'border-zinc-800'}`}>
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-bold font-mono transition-colors ${item.selected ? 'bg-cine-accent border-cine-accent text-black' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <textarea 
                        value={item.content}
                        onChange={(e) => updateScriptContent(item.id, e.target.value)}
                        className="flex-1 bg-transparent border-none p-0 text-[13px] text-zinc-200 font-mono focus:ring-0 resize-none min-h-[50px] leading-relaxed"
                      />
                      <button 
                        onClick={() => toggleSelection(item.id)}
                        className={`px-4 h-9 rounded-sm transition-all border flex items-center gap-2 text-[10px] font-mono tracking-widest font-bold ${item.selected ? 'bg-cine-accent text-black border-cine-accent shadow-[0_0_10px_rgba(255,122,0,0.3)]' : 'bg-black/40 text-zinc-500 border-zinc-800 hover:text-white hover:border-zinc-700'}`}
                      >
                        {item.selected ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        {item.selected ? '已选用' : '选用'}
                      </button>
                   </div>
                 ))}
                 {!isGenerating && scriptItems.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-6 py-20">
                     <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 opacity-30">
                        <Sparkles size={32} />
                     </div>
                     <p className="font-mono text-[11px] uppercase tracking-[0.3em]">等待输入指令并执行拆解...</p>
                   </div>
                 )}
               </div>
            </div>

            <div className="mt-8 flex justify-end gap-6 border-t border-zinc-800 pt-6">
               <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
                 已选择 <span className="text-cine-accent font-bold">{scriptItems.filter(i => i.selected).length}</span> 条脚本同步至镜头逻辑
               </span>
               <div className="flex gap-4">
                   <Button variant="ghost" onClick={onClose} className="px-8 h-12 border border-zinc-800">取消</Button>
                   <Button 
                    variant="accent" 
                    className="px-12 h-12 shadow-xl tracking-[0.1em] min-w-[200px]"
                    onClick={handleApply}
                    disabled={isSummarizing || scriptItems.filter(i => i.selected).length === 0}
                   >
                     {isSummarizing ? (
                         <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin mr-3" />
                     ) : (
                         <Check size={18} className="mr-3" />
                     )}
                     {isSummarizing ? '正在同步...' : '应用并同步 (SYNC)'}
                   </Button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
