
'use client';

import { useState, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { identifyUnwantedText } from '@/ai/flows/identify-unwanted-text';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { mergeAudio } from '@/lib/audio-utils';
import { checkAmazonVoiceGeneration } from '@/ai/flows/speech-generation/amazon-async';
import { saveDocument, type Document } from '@/lib/db';

type UploadStage = 'idle' | 'uploading' | 'extracting' | 'saving' | 'error';

type UseFileUploadProps = {
  activeDoc: Document | null;
  setActiveDoc: (doc: Document) => void;
  fetchUserDocumentsAndFolders: () => Promise<void>;
  handleSelectDocument: (doc: Document) => void;
  setLocalAudioUrl: (url: string | null) => void;
  selectedVoice: string;
  speakingRate: number;
};

export function useFileUpload({
  activeDoc,
  setActiveDoc,
  fetchUserDocumentsAndFolders,
  handleSelectDocument,
  setLocalAudioUrl,
  selectedVoice,
  speakingRate
}: UseFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const pollerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  const handleGenerateAudioForDoc = useCallback(async (doc: Document) => {
    if (doc.audioGenerationStatus === 'processing' || !doc.textContent || !doc.id) return;
    try {
        await saveDocument({ id: doc.id, audioGenerationStatus: 'processing' });
        await fetchUserDocumentsAndFolders();
        toast({ title: "Starting Audio Generation", description: "This may take a few moments..." });

        const result = await generateSpeech({ 
            text: doc.textContent, 
            voice: selectedVoice, 
            speakingRate: speakingRate, 
            docId: doc.id,
            fileName: doc.fileName,
        });
        
        if (result.pollyAudioTaskId && result.pollyMarksTaskId) {
            toast({ title: "Processing Audio & Timestamps", description: "Amazon Polly is working in the background." });
            
            const unwantedTextPromise = identifyUnwantedText({ rawText: doc.textContent });

            pollerRef.current = setInterval(async () => {
                try {
                    const [audioStatus, marksStatus] = await Promise.all([
                        checkAmazonVoiceGeneration(result.pollyAudioTaskId!),
                        checkAmazonVoiceGeneration(result.pollyMarksTaskId!)
                    ]);

                    if (audioStatus.status === 'completed' && marksStatus.status === 'completed') {
                        if (pollerRef.current) clearInterval(pollerRef.current);

                        const { unwantedText } = await unwantedTextPromise;

                        const finalDoc = await saveDocument({ 
                            id: doc.id!, 
                            audioUrl: audioStatus.outputUrl, 
                            speechMarksUrl: marksStatus.outputUrl,
                            unwantedText: unwantedText,
                            audioGenerationStatus: 'completed' 
                        });
                        
                        setActiveDoc(finalDoc);
                        await fetchUserDocumentsAndFolders();
                        toast({ title: "Success", description: "Audio and timestamps are ready." });
                    } else if (audioStatus.status === 'failed' || marksStatus.status === 'failed') {
                        if (pollerRef.current) clearInterval(pollerRef.current);
                        await saveDocument({ id: doc.id!, audioGenerationStatus: 'failed' });
                        toast({ variant: "destructive", title: "Audio Error", description: "Amazon Polly failed to process the request." });
                    }
                } catch (pollError) {
                    if (pollerRef.current) clearInterval(pollerRef.current);
                    await saveDocument({ id: doc.id!, audioGenerationStatus: 'failed' });
                    toast({ variant: "destructive", title: "Polling Error", description: "Could not check audio generation status." });
                }
            }, 10000); 
        } else if (result.audioDataUris && result.audioDataUris.length > 0) {
            const mergedAudioBlob = await mergeAudio(result.audioDataUris);
            const audioFileName = `${doc.fileName.replace(/\.pdf$/i, '') || 'audio'}.mp3`;
            const uploadAudioResponse = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'audio/mp3', 'x-vercel-filename': audioFileName, 'x-doc-id': doc.id },
                body: mergedAudioBlob,
            });
            if (!uploadAudioResponse.ok) throw new Error('Audio Upload failed');
            const audioBlobResult = await uploadAudioResponse.json();
            
            const finalDoc = await saveDocument({ id: doc.id, audioUrl: audioBlobResult.url, audioGenerationStatus: 'completed' });
            setActiveDoc(finalDoc);
            await fetchUserDocumentsAndFolders();
            toast({ title: "Success", description: "Audio generated and saved." });
        } else {
            throw new Error("Audio generation resulted in no valid output.");
        }
    } catch (error: any) {
        console.error('Speech generation error', error);
        await saveDocument({ id: doc.id!, audioGenerationStatus: 'failed' });
        toast({ variant: "destructive", title: "Audio Error", description: `Could not generate audio: ${error.message}` });
    } finally {
        await fetchUserDocumentsAndFolders();
    }
  }, [selectedVoice, speakingRate, toast, fetchUserDocumentsAndFolders, setActiveDoc]);
  
  const handleGenerateTextAudio = async (text: string) => {
      try {
        const result = await generateSpeech({ text, voice: selectedVoice, speakingRate: speakingRate });
        if (!result.audioDataUris) throw new Error("No audio data returned");
        const mergedAudioBlob = await mergeAudio(result.audioDataUris);
        
        const newLocalUrl = URL.createObjectURL(mergedAudioBlob);
        setLocalAudioUrl(newLocalUrl);
        return { success: true, audioUrl: newLocalUrl };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error generating text audio:', message);
        return { success: false, error: message };
      }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.includes('pdf')) {
      toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a PDF file." });
      return;
    }
    setIsUploading(true);
    setUploadStage('uploading');
    try {
        if (typeof window === 'undefined' || !(window as any).pdfjsLib) {
            toast({ variant: "destructive", title: "Library not ready", description: "PDF processing library is not loaded yet." });
            setUploadStage('error');
            setIsUploading(false);
            return;
        }
        const uploadResponse = await fetch('/api/upload', { method: 'POST', headers: { 'x-vercel-filename': file.name }, body: file });
        if (!uploadResponse.ok) throw new Error('Failed to upload file.');
        const blob = await uploadResponse.json();
        setUploadStage('extracting');
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = '/static/pdf.worker.min.js';
        const pdf = await (window as any).pdfjsLib.getDocument(blob.url).promise;
        
        let rawText = '';
        const pageCharacterOffsets: number[] = [0];
        let runningOffset = 0;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            rawText += pageText + ' ';
            runningOffset += pageText.length + 1;
            if (i < pdf.numPages) {
                pageCharacterOffsets.push(runningOffset);
            }
        }

        setUploadStage('saving');
        const newDoc = await saveDocument({ 
            fileName: file.name, 
            pdfUrl: blob.url, 
            textContent: rawText,
            pageCharacterOffsets,
            zoomLevel: 1,
            folderId: null
        });
        await fetchUserDocumentsAndFolders();
        handleSelectDocument(newDoc);
        toast({ title: "Success", description: "Your document has been prepared." });
    } catch (error) {
        setUploadStage('error');
        console.error("File upload process failed:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "Upload Failed", description: message });
    } finally {
        setIsUploading(false);
        setUploadStage('idle');
    }
  };
  
  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) handleFileUpload(files[0]);
  };

  return {
    isUploading,
    uploadStage,
    handleFileChange,
    handleFileUpload,
    handleGenerateAudioForDoc,
    handleGenerateTextAudio,
  };
}
