
'use client';

import React from 'react';
import { useReadPage } from '@/hooks/use-read-page';
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import UserPanel from '@/components/user-panel';
import AudioPlayer from '@/components/audio-player';
import AiDialog from '@/components/ai-dialog';
import { ThemeToggle } from '@/components/theme-toggle';
import { BarChart, BookOpenCheck, BrainCircuit, Lightbulb, MessageSquare, UploadCloud } from 'lucide-react';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import AudioSettingsPanel from '@/components/audio-settings-panel';
import DocumentLibrary from '@/components/document-library';
import MainContent from '@/components/main-content';
import { ChatWindow } from '@/components/chat-window';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function ReadPage() {
  const state = useReadPage();

  return (
    <TooltipProvider>
      <div className={cn("flex h-screen w-full bg-background", state.isFullScreen && "fixed inset-0 z-50")}>
        <Sidebar className={cn(state.isFullScreen && "hidden")}>
          <SidebarHeader>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-headline text-primary flex items-center gap-2"><BarChart /> Readify</h1>
              <ThemeToggle />
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={state.handleUploadNewDocumentClick}>
                <UploadCloud />
                Upload New Document
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <Separator className="my-2" />

            <AudioSettingsPanel
              availableVoices={state.availableVoices}
              selectedVoice={state.selectedVoice}
              onSelectedVoiceChange={state.setSelectedVoice}
              speakingRate={state.speakingRate}
              onSpeakingRateChange={state.setSpeakingRate}
              isAudioGenerating={state.isAudioGenerationRunning}
              isSpeaking={state.isSpeaking}
              onPreviewVoice={state.handlePreviewVoice}
            />
            
            <Separator className="my-2" />

            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => state.handleAiAction('summary')} disabled={!state.documentText}>
                    <Lightbulb />
                    Summarize & Key Points
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
            <SidebarMenuButton onClick={() => state.handleAiAction('glossary')} disabled={!state.documentText}>
                <BookOpenCheck />
                Create Glossary
            </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => state.handleAiAction('quiz')} disabled={!state.documentText}>
                    <BrainCircuit />
                    {state.activeDoc?.quizAttempt ? 'Review Quiz' : 'Generate Quiz'}
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
            <SidebarMenuButton onClick={() => state.setIsChatOpen(true)} disabled={!state.documentText}>
                <MessageSquare />
                Chat with Document
            </SidebarMenuButton>
            </SidebarMenuItem>
            
            <Separator className="my-2" />

            <DocumentLibrary
              documents={state.userDocuments}
              activeDocId={state.activeDoc?.id || null}
              onSelect={state.handleSelectDocument}
              onDelete={state.handleDeleteDocument}
              onGenerateAudio={state.handleGenerateAudio}
              isAudioGenerating={state.isAudioGenerationRunning}
              onUploadNew={state.handleUploadNewDocumentClick}
            />
            
          </SidebarContent>
          <SidebarFooter>
            {state.session && <UserPanel session={state.session} onLogout={state.handleLogout} onUpdate={state.fetchSession} />}
          </SidebarFooter>
        </Sidebar>
        
        <div className="flex-1 flex flex-col relative bg-muted/30">
          <main className="flex-1 flex items-center justify-center overflow-auto">
            <MainContent
              activeDoc={state.activeDoc}
              isUploading={state.isUploading}
              uploadStage={state.uploadStage}
              pdfZoomLevel={state.pdfZoomLevel}
              currentHighlight={state.currentHighlight}
              documentText={state.documentText}
              onFileChange={state.handleFileChange}
              fileInputRef={state.fileInputRef}
            />
          </main>
          {(state.activeDoc || state.isAudioGenerationRunning) && (
            <div className="absolute inset-x-0 bottom-0 z-10">
              <AudioPlayer
                isSpeaking={state.isSpeaking}
                processingStage={state.activeDoc?.audioGenerationTaskId ? 'polling' : state.generationState}
                processingMessage={state.getProcessingMessage()}
                onPlayPause={state.handlePlayPause}
                canPlay={!!(state.activeDoc?.audioUrl)}
                playbackRate={state.playbackRate}
                onPlaybackRateChange={state.setPlaybackRate}
                showDownload={!!state.activeDoc?.audioUrl && !state.activeDoc?.audioUrl.includes('s3.amazonaws.com') && !state.isAudioGenerationRunning}
                downloadUrl={state.activeDoc?.audioUrl || ''}
                downloadFileName={`${state.activeDoc?.fileName?.replace(/\.pdf$/i, '') || 'audio'}.mp3`}
                progress={state.audioProgress}
                duration={state.audioDuration}
                currentTime={state.audioCurrentTime}
                onSeek={state.handleSeek}
                onForward={state.handleForward}
                onRewind={state.handleRewind}
                zoomLevel={state.pdfZoomLevel}
                onZoomIn={state.handleZoomIn}
                onZoomOut={state.handleZoomOut}
                isFullScreen={state.isFullScreen}
                onFullScreenToggle={() => state.setIsFullScreen(!state.isFullScreen)}
                onSaveZoom={state.handleSaveZoom}
                isSavingZoom={state.isSavingZoom}
                isPdfLoaded={!!state.activeDoc}
              />
            </div>
          )}
        </div>
        
        {state.isChatOpen && state.activeDoc && (
          <ChatWindow
            ref={state.chatWindowRef}
            key={state.activeDoc.id}
            chatHistory={state.activeDoc.chatHistory || []}
            isLoading={state.isChatLoading}
            onSendMessage={state.handleSendMessage}
            onClose={() => state.setIsChatOpen(false)}
            onPlayAudio={state.handlePlayAiResponse}
            onClearChat={state.handleClearChat}
          />
        )}

        <audio 
          ref={state.audioRef} 
          onPlay={() => state.setIsSpeaking(true)}
          onPause={() => state.setIsSpeaking(false)}
          onEnded={() => {
            state.setIsSpeaking(false);
            state.setCurrentHighlight(null);
          }} 
          onLoadedMetadata={(e) => state.setAudioDuration(e.currentTarget.duration)}
          onTimeUpdate={state.handleAudioTimeUpdate}
          hidden 
        />
        <audio ref={state.previewAudioRef} hidden />
        <AiDialog
          open={state.isAiDialogOpen}
          onOpenChange={state.setIsAiDialogOpen}
          type={state.aiDialogType}
          isLoading={state.aiIsLoading}
          summaryOutput={state.aiSummaryOutput}
          glossaryOutput={state.aiGlossaryOutput}
          quizOutput={state.aiQuizOutput}
          quizAttempt={state.activeDoc?.quizAttempt || null}
          onQuizSubmit={state.handleQuizSubmit}
          onPlayAudio={state.handlePlayAiResponse}
        />
      </div>
    </TooltipProvider>
  );
}
