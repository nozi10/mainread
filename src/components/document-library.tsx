
'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Mic, Trash2, FileText, Library, PlusCircle, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Document } from '@/lib/db';

type DocumentLibraryProps = {
  documents: Document[];
  activeDocId: string | null;
  onSelect: (doc: Document) => void;
  onDelete: (docId: string) => void;
  onGenerateAudio: (doc: Document) => void;
  isAudioGenerating: boolean;
  onUploadNew: () => void;
};

export default function DocumentLibrary({
  documents,
  activeDocId,
  onSelect,
  onDelete,
  onGenerateAudio,
  isAudioGenerating,
  onUploadNew,
}: DocumentLibraryProps) {
  return (
    <div>
      <div className="flex justify-between items-center p-2 text-sm font-semibold text-muted-foreground">
        <div className="flex items-center gap-2">
          <Library />
          My Documents
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onUploadNew}>
              <PlusCircle className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>New Document</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="px-2">
        {documents.map((doc) => (
          <div key={doc.id} className={cn(
            "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm mb-1 group",
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
                {doc.audioUrl ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Cloud className="h-4 w-4 text-primary mr-1" />
                    </TooltipTrigger>
                    <TooltipContent><p>Audio is saved</p></TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isAudioGenerating} onClick={() => onGenerateAudio(doc)}>
                        <Mic className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                     <TooltipContent><p>Generate Audio</p></TooltipContent>
                  </Tooltip>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Delete document</p></TooltipContent>
                    </Tooltip>
                  </AlertDialogTrigger>
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
        ))}
      </div>
    </div>
  );
}
