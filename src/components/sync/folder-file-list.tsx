"use client";

import React, { useMemo, useState, useCallback } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronDown, Folder, File, FolderOpen } from "lucide-react";

interface FileItem {
  filePath: string;
  reason?: string;
  decision?: string;
  [key: string]: any;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  item?: FileItem;
  children: TreeNode[];
  filesCount: number;
}

interface FolderFileListProps {
  files: FileItem[];
  selectedFiles: Set<string>;
  onToggleFile: (filePath: string) => void;
  onFileClick?: (item: FileItem) => void;
  extractMatchInfo?: (filePath: string, tournaments: any[]) => any;
  extractPlayerPhotoInfo?: (filePath: string, tournaments: any[]) => any;
  tournaments?: any[];
  type: 'upload' | 'download' | 'deleteLocal' | 'deleteRemote' | 'conflict';
}

export function FolderFileList({
  files,
  selectedFiles,
  onToggleFile,
  onFileClick,
  extractMatchInfo,
  extractPlayerPhotoInfo,
  tournaments = [],
  type
}: FolderFileListProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // 1. Build the Tree
  const tree = useMemo(() => {
    const root: TreeNode[] = [];

    // Sort files by path first to ensure consistent building
    const sortedFiles = [...files].sort((a, b) => a.filePath.localeCompare(b.filePath));

    sortedFiles.forEach(file => {
      const parts = file.filePath.split('/');
      let currentLevel = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFile = index === parts.length - 1;

        if (isFile) {
          // Check if file already exists (shouldn't happen with unique paths but good safety)
          if (!currentLevel.find(n => n.type === 'file' && n.name === part)) {
            currentLevel.push({
              name: part,
              path: file.filePath,
              type: 'file',
              item: file,
              children: [],
              filesCount: 1
            });
          }
        } else {
          let folderNode = currentLevel.find(n => n.type === 'folder' && n.name === part);
          if (!folderNode) {
            folderNode = {
              name: part,
              path: currentPath,
              type: 'folder',
              children: [],
              filesCount: 0
            };
            currentLevel.push(folderNode);
          }
          folderNode.filesCount++;
          currentLevel = folderNode.children;
        }
      });
    });

    // Recursive sort: Folders first, then files
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(node => {
        if (node.children.length > 0) {
          sortNodes(node.children);
        }
      });
    };

    sortNodes(root);
    return root;
  }, [files]);

  // Collect all file paths in a subtree
  const getSubtreeFiles = useCallback((node: TreeNode): string[] => {
    if (node.type === 'file') return [node.path];
    return node.children.flatMap(getSubtreeFiles);
  }, []);

  // Toggle all files in a folder
  const toggleFolder = useCallback((node: TreeNode) => {
    const allFiles = getSubtreeFiles(node);
    const selectedCount = allFiles.filter(p => selectedFiles.has(p)).length;
    const isFullySelected = selectedCount === allFiles.length;

    // If fully selected, deselect all. Otherwise, select all.
    const shouldSelect = !isFullySelected;

    allFiles.forEach(path => {
      const isSelected = selectedFiles.has(path);
      if (shouldSelect !== isSelected) {
        onToggleFile(path);
      }
    });
  }, [selectedFiles, onToggleFile, getSubtreeFiles]);

  const toggleExpanded = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const getColorClasses = () => {
    switch (type) {
      case 'upload':
        return {
          text: 'text-green-700 dark:text-green-300',
          hover: 'hover:bg-green-100 dark:hover:bg-green-900/30',
          folder: 'text-green-600 dark:text-green-400'
        };
      case 'download':
        return {
          text: 'text-blue-700 dark:text-blue-300',
          hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
          folder: 'text-blue-600 dark:text-blue-400'
        };
      case 'deleteLocal':
      case 'deleteRemote':
        return {
          text: 'text-red-700 dark:text-red-300',
          hover: 'hover:bg-red-100 dark:hover:bg-red-900/30',
          folder: 'text-red-600 dark:text-red-400'
        };
      case 'conflict':
        return {
          text: 'text-yellow-700 dark:text-yellow-300',
          hover: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
          folder: 'text-yellow-600 dark:text-yellow-400'
        };
    }
  };

  const colors = getColorClasses();

  // Recursive Node Renderer
  const FileTreeNode = ({ node, level }: { node: TreeNode; level: number }) => {
    const isExpanded = expandedFolders.has(node.path);

    // Calculate selection status
    const subtreeFiles = useMemo(() => getSubtreeFiles(node), [node]);
    const selectedCount = subtreeFiles.filter(p => selectedFiles.has(p)).length;
    const totalCount = subtreeFiles.length;
    const isFullySelected = totalCount > 0 && selectedCount === totalCount;
    const isPartiallySelected = selectedCount > 0 && selectedCount < totalCount;

    if (node.type === 'folder') {
      return (
        <div className="select-none">
          <div
            className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer ${colors.hover}`}
            style={{ paddingLeft: `${Math.max(8, level * 16)}px` }}
            onClick={() => toggleExpanded(node.path)}
          >
            <div onClick={e => e.stopPropagation()}>
              <Checkbox
                id={`folder-${node.path}`}
                checked={isPartiallySelected ? 'indeterminate' : isFullySelected}
                onCheckedChange={() => toggleFolder(node)}
                className="mt-0.5"
              />
            </div>
            <div className="flex items-center gap-1 flex-1">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              {isExpanded ? (
                <FolderOpen className={`h-4 w-4 shrink-0 ${colors.folder}`} />
              ) : (
                <Folder className={`h-4 w-4 shrink-0 ${colors.folder}`} />
              )}
              <span className={`font-semibold text-sm ${colors.text}`}>
                {node.name}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                ({selectedCount}/{totalCount})
              </span>
            </div>
          </div>
          {isExpanded && (
            <div>
              {node.children.map(child => (
                <FileTreeNode key={child.path} node={child} level={level + 1} />
              ))}
            </div>
          )}
        </div>
      );
    }

    // File Node
    const item = node.item!;
    const isChecked = selectedFiles.has(node.path);
    const matchInfo = extractMatchInfo ? extractMatchInfo(item.filePath, tournaments) : null;
    const photoInfo = extractPlayerPhotoInfo ? extractPlayerPhotoInfo(item.filePath, tournaments) : null;

    return (
      <div
        className={`flex items-start gap-2 py-1 px-2 rounded ${colors.hover}`}
        style={{ paddingLeft: `${Math.max(8, level * 16) + 20}px` }} // +20 for indentation alignment with file icon info
      >
        <Checkbox
          id={`file-${item.filePath}`}
          checked={isChecked}
          onCheckedChange={() => onToggleFile(item.filePath)}
          className="mt-0.5"
        />
        <div
          className={`flex-1 cursor-pointer ${onFileClick ? 'hover:underline' : ''}`}
          onClick={() => onFileClick?.(item)}
        >
          <div className="flex items-center gap-1 flex-wrap">
            <File className="h-3 w-3 shrink-0 opacity-50" />
            <span className={`font-mono text-xs ${colors.text}`}>{node.name}</span>

            {photoInfo?.isUnreferenced && (
              <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
                🟠 NO REFERENCIADA
              </span>
            )}
          </div>

          {matchInfo && (
            <div className={`text-[10px] mt-0.5 font-semibold ${matchInfo.isOutsideFixture
              ? 'text-purple-600 dark:text-purple-400'
              : 'text-orange-600 dark:text-orange-400'
              }`}>
              ({matchInfo.homeTeam} vs {matchInfo.awayTeam}, {matchInfo.category})
              {matchInfo.isOutsideFixture && <span className="ml-1">🔵 FUERA DE FIXTURE</span>}
            </div>
          )}

          {item.reason && type !== 'conflict' && (
            <span className={`text-[10px] block ${colors.text} opacity-70`}>
              Reason: {item.reason}
            </span>
          )}

          {type === 'conflict' && (
            <span className="text-[10px] block mt-0.5">
              {item.decision === 'local-wins' ? '💻 Local gana' :
                item.decision === 'remote-wins' ? '☁️ Remoto gana' :
                  item.decision === 'skip' ? '🚫 Omitir' :
                    '❓ Sin resolver'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-0.5 pb-2">
      {tree.map(node => (
        <FileTreeNode key={node.path} node={node} level={0} />
      ))}
    </div>
  );
}
