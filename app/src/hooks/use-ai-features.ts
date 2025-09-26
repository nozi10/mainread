
'use client';

import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getAvailableVoices, type AvailableVoice } from '@/ai/flows/voice-selection';
import { previewSpeech } from '@/ai/flows/preview-speech';
import { summarizePdf, type SummarizePdfOutput } from '@/ai/flows/summarize-pdf';
import { chatWithPdf } from '@/ai/flows/chat-with-pdf';
import { generateGlossary, type GenerateGlossaryOutput } from '@/ai/flows/glossary-flow';
import { generateQuiz, type GenerateQuizOutput } from '@/ai/flows/quiz-flow';
import { saveDocument, type Document, type ChatMessage } from '@/lib/db';
import { generateQuizFeedback } from '@/ai/flows/quiz-feedback-flow';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { mergeAudio } from '@/lib/audio-utils';
import type { AiDialogType } from '@/components/ai-dialog';

export function useAiFeatures(previewAudioRef: React.RefObject<HTMLAudioElement>, activeDoc: Document | null) {
  const [availableVoices, setAvailableVoices] = useState<AvailableVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('openai/alloy');
  const [speakingRate, setSpeakingRate] = useState(1);
  
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiDialogType, setAiDialogType] = useState<AiDialogType>('summary');
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [aiSummaryOutput, setAiSummaryOutput] = useState<SummarizePdfOutput | null>(null);
  const [aiQuizOutput, setAiQuizOutput] = useState<GenerateQuizOutput | null>(null);
  const [aiGlossaryOutput, setAiGlossaryOutput] = useState<GenerateGlossaryOutput | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isPreviewAudioPlaying, setIsPreviewAudioPlaying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchVoices() {
      try {
        const voices = await getAvailableVoices();
        setAvailableVoices(voices);
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch available voices." });
      }
    }
    fetchVoices();
  }, [toast]);

  const handleAiAction = async (type: AiDialogType) => {
    if (!activeDoc?.textContent) {
        toast({ variant: 'destructive', title: 'No Text', description: 'Please select a document with text content.' });
        return;
    }
    setAiDialogType(type);
    setIsAiDialogOpen(true);
    setAiIsLoading(true);
    setAiSummaryOutput(null);
    setAiQuizOutput(null);
    setAiGlossaryOutput(null);

    try {
      const documentText = activeDoc.textContent;
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
        const feedbackResult = await generateQuizFeedback({ documentText: activeDoc.textContent || '', failedQuestions });
        feedback = feedbackResult.feedback;
    }
    const quizAttempt = { questions, answers, score, suggestions: feedback, completedAt: new Date().toISOString() };
    await saveDocument({ id: activeDoc.id, quizAttempt });
    toast({ title: `Quiz Complete! Score: ${score.toFixed(0)}%`, description: "You can review your results and suggestions." });
  };
  
  const handleSendMessage = async (message: string) => {
    if(!activeDoc || !activeDoc.id || !activeDoc.textContent) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message, createdAt: new Date().toISOString() };
    const updatedHistory = [...(activeDoc.chatHistory || []), userMessage];
    // Optimistically update UI
    const optimisticDoc = { ...activeDoc, chatHistory: updatedHistory };
    // This part is tricky. The parent useReadPage needs to update its activeDoc state.
    // A callback prop is needed here. For now, let's assume it exists.
    // onDocUpdate(optimisticDoc); 
    setIsChatLoading(true);
    try {
        const result = await chatWithPdf({ pdfText: activeDoc.textContent, question: message, chatHistory: updatedHistory.slice(-10) });
        const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: result.answer, createdAt: new Date().toISOString() };
        const finalHistory = [...updatedHistory, assistantMessage];
        await saveDocument({ id: activeDoc.id, chatHistory: finalHistory });
    } catch (error) {
        toast({ variant: "destructive", title: "Chat Error", description: "Could not get an answer." });
        // Revert on error
        // onDocUpdate(activeDoc);
    } finally {
        setIsChatLoading(false);
    }
  };
  
  const handleClearChat = async () => {
    if (!activeDoc || !activeDoc.id) return;
    try {
        await saveDocument({ id: activeDoc.id, chatHistory: [] });
        toast({ title: "Success", description: "Chat history has been cleared." });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not clear chat history.";
        toast({ variant: "destructive", title: "Error", description: message });
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

  return {
    isAiDialogOpen, setIsAiDialogOpen,
    aiDialogType,
    aiIsLoading,
    aiSummaryOutput,
    aiGlossaryOutput,
    aiQuizOutput,
    isChatOpen, setIsChatOpen,
    isChatLoading,
    isPreviewAudioPlaying,
    handleAiAction,
    handleQuizSubmit,
    handleSendMessage,
    handleClearChat,
    handlePlayAiResponse,
    handlePreviewVoice,
    availableVoices,
    selectedVoice, setSelectedVoice,
    speakingRate, setSpeakingRate,
  };
}
