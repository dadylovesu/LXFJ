
import JSZip from 'jszip';
import { ProjectState, GeneratedImage } from '../types';

/**
 * 格式化导出 ZIP 项目文件夹
 * 包含：项目 JSON 脚本 + 素材库 (Assets)
 * 修复结构：一整个分镜组的图放在一个文件夹
 */
export const exportProjectBundle = async (project: ProjectState): Promise<Blob> => {
  const zip = new JSZip();
  const projectFolderName = `${project.name}_${new Date().toISOString().slice(0, 10)}`;
  const root = zip.folder(projectFolderName);
  
  if (!root) throw new Error("Could not create ZIP folder");

  // 1. 项目主脚本文件 (.json)
  const projectJson = JSON.stringify(project, null, 2);
  root.file(`${project.name}_v1.json`, projectJson);

  // 2. 素材库文件夹 (Assets)
  const assetsFolder = root.folder("素材库 (Assets)");
  if (assetsFolder) {
    const renderNodes = project.images.filter(i => i.nodeType === 'render' || i.nodeType === 'lens_lab');
    
    // 按时间顺序排序，确保导出的文件夹顺序是 1, 2, 3...
    const sortedNodes = [...renderNodes].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const shotName = `镜头_${i + 1}`;
      const shotFolder = assetsFolder.folder(shotName);
      
      if (shotFolder) {
        // 保存分镜组的每一个分镜 - 放在同一个文件夹下
        if (node.slices) {
          for (let j = 0; j < node.slices.length; j++) {
            const sliceUrl = node.slices[j];
            const imgData = sliceUrl.split(',')[1];
            // 直接保存在 shotFolder 目录下，不建子文件夹
            shotFolder.file(`渲染图_Shot${i+1}_Panel${j+1}.png`, imgData, { base64: true });
          }
        }
        
        // 保存全景宫格图
        const fullImgData = (node.fullGridUrl || node.url).split(',')[1];
        shotFolder.file(`全景宫格_Shot${i+1}.png`, fullImgData, { base64: true });
      }
    }

    // 保存原始参考资产
    const refFolder = assetsFolder.folder("原始参考图 (References)");
    if (refFolder) {
      project.assets.forEach((asset, idx) => {
        const imgData = asset.previewUrl.split(',')[1];
        refFolder.file(`${asset.category}_${asset.index || idx}.png`, imgData, { base64: true });
      });
    }
  }

  return await zip.generateAsync({ type: "blob" });
};

/**
 * 解析项目 JSON
 */
export const parseProjectFile = async (file: File): Promise<ProjectState> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json as ProjectState);
      } catch (err) {
        reject(new Error("无效的项目脚本文件"));
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};
