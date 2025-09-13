
'use client';

import React, { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Mic, Trash2, FileText, Library, PlusCircle, Cloud, Folder as FolderIcon, FolderPlus, ChevronRight, UploadCloud, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Document, Folder } from '@/lib/db';
import { Input } from './ui/input';
import { useToast } from '@/hooks/use-toast';

type DocumentLibraryProps = {
  documents: Document[];
  folders: Folder[];
  activeDocId: string | null;
  onSelect: (doc: Document) => void;
  onDelete: (docId: string) => void;
  onGenerateAudio: (doc: Document) => void;
  onUploadNew: (folderId?: string) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onMoveDocument: (docId: string, folderId: string | null) => Promise<void>;
};

export default function DocumentLibrary({
  documents,
  folders,
  activeDocId,
  onSelect,
  onDelete,
  onGenerateAudio,
  onUploadNew,
  onCreateFolder,
  onDeleteFolder,
  onMoveDocument,
}: DocumentLibraryProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleToggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
        await onCreateFolder(newFolderName.trim());
        setNewFolderName('');
        setIsCreatingFolder(false);
    } catch(e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not create folder.'})
    }
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, docId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedDocId(docId);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, folderId: string | null) => {
    e.preventDefault();
    if (draggedDocId) {
        onMoveDocument(draggedDocId, folderId);
        setDraggedDocId(null);
    }
  };

  const rootDocuments = documents.filter(d => !d.folderId);

  return (
    <div>
      <div className="flex justify-between items-center p-2 text-sm font-semibold text-muted-foreground">
        <div className="flex items-center gap-2">
          <Library />
          My Documents
        </div>
        <div className='flex items-center gap-1'>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsCreatingFolder(true)}>
                        <FolderPlus className="h-5 w-5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>New Folder</p></TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUploadNew()}>
                        <PlusCircle className="h-5 w-5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>New Document</p></TooltipContent>
            </Tooltip>
        </div>
      </div>
      <div className="px-2 space-y-1">
        {isCreatingFolder && (
            <div className='flex gap-2 p-1'>
                <Input 
                    value={newFolderName} 
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Folder Name"
                    className="h-8"
                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                    autoFocus
                />
                <Button size="sm" onClick={handleCreateFolder}>Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsCreatingFolder(false)}>Cancel</Button>
            </div>
        )}
        {folders.map(folder => (
            <div key={folder.id} onDragOver={e => e.preventDefault()} onDrop={(e) => handleDrop(e, folder.id)}>
                <div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm group bg-muted/50">
                    <button onClick={() => handleToggleFolder(folder.id)} className="flex items-center flex-1 gap-2">
                        <ChevronRight className={cn("h-4 w-4 transition-transform", expandedFolders[folder.id] && "rotate-90")}/>
                        <FolderIcon />
                        <span className="truncate max-w-[120px] font-medium">{folder.name}</span>
                    </button>
                    <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUploadNew(folder.id)}>
                                    <UploadCloud className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Upload to folder</p></TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Delete folder</p></TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{folder.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete the folder and ALL documents inside it. This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDeleteFolder(folder.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
                {expandedFolders[folder.id] && (
                    <div className="pl-6 pt-1 space-y-1">
                        {documents.filter(d => d.folderId === folder.id).map(doc => <DocumentItem key={doc.id} {...{doc, activeDocId, onSelect, onDelete, onGenerateAudio, onDragStart: handleDragStart}} />)}
                    </div>
                )}
            </div>
        ))}
         <div onDragOver={e => e.preventDefault()} onDrop={(e) => handleDrop(e, null)}>
            {rootDocuments.map(doc => <DocumentItem key={doc.id} {...{doc, activeDocId, onSelect, onDelete, onGenerateAudio, onDragStart: handleDragStart}} />)}
        </div>
      </div>
    </div>
  );
}

const DocumentItem = ({ doc, activeDocId, onSelect, onDelete, onGenerateAudio, onDragStart }: { doc: Document; activeDocId: string | null; onSelect: (doc: Document) => void; onDelete: (docId: string) => void; onGenerateAudio: (doc: Document) => void; onDragStart: (e: React.DragEvent<HTMLDivElement>, docId: string) => void; }) => (
    <div 
        draggable 
        onDragStart={(e) => onDragStart(e, doc.id)}
        className={cn(
            "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm group cursor-move",
            activeDocId === doc.id && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
    )}>
        <FileText />
        <div className="flex-1 flex items-center justify-between">
            <Tooltip>
            <TooltipTrigger asChild>
                <button onClick={() => onSelect(doc)} className="truncate max-w-[150px] text-left hover:underline">
                {doc.fileName}
                </button>
            </TooltipTrigger>
            <TooltipContent><p>{doc.fileName}</p></TooltipContent>
            </Tooltip>
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            {doc.audioGenerationStatus === 'processing' ? (
                <Tooltip>
                    <TooltipTrigger asChild><Loader2 className="h-4 w-4 animate-spin text-primary mr-1" /></TooltipTrigger>
                    <TooltipContent><p>Audio is generating...</p></TooltipContent>
                </Tooltip>
            ) : doc.audioGenerationStatus === 'completed' && doc.audioUrl ? (
                <Tooltip>
                    <TooltipTrigger asChild><Cloud className="h-4 w-4 text-primary mr-1" /></TooltipTrigger>
                    <TooltipContent><p>Audio is ready</p></TooltipContent>
                </Tooltip>
            ) : (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onGenerateAudio(doc)}>
                            <Mic className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Generate Audio</p></TooltipContent>
                </Tooltip>
            )}
            <AlertDialog>
                <Tooltip>
                <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent><p>Delete document</p></TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                    This will permanently delete "{doc.fileName}" and its generated audio. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(doc.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </div>
        </div>
    </div>
);
