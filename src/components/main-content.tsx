
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Document } from '@/lib/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TextToSpeechTab from './text-to-speech-tab';

const PdfViewer = dynamic(() => import('@/components/pdf-viewer'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-muted/50 rounded-lg">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-xl font-semibold">Loading Document Viewer...</p>
    </div>
  )
});

type MainContentProps = {
  activeDoc: Document | null;
  isUploading: boolean;
  uploadStage: 'idle' | 'uploading' | 'extracting' | 'cleaning' | 'saving' | 'error';
  pdfZoomLevel: number;
  onFileChange: (files: FileList | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onGenerateTextAudio: (text: string) => Promise<{ success: boolean; audioUrl?: string; error?: string }>;
  onTextExtracted: (pageNumber: number, items: any[]) => void;
};

export default function MainContent({
  activeDoc,
  isUploading,
  uploadStage,
  pdfZoomLevel,
  onFileChange,
  fileInputRef,
  onGenerateTextAudio,
  onTextExtracted,
}: MainContentProps) {
  
  const getUploadMessage = () => {
    switch (uploadStage) {
      case 'uploading': return 'Uploading file...';
      case 'extracting': return 'Extracting text...';
      case 'cleaning': return 'Cleaning up content...';
      case 'saving': return 'Saving document...';
      case 'error': return 'An error occurred during upload.';
      default: return 'Drag & drop PDF here or click to upload';
    }
  };

  if (activeDoc) {
    return (
      <PdfViewer
        file={activeDoc.pdfUrl}
        zoomLevel={pdfZoomLevel}
        onTextExtracted={onTextExtracted}
      />
    );
  }

  if (isUploading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-muted/50 rounded-lg">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl font-semibold">{getUploadMessage()}</p>
        <p className="text-muted-foreground">Please wait while we process your document.</p>
      </div>
    );
  }
  
  return (
    <div
      className="w-full h-full flex items-center justify-center p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFileChange(e.dataTransfer.files);
      }}
    >
      <Tabs defaultValue="document" className="w-full max-w-2xl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="document">Document Reader</TabsTrigger>
          <TabsTrigger value="tts">Text-to-Speech</TabsTrigger>
        </TabsList>
        <TabsContent value="document">
            <div className="text-center mt-6 p-8 border-2 border-dashed border-muted-foreground/30 rounded-xl">
                <UploadCloud className="mx-auto h-16 w-16 text-muted-foreground/50" />
                <h3 className="mt-4 text-2xl font-headline">Prepare a New Document</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                Drag and drop a PDF file here, or click the button below to select one.
                </p>
                <Button className="mt-6" onClick={() => fileInputRef.current?.click()}>
                Select PDF File
                </Button>
                <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => onFileChange(e.target.files)}
                accept="application/pdf"
                className="hidden"
                />
            </div>
        </TabsContent>
        <TabsContent value="tts">
            <TextToSpeechTab onGenerate={onGenerateTextAudio} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
