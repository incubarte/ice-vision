"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FilePlus, FileText, Trash2, FolderPlus, FolderMinus, List } from 'lucide-react';

export default function FsDiagPage() {
    const [filename, setFilename] = useState('test-file.txt');
    const [folderName, setFolderName] = useState('test-folder');
    const [content, setContent] = useState('Hello, world!');
    const [output, setOutput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleApiCall = async (action: string, body: object) => {
        setIsLoading(true);
        setOutput('');
        try {
            const response = await fetch('/api/diag/fs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...body }),
            });
            const result = await response.json();
            if (result.success) {
                let formattedOutput = `${result.message}`;
                if (result.data) {
                    formattedOutput += `\n\n${Array.isArray(result.data) ? result.data.join('\n') : result.data}`;
                }
                setOutput(formattedOutput);
            } else {
                setOutput(`Error: ${result.message}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setOutput(`Fetch Error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 p-4 sm:p-6">
            <h1 className="text-3xl font-bold text-primary-foreground">File System Diagnostics (/tmp)</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>File Operations</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Input value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="Enter filename" />
                        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Enter file content" />
                        <div className="flex gap-2 flex-wrap">
                            <Button onClick={() => handleApiCall('create_file', { filename, content })} disabled={isLoading}><FilePlus className="mr-2 h-4 w-4"/>Create/Write</Button>
                            <Button onClick={() => handleApiCall('read_file', { filename })} disabled={isLoading}><FileText className="mr-2 h-4 w-4"/>Read</Button>
                            <Button variant="destructive" onClick={() => handleApiCall('delete_file', { filename })} disabled={isLoading}><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Folder Operations</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Enter folder name" />
                        <div className="flex gap-2 flex-wrap">
                            <Button onClick={() => handleApiCall('create_folder', { folderName })} disabled={isLoading}><FolderPlus className="mr-2 h-4 w-4"/>Create</Button>
                            <Button variant="destructive" onClick={() => handleApiCall('delete_folder', { folderName })} disabled={isLoading}><FolderMinus className="mr-2 h-4 w-4"/>Delete</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Directory Listing</CardTitle></CardHeader>
                <CardContent>
                    <Button onClick={() => handleApiCall('list_files', {})} disabled={isLoading}><List className="mr-2 h-4 w-4"/>List /tmp Contents</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Output</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p>Loading...</p>
                    ) : (
                        <pre className="p-4 bg-muted rounded-md overflow-x-auto text-sm">{output || 'Output will be shown here.'}</pre>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
