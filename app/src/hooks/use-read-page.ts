
'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from './use-auth';
import { useDocumentLibrary } from './use-document-library';
import { useAudioPlayer } from './use-audio-player';
import { useAiFeatures } from './use-ai-features';
import { useFileUpload } from './use-file-upload';
import { usePdfViewer } from './use-pdf-viewer';

export type SpeechMark = {
  time: number;
  type: 'sentence' | 'word';
  start: number;
  end: number;
  value: string;
};

export function useReadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatWindowRef = useRef<HTMLDivElement | null>(null);
  
  const { 
    session, 
    fetchSession, 
    handleLogout,
    highlightColor,
    highlightStyle,
  } = useAuth();
  
  const {
    activeDoc,
    setActiveDoc,
    userDocuments,
    userFolders,
    fetchUserDocumentsAndFolders,
    handleSelectDocument,
    handleDeleteDocument,
    handleCreateFolder,
    handleDeleteFolder,
    handleMoveDocument,
    clearActiveDocState,
  } = useDocumentLibrary();
  
  const {
    isSpeaking, setIsSpeaking,
    audioProgress,
    audioDuration, setAudioDuration,
    audioCurrentTime,
    highlightedSentence,
    playbackRate, setPlaybackRate,
    localAudioUrl, setLocalAudioUrl,
    handlePlayPause,
    handleAudioTimeUpdate,
    handleSeek,
    handleForward,
    handleRewind,
  } = useAudioPlayer(audioRef, activeDoc);
  
  const {
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
  } = useAiFeatures(previewAudioRef, activeDoc);
  
  const {
    isUploading,
    uploadStage,
    handleFileChange,
    handleGenerateAudioForDoc,
    handleGenerateTextAudio,
  } = useFileUpload({
    activeDoc,
    setActiveDoc,
    fetchUserDocumentsAndFolders,
    handleSelectDocument,
    setLocalAudioUrl,
    selectedVoice,
    speakingRate
  });
  
  const {
    isFullScreen, setIsFullScreen,
    pdfZoomLevel,
    isSavingZoom,
    handleZoomIn,
    handleZoomOut,
    handleSaveZoom,
  } = usePdfViewer(activeDoc, session, fetchUserDocumentsAndFolders);

  const clearActiveDoc = () => {
    clearActiveDocState();
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.removeAttribute('src');
    }
    setLocalAudioUrl(null);
  };
  
  const handleUploadNewDocumentClick = () => {
    clearActiveDoc();
    fileInputRef.current?.click();
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchSession();
    fetchUserDocumentsAndFolders();
  }, [fetchSession, fetchUserDocumentsAndFolders]);
  
  return {
    // Refs
    audioRef, previewAudioRef, fileInputRef, chatWindowRef,
    // Auth
    session, fetchSession, handleLogout,
    // Document Library
    activeDoc, userDocuments, userFolders,
    handleSelectDocument, handleDeleteDocument, handleCreateFolder, handleDeleteFolder, handleMoveDocument,
    // File Upload & Processing
    isUploading, uploadStage, handleFileChange, handleGenerateAudioForDoc, handleGenerateTextAudio,
    handleUploadNewDocumentClick,
    // PDF Viewer
    pdfZoomLevel, isFullScreen, setIsFullScreen, isSavingZoom,
    handleZoomIn, handleZoomOut, handleSaveZoom,
    highlightedSentence, highlightColor, highlightStyle,
    // Audio Player
    isSpeaking, setIsSpeaking, audioProgress, audioDuration, setAudioDuration, audioCurrentTime, playbackRate, setPlaybackRate, localAudioUrl,
    handlePlayPause, handleSeek, handleForward, handleRewind, handleAudioTimeUpdate,
    // AI Features
    availableVoices, selectedVoice, setSelectedVoice, speakingRate, setSpeakingRate,
    isAiDialogOpen, setIsAiDialogOpen, aiDialogType, aiIsLoading, aiSummaryOutput, aiGlossaryOutput, aiQuizOutput,
    isChatOpen, setIsChatOpen, isChatLoading, isPreviewAudioPlaying,
    handleAiAction, handleQuizSubmit, handleSendMessage, handleClearChat, handlePlayAiResponse, handlePreviewVoice,
  };
}
