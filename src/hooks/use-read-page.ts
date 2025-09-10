
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
import { getDocuments, saveDocument, Document, getUserSession, ChatMessage, deleteDocument, clearChatHistory, UserSession } from '@/lib/db';
import { AiDialogType } from '@/components/ai-dialog';
import { generateQuizFeedback } from '@/ai/flows/quiz-feedback-flow';
import { cleanPdfText } from '@/ai/flows/clean-text-flow';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { mergeAudio } from '@/lib/audio-utils';
import { checkAmazonVoiceGeneration } from '@/ai/flows/speech-generation/amazon-async';

type GenerationState = 'idle' | 'generating' | 'polling' | 'error';
type UploadStage = 'idle' | 'uploading' | 'extracting' | 'cleaning' | 'saving' | 'error';

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
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [aiDialogType, setAiDialogType] = useState<AiDialogType>('summary');
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [aiSummaryOutput, setAiSummaryOutput] = useState<SummarizePdfOutput | null>(null);
    const [aiQuizOutput, setAiQuizOutput] = useState<GenerateQuizOutput | null>(null);
    const [aiGlossaryOutput, setAiGlossaryOutput] = useState<GenerateGlossaryOutput | null>(null);
    const [session, setSession] = useState<UserSession | null>(null);
    const [generationState, setGenerationState] = useState<GenerationState>('idle');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
    const [isUploading, setIsUploading] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [pdfZoomLevel, setPdfZoomLevel] = useState(1);
    const [isSavingZoom, setIsSavingZoom] = useState(false);
    const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);

    const { toast } = useToast();
    const router = useRouter();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const pollerRef = useRef<NodeJS.Timeout | null>(null);
    const localAudioUrlRef = useRef<string | null>(null);
    const chatWindowRef = useRef<HTMLDivElement>(null);
    
    const setPageTextItems = useCallback((pageNumber: number, items: any[]) => {
      // This function is now a placeholder to satisfy the PDFViewer prop.
    }, []);

    const fetchUserDocuments = useCallback(async () => {
        try {
          const docs = await getDocuments();
          setUserDocuments(docs);
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
          console.error('Failed to fetch documents', error);
          toast({ variant: "destructive", title: "Error", description: "Could not load your documents." });
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
        fetchUserDocuments();
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
        const sourceUrl = localAudioUrl || activeDoc?.audioUrl;
        if (audioRef.current && sourceUrl) {
            const currentSrc = audioRef.current.src;
            if (sourceUrl && currentSrc !== sourceUrl) {
                audioRef.current.src = sourceUrl;
                audioRef.current.load();
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.error("Autoplay failed:", e);
                        setIsSpeaking(false);
                         toast({
                            variant: "destructive",
                            title: "Playback Error",
                            description: "Could not auto-play audio. Please press play manually. This may be due to browser restrictions or an issue with the audio file (e.g., S3 CORS policy)."
                        });
                    }).then(() => setIsSpeaking(true));
                }
            }
        }
    }, [activeDoc?.audioUrl, localAudioUrl, toast]);

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
        setGenerationState('idle');
        if (pollerRef.current) clearInterval(pollerRef.current);
    };

    const handleUploadNewDocumentClick = () => {
        clearActiveDoc();
        if (!activeDoc) {
             fileInputRef.current?.click();
        }
    };
    
    const handleGenerateAudioForDoc = useCallback(async (doc: Document) => {
      if (generationState !== 'idle') return;
      if (!doc.textContent || !doc.id) return;
      if (doc.audioUrl) return;
  
      setGenerationState('generating');
      toast({ title: "Generating Audio", description: "This may take a few moments..." });
  
      try {
        const result = await generateSpeech({ 
            text: doc.textContent, 
            voice: selectedVoice, 
            speakingRate: speakingRate, 
            docId: doc.id,
            fileName: doc.fileName,
          });
        
        if (result.pollyTaskId) {
          setGenerationState('polling');
          toast({ title: "Processing Audio", description: "Amazon Polly is generating your audio in the background." });
          
          pollerRef.current = setInterval(async () => {
              try {
                  const status = await checkAmazonVoiceGeneration(result.pollyTaskId!);
                  if (status.status === 'completed' && status.audioUrl) {
                      if (pollerRef.current) clearInterval(pollerRef.current);
                      
                      const updatedDoc = await saveDocument({ id: doc.id!, audioUrl: status.audioUrl });
                      
                      setActiveDoc(updatedDoc); 
                      await fetchUserDocuments();
                      setGenerationState('idle');
                      toast({ title: "Success", description: "Audio ready and will play automatically." });

                  } else if (status.status === 'failed') {
                      if (pollerRef.current) clearInterval(pollerRef.current);
                      setGenerationState('error');
                      toast({ variant: "destructive", title: "Audio Error", description: "Amazon Polly failed to process the audio." });
                  }
              } catch (pollError) {
                  if (pollerRef.current) clearInterval(pollerRef.current);
                  setGenerationState('error');
                  toast({ variant: "destructive", title: "Polling Error", description: "Could not check audio generation status." });
              }
          }, 5000);
          
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
          const newAudioUrl = audioBlobResult.url;
          
          if (newAudioUrl) {
              const updatedDoc = await saveDocument({ id: doc.id, audioUrl: newAudioUrl });
              setActiveDoc(updatedDoc);
              await fetchUserDocuments();
              setGenerationState('idle');
              toast({ title: "Success", description: "Audio generated and saved." });
          }
        } else {
          throw new Error("Audio generation resulted in no audio output.");
        }

      } catch (error: any) {
        console.error('Speech generation error', error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        toast({ variant: "destructive", title: "Audio Error", description: `Could not generate audio. ${errorMessage}` });
        setGenerationState('error');
      }
  }, [generationState, selectedVoice, speakingRate, toast, fetchUserDocuments]);

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

    if (doc.audioUrl && audioRef.current) {
        audioRef.current.src = doc.audioUrl;
        audioRef.current.load();
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
                fetchUserDocuments();
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
        setAudioCurrentTime(audioRef.current.currentTime);
        if (audioDuration > 0) setAudioProgress((audioRef.current.currentTime / audioDuration) * 100);
    };
    
    const handlePreviewVoice = async (voice: string) => {
        try {
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
        try {
          const result = await generateSpeech({ text, voice: selectedVoice, speakingRate: speakingRate });
          if (!result.audioDataUris) throw new Error("No audio data returned");
          const mergedAudioBlob = await mergeAudio(result.audioDataUris);
          const audioUrl = URL.createObjectURL(mergedAudioBlob);
          if (previewAudioRef.current) {
              previewAudioRef.current.src = audioUrl;
              previewAudioRef.current.play();
              previewAudioRef.current.onended = () => URL.revokeObjectURL(audioUrl);
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

    const getProcessingMessage = () => {
        switch (generationState) {
            case 'generating': return 'Generating audio...';
            case 'polling': return 'Processing audio...';
            case 'error': return 'An error occurred during audio generation.';
            default: return '';
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
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                rawText += textContent.items.map((item: any) => item.str).join(' ');
            }
            setUploadStage('cleaning');
            const { cleanedText } = await cleanPdfText({ rawText });
            setDocumentText(cleanedText);
            setUploadStage('saving');
            const newDoc = await saveDocument({ fileName: file.name, pdfUrl: blob.url, textContent: cleanedText, zoomLevel: 1 });
            await fetchUserDocuments();
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
        }
    };

    const handleZoomIn = () => setPdfZoomLevel(Math.min(pdfZoomLevel + 0.2, 3));
    const handleZoomOut = () => setPdfZoomLevel(Math.max(pdfZoomLevel - 0.2, 0.4));
    const handleSaveZoom = async () => {
      if (!activeDoc) return;
      setIsSavingZoom(true);
      try {
          await saveDocument({ id: activeDoc.id, zoomLevel: pdfZoomLevel });
          await fetchUserDocuments();
          toast({ title: 'Zoom level saved' });
      } catch (e) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not save zoom level.'});
      } finally {
          setIsSavingZoom(false);
      }
    };

    const isAudioGenerationRunning = generationState === 'generating' || generationState === 'polling';

    return {
        activeDoc, setActiveDoc, documentText, setDocumentText,
        isSpeaking, setIsSpeaking, audioProgress, setAudioProgress, audioDuration, setAudioDuration, audioCurrentTime, setAudioCurrentTime,
        availableVoices, setAvailableVoices, selectedVoice, setSelectedVoice, speakingRate, setSpeakingRate, playbackRate, setPlaybackRate,
        userDocuments, setUserDocuments, isAiDialogOpen, setIsAiDialogOpen, aiDialogType, setAiDialogType, aiIsLoading, setAiIsLoading,
        aiSummaryOutput, setAiSummaryOutput, aiQuizOutput, setAiQuizOutput, aiGlossaryOutput, setAiGlossaryOutput, session, setSession,
        generationState, setGenerationState, isChatOpen, setIsChatOpen, isChatLoading, setIsChatLoading, uploadStage, setUploadStage,
        isUploading, setIsUploading, isFullScreen, setIsFullScreen, pdfZoomLevel, setPdfZoomLevel, isSavingZoom, setIsSavingZoom, localAudioUrl,
        toast, audioRef, previewAudioRef, localAudioUrlRef, router, chatWindowRef, fileInputRef,
        fetchSession, fetchUserDocuments, handleLogout, clearActiveDoc, handleUploadNewDocumentClick, handleSelectDocument, handleGenerateAudioForDoc,
        handlePlayPause, handleDeleteDocument, handleAudioTimeUpdate, handlePreviewVoice, handlePlayAiResponse,
        handleSeek, handleForward, handleRewind, handleAiAction, handleQuizSubmit, handleSendMessage, handleClearChat,
        getProcessingMessage, handleFileChange, handleFileUpload, handleZoomIn, handleZoomOut, handleSaveZoom, handleGenerateTextAudio,
        isAudioGenerationRunning, setPageTextItems, highlightedSentence: null
    };
}

    