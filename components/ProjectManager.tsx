
import React, { useState, useRef } from 'react';
import { 
  FolderOpen, Save, FilePlus, Download, 
  ChevronDown, Edit3, Trash2, Check, 
  Files, Package, AlertTriangle, X, 
  History, Settings
} from 'lucide-react';
import { Button } from './Button';
import { ProjectState } from '../types';

interface ProjectManagerProps {
  projects: ProjectState[];
  activeProjectId: string;
  onSwitchProject: (id: string) => void;
  onNewProject: () => void;
  onImportProject: (file: File) => void;
  onExportFull: () => void;
  onSaveIncremental: () => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  activeProjectId,
  onSwitchProject,
  onNewProject,
  onImportProject,
  onExportFull,
  onSaveIncremental,
  onRenameProject,
  onDeleteProject
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="border-b border-zinc-800 bg-black/40 px-5 py-3 relative z-[60]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-cine-accent flex items-center justify-center shadow-[0_0_15px_rgba(255,122,0,0.2)]">
                <FolderOpen size={16} className="text-black" />
            </div>
            <div className="group relative">
                <button 
                  onClick={() => setIsOpen(!isOpen)}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                    <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-100">
                        {activeProject?.name || "未命名工程"}
                    </span>
                    <ChevronDown size={12} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <button 
              onClick={onSaveIncremental}
              className="p-2 text-zinc-400 hover:text-cine-accent hover:bg-zinc-800 rounded-md transition-all group"
              title="保存工程脚本 (Ctrl+S)"
            >
                <Save size={16} />
            </button>
            <button 
              onClick={onExportFull}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 text-zinc-200 text-[12px] font-bold font-mono tracking-widest rounded-[2px] border border-zinc-700 hover:bg-zinc-700 transition-all"
            >
                <Package size={12} />
                导出完整工程
            </button>
        </div>
      </div>

      {/* Project Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-5 right-5 mt-2 bg-cine-dark border border-zinc-800 rounded-sm shadow-2xl animate-in slide-in-from-top-2 duration-200">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <span className="text-[12px] font-mono font-bold text-zinc-400 uppercase tracking-widest">工程库 (PROJECTS)</span>
                <div className="flex gap-2">
                    <button onClick={() => importRef.current?.click()} className="text-[12px] text-cine-accent hover:underline font-mono">导入脚本</button>
                    <input type="file" ref={importRef} className="hidden" accept=".json" onChange={(e) => e.target.files && onImportProject(e.target.files[0])} />
                </div>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {projects.map(p => (
                    <div 
                        key={p.id} 
                        className={`group flex items-center justify-between p-4 border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors cursor-pointer ${p.id === activeProjectId ? 'bg-cine-accent/5' : ''}`}
                        onClick={() => { onSwitchProject(p.id); setIsOpen(false); }}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-1.5 h-1.5 rounded-full ${p.id === activeProjectId ? 'bg-cine-accent animate-pulse' : 'bg-zinc-700'}`}></div>
                            {editingId === p.id ? (
                                <input 
                                    autoFocus
                                    className="bg-black border border-cine-accent text-zinc-100 font-mono text-[13px] px-2 py-1 rounded"
                                    defaultValue={p.name}
                                    onClick={e => e.stopPropagation()}
                                    onBlur={e => { onRenameProject(p.id, e.target.value); setEditingId(null); }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') { onRenameProject(p.id, (e.target as HTMLInputElement).value); setEditingId(null); }
                                    }}
                                />
                            ) : (
                                <span className={`text-[13px] font-mono font-bold tracking-wider ${p.id === activeProjectId ? 'text-cine-accent' : 'text-zinc-300'}`}>
                                    {p.name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingId(p.id); }}
                                className="p-1.5 text-zinc-400 hover:text-white"
                            >
                                <Edit3 size={12} />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }}
                                className="p-1.5 text-zinc-400 hover:text-red-500"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-zinc-900/50">
                <Button 
                    variant="primary" 
                    className="w-full text-[12px] h-9 border-dashed border-zinc-700"
                    onClick={() => { onNewProject(); setIsOpen(false); }}
                >
                    <FilePlus size={12} className="mr-2" />
                    开启新工程
                </Button>
            </div>
        </div>
      )}
    </div>
  );
};
