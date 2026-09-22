"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, RefreshCw, ChevronRight, ChevronDown, Folder, File, AlertCircle, FolderOpen, Eye, RotateCcw } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useGameState } from "@/contexts/game-state-context";

interface RemoteFile {
    name: string;
    id: string;
    updated_at: string;
    created_at: string;
    metadata: {
        size: number;
        mimetype: string;
    };
}

interface TreeNode {
    name: string;
    path: string;
    type: 'folder' | 'file';
    item?: RemoteFile;
    children: TreeNode[];
    filesCount: number;
}

export function RemoteFileManager() {
    const { state } = useGameState();
    const [files, setFiles] = useState<RemoteFile[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [remoteTournaments, setRemoteTournaments] = useState<any[]>([]);
    const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
    const [loadingFileContent, setLoadingFileContent] = useState(false);
    const [regeneratingManifest, setRegeneratingManifest] = useState(false);
    const { toast } = useToast();

    // Helper to extract match info from file path
    const extractMatchInfo = useCallback((filePath: string) => {
        const summaryMatch = filePath.match(/tournaments\/([^/]+)\/summaries\/([^/]+)\.json/);
        if (!summaryMatch) return null;

        const [, tournamentId, matchId] = summaryMatch;
        const tournaments = state?.tournament?.tournaments || [];

        // Find the tournament
        let tournament = tournaments.find(t => t.id === tournamentId);

        // If tournament not found, search all tournaments for the match
        if (!tournament) {
            for (const t of tournaments) {
                if (t.matches?.find(m => m.id === matchId)) {
                    tournament = t;
                    break;
                }
            }
        }

        // If still no tournament or tournament doesn't have matches loaded
        if (!tournament || !tournament.matches || tournament.matches.length === 0) {
            const tournamentExists = tournaments.find(t => t.id === tournamentId);
            if (tournamentExists) {
                return { isOutsideFixture: true, tournamentId, matchId };
            }
            return null;
        }

        // Find the match
        const match = tournament.matches.find(m => m.id === matchId);
        if (!match) {
            return { isOutsideFixture: true, tournamentId, matchId };
        }

        return { isOutsideFixture: false, tournamentId, matchId };
    }, [state?.tournament?.tournaments]);

    // Helper to extract player photo info from file path
    const extractPlayerPhotoInfo = useCallback((filePath: string) => {
        // Pattern: tournaments/{tournamentId}/players/{teamSlug}/{photoFileName}
        const photoMatch = filePath.match(/tournaments\/([^/]+)\/players\/([^/]+)\/([^/]+\.(png|jpg|jpeg|webp))$/i);
        if (!photoMatch) return null;

        const [, tournamentId, teamSlug, photoFileName] = photoMatch;
        const tournament = remoteTournaments.find(t => t.id === tournamentId);

        if (!tournament || !tournament.teams) {
            // Cannot determine if unreferenced without teams data
            return null;
        }

        // Check if any team references this player photo by photoFileName
        const isReferenced = tournament.teams.some(team =>
            team.players?.some(player => player.photoFileName === photoFileName)
        );

        return { isUnreferenced: !isReferenced, tournamentId, teamSlug, photoFileName };
    }, [remoteTournaments]);

    // Detect summaries outside fixture
    const summariesOutsideFixture = useMemo(() => {
        return files.filter(file => {
            const matchInfo = extractMatchInfo(file.name);
            return matchInfo?.isOutsideFixture === true;
        });
    }, [files, extractMatchInfo]);

    // Detect unreferenced player photos
    const unreferencedPlayerPhotos = useMemo(() => {
        return files.filter(file => {
            const photoInfo = extractPlayerPhotoInfo(file.name);
            return photoInfo?.isUnreferenced === true;
        });
    }, [files, extractPlayerPhotoInfo]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/sync/remote-files');
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load files');
            }

            setFiles(data.files);

            // Load tournaments from Supabase to check photo references
            try {
                const tournamentsResponse = await fetch('/api/sync/remote-tournaments');
                const tournamentsData = await tournamentsResponse.json();

                if (tournamentsData.success) {
                    setRemoteTournaments(tournamentsData.tournaments || []);
                }
            } catch (error) {
                console.error('Error loading remote tournaments:', error);
            }

            toast({
                title: "✅ Archivos cargados",
                description: `${data.totalFiles} archivo(s) encontrados en Supabase`,
            });
        } catch (error) {
            toast({
                title: "❌ Error",
                description: error instanceof Error ? error.message : 'Error al cargar archivos',
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // 1. Build the Tree
    const tree = useMemo(() => {
        const root: TreeNode[] = [];

        // Sort files by path first
        const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));

        sortedFiles.forEach(file => {
            const parts = file.name.split('/');
            let currentLevel = root;
            let currentPath = '';

            parts.forEach((part, index) => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const isFile = index === parts.length - 1;

                if (isFile) {
                    if (!currentLevel.find(n => n.type === 'file' && n.name === part)) {
                        currentLevel.push({
                            name: part,
                            path: file.name,
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

        // Recursive sort
        const sortNodes = (nodes: TreeNode[]) => {
            nodes.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                }

                // For files, sort by modification date (most recent first)
                if (a.type === 'file' && b.type === 'file') {
                    const dateA = new Date(a.item?.updated_at || 0).getTime();
                    const dateB = new Date(b.item?.updated_at || 0).getTime();
                    return dateB - dateA; // Descending order (most recent first)
                }

                // For folders, sort alphabetically
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

    const toggleFileSelection = (filePath: string) => {
        const newSelected = new Set(selectedFiles);
        if (newSelected.has(filePath)) {
            newSelected.delete(filePath);
        } else {
            newSelected.add(filePath);
        }
        setSelectedFiles(newSelected);
    };

    // Toggle all files in a folder recursively
    const toggleFolder = useCallback((node: TreeNode) => {
        const allFiles = getSubtreeFiles(node);
        const selectedCount = allFiles.filter(p => selectedFiles.has(p)).length;
        const isFullySelected = selectedCount === allFiles.length;

        const shouldSelect = !isFullySelected;

        const newSelected = new Set(selectedFiles);
        allFiles.forEach(path => {
            if (shouldSelect) {
                newSelected.add(path);
            } else {
                newSelected.delete(path);
            }
        });
        setSelectedFiles(newSelected);
    }, [selectedFiles, getSubtreeFiles]);

    const toggleExpanded = (path: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const handleSelectOutsideFixture = () => {
        const newSelected = new Set(selectedFiles);
        summariesOutsideFixture.forEach(file => {
            newSelected.add(file.name);
        });
        setSelectedFiles(newSelected);

        toast({
            title: "✅ Summaries seleccionados",
            description: `${summariesOutsideFixture.length} summaries fuera de fixture seleccionados`,
        });
    };

    const handleSelectUnreferencedPhotos = () => {
        const newSelected = new Set(selectedFiles);
        unreferencedPlayerPhotos.forEach(file => {
            newSelected.add(file.name);
        });
        setSelectedFiles(newSelected);

        toast({
            title: "✅ Fotos seleccionadas",
            description: `${unreferencedPlayerPhotos.length} fotos no referenciadas seleccionadas`,
        });
    };

    const handleDeleteSelected = async () => {
        if (selectedFiles.size === 0) {
            toast({
                title: "⚠️ Sin selección",
                description: "Selecciona al menos un archivo para borrar",
                variant: "destructive",
            });
            return;
        }

        const isDeletingManifest = selectedFiles.has('sync-manifest.json');
        let confirmMessage = `¿Estás seguro de borrar ${selectedFiles.size} archivo(s) de Supabase?`;

        if (isDeletingManifest) {
            confirmMessage += '\n\n⚠️ ADVERTENCIA: Estás borrando el manifest. Esto eliminará el registro de sincronización.';
        } else {
            confirmMessage += ' Esta acción marcará los archivos como borrados en el manifest.';
        }

        if (!confirm(confirmMessage)) {
            return;
        }

        setDeleting(true);
        try {
            const response = await fetch('/api/sync/remote-files', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filePaths: Array.from(selectedFiles)
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to delete files');
            }

            toast({
                title: "✅ Archivos borrados",
                description: `${data.deleted.length} archivo(s) borrados exitosamente${data.errors.length > 0 ? `, ${data.errors.length} fallaron` : ''}`,
            });

            // Clear selection and reload
            setSelectedFiles(new Set());
            await loadFiles();

        } catch (error) {
            toast({
                title: "❌ Error",
                description: error instanceof Error ? error.message : 'Error al borrar archivos',
                variant: "destructive",
            });
        } finally {
            setDeleting(false);
        }
    };

    const handleViewFile = async (filePath: string) => {
        setLoadingFileContent(true);
        try {
            const response = await fetch(`/api/sync/remote-file-content?filePath=${encodeURIComponent(filePath)}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load file content');
            }

            setViewingFile({ path: filePath, content: data.content });
        } catch (error) {
            toast({
                title: "❌ Error",
                description: error instanceof Error ? error.message : 'Error al cargar contenido',
                variant: "destructive",
            });
        } finally {
            setLoadingFileContent(false);
        }
    };

    const handleRegenerateManifest = async () => {
        if (!confirm('¿Estás seguro de regenerar el manifest de Supabase?\n\nEsto recreará el manifest basándose únicamente en los archivos que existen actualmente en Supabase.')) {
            return;
        }

        setRegeneratingManifest(true);
        try {
            const response = await fetch('/api/sync/regenerate-remote-manifest', {
                method: 'POST'
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to regenerate manifest');
            }

            toast({
                title: "✅ Manifest regenerado",
                description: `Manifest recreado con ${data.fileCount} archivo(s)`,
            });

            await loadFiles();
        } catch (error) {
            toast({
                title: "❌ Error",
                description: error instanceof Error ? error.message : 'Error al regenerar manifest',
                variant: "destructive",
            });
        } finally {
            setRegeneratingManifest(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('es-AR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Recursive Node Renderer
    const RemoteFileTreeNode = ({ node, level }: { node: TreeNode; level: number }) => {
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
                        className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded cursor-pointer"
                        style={{ paddingLeft: `${Math.max(8, level * 16)}px` }}
                    >
                        <Checkbox
                            id={`folder-${node.path}`}
                            checked={isPartiallySelected ? 'indeterminate' : isFullySelected}
                            onCheckedChange={() => toggleFolder(node)}
                            className="mt-0.5"
                        />
                        <div
                            className="flex items-center gap-1 flex-1"
                            onClick={() => toggleExpanded(node.path)}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            {isExpanded ? (
                                <FolderOpen className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            ) : (
                                <Folder className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            )}
                            <span className="font-semibold text-sm">
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
                                <RemoteFileTreeNode key={child.path} node={child} level={level + 1} />
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        // File Node
        const file = node.item!;
        const isManifest = file.name === 'sync-manifest.json';
        const isChecked = selectedFiles.has(node.path);
        const matchInfo = extractMatchInfo(file.name);
        const isOutsideFixture = matchInfo?.isOutsideFixture === true;
        const photoInfo = extractPlayerPhotoInfo(file.name);
        const isUnreferencedPhoto = photoInfo?.isUnreferenced === true;

        return (
            <div
                className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted/50"
                style={{ paddingLeft: `${Math.max(8, level * 16) + 20}px` }}
            >
                <Checkbox
                    id={`file-${file.name}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleFileSelection(file.name)}
                    className="mt-0.5"
                />
                <div className="flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                        <File className="h-3 w-3 shrink-0 opacity-50" />
                        <span
                            className={`font-mono text-xs ${!isManifest ? 'cursor-pointer hover:underline' : 'cursor-pointer hover:underline text-blue-600 dark:text-blue-400'}`}
                            onClick={() => handleViewFile(file.name)}
                        >
                            {node.name}
                        </span>
                        {isManifest && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                Manifest
                            </span>
                        )}
                        {isOutsideFixture && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                <AlertCircle className="h-2.5 w-2.5" />
                                Fuera de fixture
                            </span>
                        )}
                        {isUnreferencedPhoto && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
                                <AlertCircle className="h-2.5 w-2.5" />
                                No referenciada
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-muted-foreground ml-4 mt-0.5">
                        {formatSize(file.metadata.size)} • Modificado: {formatDate(file.updated_at)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            Archivos Remotos (Supabase)
                            {summariesOutsideFixture.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md">
                                    <AlertCircle className="h-3 w-3" />
                                    {summariesOutsideFixture.length} fuera de fixture
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Administra archivos en el storage remoto. Los archivos borrados se marcan en el manifest para sincronizar el borrado.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadFiles}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Cargando...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    {files.length === 0 ? 'Cargar Archivos' : 'Recargar'}
                                </>
                            )}
                        </Button>
                        {summariesOutsideFixture.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectOutsideFixture}
                                className="border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            >
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Seleccionar Fuera de Fixture
                            </Button>
                        )}
                        {unreferencedPlayerPhotos.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectUnreferencedPhotos}
                                className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                            >
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Seleccionar Fotos No Referenciadas
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRegenerateManifest}
                            disabled={regeneratingManifest}
                            className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                            {regeneratingManifest ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <RotateCcw className="h-4 w-4 mr-2" />
                            )}
                            Regenerar Manifest
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteSelected}
                            disabled={selectedFiles.size === 0 || deleting}
                        >
                            {deleting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Borrar ({selectedFiles.size})
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span>Cargando archivos...</span>
                    </div>
                ) : files.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p className="mb-2">Haz click en "Cargar Archivos" para ver el directorio de Supabase</p>
                        <p className="text-xs">Los archivos se cargan bajo demanda para mejorar el rendimiento</p>
                    </div>
                ) : (
                    <div className="space-y-0.5 max-h-96 overflow-y-auto">
                        {tree.map(node => (
                            <RemoteFileTreeNode key={node.path} node={node} level={0} />
                        ))}
                    </div>
                )}
            </CardContent>

            {/* File content viewer dialog */}
            <Dialog open={viewingFile !== null} onOpenChange={(open) => !open && setViewingFile(null)}>
                <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="font-mono text-sm">{viewingFile?.path}</DialogTitle>
                        <DialogDescription>
                            Contenido del archivo desde Supabase
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-auto max-h-[60vh]">
                        <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                            <code>{viewingFile?.content}</code>
                        </pre>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
