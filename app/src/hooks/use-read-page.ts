
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { getAvailableVoices, AvailableVoice } from '@/ai/flows/voice-selection';
import { previewSpeech } from '@/ai/flows/preview-speech';
import { summarizePdf, SummarizePdfOutput } from '@/ai/flows/summarize-pdf';
import { chatWithPdf } from '@/ai/flows/chat-with-pdf';
import { generateGlossary, GenerateGlossaryOutput } from '@/ai/flows/glossary-flow';
import { generateQuiz, type GenerateQuizOutput } from '@/ai/flows/quiz-flow';
import { getDocuments, saveDocument, Document, getUserSession, ChatMessage, deleteDocument, clearChatHistory, UserSession, getFolders, Folder, createFolder, deleteFolder, moveDocumentToFolder } from '@/lib/db';
import { AiDialogType } from '@/components/ai-dialog';
import { generateQuizFeedback } from '@/ai/flows/quiz-feedback-flow';
import { cleanPdfText } from '@/ai/flows/clean-text-flow';
import { identifyUnwantedText } from '@/ai/flows/identify-unwanted-text';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { mergeAudio } from '@/lib/audio-utils';
import { checkAmazonVoiceGeneration } from '@/ai/flows/speech-generation/amazon-async';

type UploadStage = 'idle' | 'uploading' | 'extracting' | 'cleaning' | 'saving' | 'error';

export type SpeechMark = {
  time: number;
  type: 'sentence' | 'word';
  start: number;
  end: number;
  value: string;
};

export function useReadPage() {
    const [activeDoc, setActiveDoc] = useState<Document | null>(null);
    const [documentText, setDocumentText] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [availableVoices, setAvailableVoices] = useState<AvailableVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState('openai/alloy');
    const [speakingRate, setSpeakingRate] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [userDocuments, setUserDocuments] = useState<Document[]>([]);
    const [userFolders, setUserFolders] = useState<Folder[]>([]);
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [aiDialogType, setAiDialogType] = useState<AiDialogType>('summary');
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [aiSummaryOutput, setAiSummaryOutput] = useState<SummarizePdfOutput | null>(null);
    const [aiQuizOutput, setAiQuizOutput] = useState<GenerateQuizOutput | null>(null);
    const [aiGlossaryOutput, setAiGlossaryOutput] = useState<GenerateGlossaryOutput | null>(null);
    const [session, setSession] = useState<UserSession | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
    const [isUploading, setIsUploading] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [pdfZoomLevel, setPdfZoomLevel] = useState(1);
    const [isSavingZoom, setIsSavingZoom] = useState(false);
    const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
    const [isPreviewAudioPlaying, setIsPreviewAudioPlaying] = useState(false);
    const [speechMarks, setSpeechMarks] = useState<SpeechMark[] | null>(null);
    const [highlightedSentence, setHighlightedSentence] = useState<SpeechMark | null>(null);


    const { toast } = useToast();
    const router = useRouter();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const pollerRef = useRef<NodeJS.Timeout | null>(null);
    const localAudioUrlRef = useRef<string | null>(null);
    const chatWindowRef = useRef<HTMLDivElement>(null);
    const uploadTargetFolderId = useRef<string | null>(null);
    
    const fetchUserDocumentsAndFolders = useCallback(async () => {
        try {
          const [docs, folders] = await Promise.all([getDocuments(), getFolders()]);
          setUserDocuments(docs);
          setUserFolders(folders);

          // If there's an active document, find its updated version in the new list
          if (activeDoc) {
            const updatedActiveDoc = docs.find(d => d.id === activeDoc.id);
            if (updatedActiveDoc) {
                setActiveDoc(updatedActiveDoc);
            } else {
                // The active doc was deleted, clear it
                clearActiveDoc();
            }
          }
        } catch (error) {
          console.error('Failed to fetch data', error);
          toast({ variant: "destructive", title: "Error", description: "Could not load your library." });
        }
    }, [toast, activeDoc]);

    const fetchSession = useCallback(async () => {
        const sessionData = await getUserSession();
        setSession(sessionData);
        if (sessionData) {
          setSelectedVoice(sessionData.defaultVoice || 'openai/alloy');
          setSpeakingRate(sessionData.defaultSpeakingRate || 1);
          setPlaybackRate(sessionData.defaultSpeakingRate || 1);
          setPdfZoomLevel(activeDoc?.zoomLevel || sessionData.defaultZoomLevel || 1);
        }
    }, [activeDoc]);

    useEffect(() => {
        fetchSession();
        fetchUserDocumentsAndFolders();
        async function fetchVoices() {
          try {
            const voices = await getAvailableVoices();
            setAvailableVoices(voices);
          } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not fetch available voices." });
          }
        }
        fetchVoices();
        
        return () => {
            if (pollerRef.current) clearInterval(pollerRef.current);
            if (localAudioUrlRef.current) {
                URL.revokeObjectURL(localAudioUrlRef.current);
            }
        }

    }, []);

    useEffect(() => {
        if (!audioRef.current) return;
        
        if (localAudioUrl) {
            // Autoplay for temporary, newly generated audio
            const handleAutoplay = async () => {
                if (!audioRef.current) return;
                try {
                    await audioRef.current.play();
                } catch (e) {
                    console.error("Autoplay failed:", e);
                    setIsSpeaking(false);
                    toast({
                        variant: "destructive",
                        title: "Autoplay Blocked",
                        description: "Could not auto-play audio due to browser restrictions. Please press play manually."
                    });
                }
            };
            audioRef.current.src = localAudioUrl;
            handleAutoplay();
        } else if (activeDoc?.audioUrl && audioRef.current.src !== activeDoc.audioUrl) {
            // Load but do NOT autoplay for existing documents
            audioRef.current.src = activeDoc.audioUrl;
            audioRef.current.load();
            setIsSpeaking(false); // Ensure we start in a paused state
        }

    }, [activeDoc?.audioUrl, localAudioUrl, toast]);


    useEffect(() => {
        // Fetch speech marks when a document is selected
        const fetchSpeechMarks = async () => {
            if (activeDoc?.speechMarksUrl) {
                try {
                    const response = await fetch(activeDoc.speechMarksUrl);
                    if (!response.ok) throw new Error('Failed to fetch speech marks');
                    const marksText = await response.text();
                    // The file is a series of JSON objects, one per line. We need to parse it.
                    const marks = marksText.trim().split('\n').map(line => JSON.parse(line));
                    setSpeechMarks(marks);
                } catch (error) {
                    console.error("Error fetching or parsing speech marks:", error);
                    setSpeechMarks(null);
                    toast({
                        variant: "destructive",
                        title: "Highlighting Error",
                        description: "Could not load the data needed for text highlighting."
                    });
                }
            } else {
                setSpeechMarks(null);
                setHighlightedSentence(null);
            }
        };

        fetchSpeechMarks();
    }, [activeDoc, toast]);


    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const clearActiveDoc = () => {
        setActiveDoc(null);
        setDocumentText('');
        setIsChatOpen(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current.removeAttribute('src');
        }
        if (localAudioUrlRef.current) {
          URL.revokeObjectURL(localAudioUrlRef.current);
          localAudioUrlRef.current = null;
        }
        setLocalAudioUrl(null);
        setAudioDuration(0);
        setAudioCurrentTime(0);
        setAudioProgress(0);
        setSpeechMarks(null);
        setHighlightedSentence(null);
        if (pollerRef.current) clearInterval(pollerRef.current);
    };

    const handleUploadNewDocumentClick = (folderId?: string) => {
        clearActiveDoc();
        uploadTargetFolderId.current = folderId || null;
        if (!activeDoc) {
             fileInputRef.current?.click();
        }
    };
    
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
            
            // Simultaneously identify unwanted text
            const unwantedTextPromise = identifyUnwantedText({ rawText: doc.textContent });

            // Start polling for both Polly tasks
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
            }, 10000); // Poll every 10 seconds
        } else if (result.audioDataUris && result.audioDataUris.length > 0) {
            // Handle non-Amazon providers
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
}, [selectedVoice, speakingRate, toast, fetchUserDocumentsAndFolders]);

    const handleSelectDocument = useCallback(async (doc: Document) => {
        clearActiveDoc();
        setActiveDoc(doc);
        setAiSummaryOutput(null);
        setAiQuizOutput(null);
        setAiGlossaryOutput(null);
        setPdfZoomLevel(doc.zoomLevel);
        
        if (!doc.textContent) {
        console.log("Document text is missing, AI tools will be limited.");
        setDocumentText("");
        } else {
        setDocumentText(doc.textContent);
        }
    }, []);


    const handlePlayPause = async () => {
        if (!audioRef.current) return;
        if (isSpeaking) {
          audioRef.current.pause();
        } else if (audioRef.current.src && audioRef.current.src !== window.location.href) { 
          try {
            await audioRef.current.play();
          } catch (error) {
            console.error("Error playing audio:", error);
            toast({ variant: "destructive", title: "Playback Error", description: "Could not play the audio file. It might be invalid or a network issue occurred."});
            setIsSpeaking(false);
            if (audioRef.current) {
                audioRef.current.src = '';
                audioRef.current.removeAttribute('src');
            }
          }
        }
    };
    
    const handleDeleteDocument = async (docId: string | null) => {
        if (!docId) return;
        try {
            const result = await deleteDocument(docId);
            if (result.success) {
                toast({ title: "Success", description: "Document deleted successfully." });
                if (activeDoc?.id === docId) clearActiveDoc();
                fetchUserDocumentsAndFolders();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            toast({ variant: "destructive", title: "Deletion Error", description: `Could not delete document: ${errorMessage}` });
        }
    };
    
    const handleAudioTimeUpdate = () => {
        if (!audioRef.current) return;
        const currentTimeMs = audioRef.current.currentTime * 1000;
        setAudioCurrentTime(audioRef.current.currentTime);
        if (audioDuration > 0) setAudioProgress((audioRef.current.currentTime / audioDuration) * 100);

        if (!speechMarks) return;
        
        // Find the current sentence
        const currentSentence = speechMarks.findLast(
            (mark): mark is SpeechMark => mark.type === 'sentence' && currentTimeMs >= mark.time
        );
        
        if (currentSentence && currentSentence.value !== highlightedSentence?.value) {
            setHighlightedSentence(currentSentence);

             // Auto-scroll logic
            const highlightElement = document.querySelector(`span[data-sentence-id="${currentSentence.time}"]`);
            if (highlightElement) {
                highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };
    
    const handlePreviewVoice = async (voice: string) => {
        try {
          if (previewAudioRef.current?.src && !previewAudioRef.current.paused) {
            previewAudioRef.current.pause();
            return;
          }
          const result = await previewSpeech({ voice: voice });
          if (result.audioDataUri && previewAudioRef.current) {
            previewAudioRef.current.src = result.audioDataUri;
            previewAudioRef.current.play();
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
          toast({ variant: "destructive", title: "Audio Error", description: `Could not preview voice: ${errorMessage}` });
        }
    };

    const handlePlayAiResponse = async (text: string) => {
        if (previewAudioRef.current?.src && !previewAudioRef.current.paused) {
            previewAudioRef.current.pause();
            return;
        }
        try {
          const result = await generateSpeech({ text, voice: selectedVoice, speakingRate: speakingRate });
          if (!result.audioDataUris) throw new Error("No audio data returned");
          const mergedAudioBlob = await mergeAudio(result.audioDataUris);
          const audioUrl = URL.createObjectURL(mergedAudioBlob);
          if (previewAudioRef.current) {
              previewAudioRef.current.src = audioUrl;
              previewAudioRef.current.play();
              previewAudioRef.current.onended = () => {
                  URL.revokeObjectURL(audioUrl);
                  setIsPreviewAudioPlaying(false);
              };
              previewAudioRef.current.onplay = () => setIsPreviewAudioPlaying(true);
              previewAudioRef.current.onpause = () => setIsPreviewAudioPlaying(false);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? 'An unknown error occurred' : 'An unknown error occurred';
          toast({ variant: "destructive", title: "Audio Error", description: `Could not play response: ${errorMessage}` });
        }
    };
    
    const handleGenerateTextAudio = async (text: string) => {
      try {
        const result = await generateSpeech({ text, voice: selectedVoice, speakingRate: speakingRate });
        if (!result.audioDataUris) throw new Error("No audio data returned");
        const mergedAudioBlob = await mergeAudio(result.audioDataUris);
        if (localAudioUrlRef.current) {
          URL.revokeObjectURL(localAudioUrlRef.current);
        }
        const newLocalUrl = URL.createObjectURL(mergedAudioBlob);
        localAudioUrlRef.current = newLocalUrl;
        setLocalAudioUrl(newLocalUrl);
        return { success: true, audioUrl: newLocalUrl };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error generating text audio:', message);
        return { success: false, error: message };
      }
    };

    useEffect(() => {
        if(audioRef.current) audioRef.current.playbackRate = playbackRate;
    }, [playbackRate]);

    const handleSeek = (value: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = value;
          setAudioCurrentTime(value);
        }
    };
    const handleForward = () => {
        if (audioRef.current && audioRef.current.duration > 0) handleSeek(Math.min(audioRef.current.currentTime + 10, audioRef.current.duration));
    };
    const handleRewind = () => {
        if (audioRef.current && audioRef.current.duration > 0) handleSeek(Math.max(audioRef.current.currentTime - 10, 0));
    };
    
    const handleAiAction = async (type: AiDialogType) => {
        if (!documentText) {
            toast({ variant: 'destructive', title: 'No Text', description: 'Please select a document with text content to use AI tools.' });
            return;
        }
        setAiDialogType(type);
        setIsAiDialogOpen(true);
        setAiIsLoading(true);
        setAiSummaryOutput(null);
        setAiQuizOutput(null);
        setAiGlossaryOutput(null);
    
        try {
          if (type === 'summary' || type === 'key-points') {
            const result = await summarizePdf({ pdfText: documentText });
            setAiSummaryOutput(result);
          } else if (type === 'glossary') {
              const result = await generateGlossary({ documentText });
              setAiGlossaryOutput(result);
          } else if (type === 'quiz') {
              if (activeDoc?.quizAttempt) {
                setAiQuizOutput({ quiz: activeDoc.quizAttempt.questions });
              } else {
                const result = await generateQuiz({ documentText });
                setAiQuizOutput(result);
              }
          }
        } catch (error) {
          console.error(`AI Error (${type}):`, error);
          toast({ variant: "destructive", title: "AI Error", description: `Could not perform AI action: ${type}.` });
        } finally {
          setAiIsLoading(false);
        }
    };
    
    const handleQuizSubmit = async (questions: any[], answers: Record<number, string>) => {
        if (!activeDoc || !activeDoc.id) return;
        
        let correctCount = 0;
        const failedQuestions: any[] = [];
        questions.forEach((q, index) => {
            if(q.answer === answers[index]) correctCount++;
            else failedQuestions.push({ question: q.question, userAnswer: answers[index] || "Not answered", correctAnswer: q.answer });
        });
        const score = (correctCount / questions.length) * 100;
        let feedback = 'Great job! You got all the questions right!';
        if(failedQuestions.length > 0) {
            toast({ title: "Generating Feedback", description: "Analyzing your answers..." });
            const feedbackResult = await generateQuizFeedback({ documentText, failedQuestions });
            feedback = feedbackResult.feedback;
        }
        const quizAttempt = { questions, answers, score, suggestions: feedback, completedAt: new Date().toISOString() };
        const updatedDoc = await saveDocument({ id: activeDoc.id, quizAttempt });
        setActiveDoc(updatedDoc);
        toast({ title: `Quiz Complete! Score: ${score.toFixed(0)}%`, description: "You can review your results and suggestions." });
    };

    const handleSendMessage = async (message: string) => {
        if(!activeDoc || !activeDoc.id || !documentText) return;
        const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message, createdAt: new Date().toISOString() };
        const updatedHistory = [...(activeDoc.chatHistory || []), userMessage];
        setActiveDoc(prev => prev ? {...prev, chatHistory: updatedHistory} : null);
        setIsChatLoading(true);
        try {
            const result = await chatWithPdf({ pdfText: documentText, question: message, chatHistory: updatedHistory.slice(-10) });
            const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: result.answer, createdAt: new Date().toISOString() };
            const finalHistory = [...updatedHistory, assistantMessage];
            const updatedDoc = await saveDocument({ id: activeDoc.id, chatHistory: finalHistory });
            setActiveDoc(updatedDoc);
        } catch (error) {
            toast({ variant: "destructive", title: "Chat Error", description: "Could not get an answer." });
            setActiveDoc(prev => prev ? {...prev, chatHistory: updatedHistory} : null);
        } finally {
            setIsChatLoading(false);
        }
    };
    
    const handleClearChat = async () => {
        if (!activeDoc || !activeDoc.id) return;
        try {
            const updatedDoc = await clearChatHistory(activeDoc.id);
            setActiveDoc(updatedDoc);
            toast({ title: "Success", description: "Chat history has been cleared." });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Could not clear chat history.";
            toast({ variant: "destructive", title: "Error", description: message });
        }
    };

    const handleFileChange = (files: FileList | null) => {
        if (files && files[0]) handleFileUpload(files[0]);
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
                toast({ variant: "destructive", title: "Library not ready", description: "PDF processing library is not loaded yet. Please try again in a moment." });
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
            const pageCharacterOffsets: number[] = [0]; // Start with 0 for the first page
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
                folderId: uploadTargetFolderId.current || null
            });
            uploadTargetFolderId.current = null; // Reset after use
            await fetchUserDocumentsAndFolders();
            handleSelectDocument(newDoc);
            toast({ title: "Success", description: "Your document has been prepared." });
        } catch (error) {
            setUploadStage('error');
            console.error("File upload process failed:", error);
            const message = error instanceof Error ? error.message : "An unknown error occurred during upload.";
            toast({ variant: "destructive", title: "Upload Failed", description: message });
        } finally {
            setIsUploading(false);
            setUploadStage('idle');
            setDocumentText(''); // Clear any old text
        }
    };

    const handleZoomIn = () => setPdfZoomLevel(Math.min(pdfZoomLevel + 0.2, 3));
    const handleZoomOut = () => setPdfZoomLevel(Math.max(pdfZoomLevel - 0.2, 0.4));
    const handleSaveZoom = async () => {
      if (!activeDoc) return;
      setIsSavingZoom(true);
      try {
          await saveDocument({ id: activeDoc.id, zoomLevel: pdfZoomLevel });
          await fetchUserDocumentsAndFolders();
          toast({ title: 'Zoom level saved' });
      } catch (e) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not save zoom level.'});
      } finally {
          setIsSavingZoom(false);
      }
    };

    // Folder actions
    const handleCreateFolder = async (name: string) => {
        await createFolder(name);
        await fetchUserDocumentsAndFolders();
    };

    const handleDeleteFolder = async (folderId: string) => {
        await deleteFolder(folderId);
        await fetchUserDocumentsAndFolders();
    };
    
    const handleMoveDocument = async (docId: string, folderId: string | null) => {
        await moveDocumentToFolder(docId, folderId);
        await fetchUserDocumentsAndFolders();
    };

    return {
        activeDoc, setActiveDoc, documentText, setDocumentText,
        isSpeaking, setIsSpeaking, audioProgress, setAudioProgress, audioDuration, setAudioDuration, audioCurrentTime, setAudioCurrentTime,
        availableVoices, setAvailableVoices, selectedVoice, setSelectedVoice, speakingRate, setSpeakingRate, playbackRate, setPlaybackRate,
        userDocuments, setUserDocuments, userFolders, isAiDialogOpen, setIsAiDialogOpen, aiDialogType, setAiDialogType, aiIsLoading, setAiIsLoading,
        aiSummaryOutput, setAiSummaryOutput, aiQuizOutput, setAiQuizOutput, aiGlossaryOutput, setAiGlossaryOutput, session, setSession,
        isChatOpen, setIsChatOpen, isChatLoading, setIsChatLoading, uploadStage, setUploadStage,
        isUploading, setIsUploading, isFullScreen, setIsFullScreen, pdfZoomLevel, setPdfZoomLevel, isSavingZoom, setIsSavingZoom, localAudioUrl,
        toast, audioRef, previewAudioRef, localAudioUrlRef, router, chatWindowRef, fileInputRef, isPreviewAudioPlaying,
        fetchSession, fetchUserDocumentsAndFolders, handleLogout, clearActiveDoc, handleUploadNewDocumentClick, handleSelectDocument, handleGenerateAudioForDoc,
        handlePlayPause, handleDeleteDocument, handleAudioTimeUpdate, handlePreviewVoice, handlePlayAiResponse,
        handleSeek, handleForward, handleRewind, handleAiAction, handleQuizSubmit, handleSendMessage, handleClearChat,
        handleFileChange, handleFileUpload, handleZoomIn, handleZoomOut, handleSaveZoom, handleGenerateTextAudio,
        handleCreateFolder, handleDeleteFolder, handleMoveDocument,
        highlightedSentence
    };
}
