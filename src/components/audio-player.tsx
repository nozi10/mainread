
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Loader2, Download, Wind, FastForward, Rewind, ZoomIn, ZoomOut, Maximize, Minimize, Save, AlertCircle } from 'lucide-react';
import { Card } from './ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Slider } from './ui/slider';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { AudioGenerationStatus } from '@/lib/db';
import { cn } from '@/lib/utils';


type AudioPlayerProps = {
  isSpeaking: boolean;
  docStatus: AudioGenerationStatus;
  onPlayPause: () => void;
  canPlay: boolean;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  showDownload: boolean;
  downloadUrl: string;
  downloadFileName: string;
  progress: number;
  duration: number;
  currentTime: number;
  onSeek: (value: number) => void;
  onForward: () => void;
  onRewind: () => void;
  isPdfLoaded: boolean;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  isFullScreen: boolean;
  onFullScreenToggle: () => void;
  onSaveZoom: () => void;
  isSavingZoom: boolean;
};

const playbackRates = [0.75, 1.0, 1.25, 1.5, 2.0];

const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const floorSeconds = Math.floor(seconds);
    const min = Math.floor(floorSeconds / 60);
    const sec = floorSeconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isSpeaking,
  docStatus,
  onPlayPause,
  canPlay,
  playbackRate,
  onPlaybackRateChange,
  showDownload,
  downloadUrl,
  downloadFileName,
  progress,
  duration,
  currentTime,
  onSeek,
  onForward,
  onRewind,
  isPdfLoaded,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  isFullScreen,
  onFullScreenToggle,
  onSaveZoom,
  isSavingZoom,
}) => {
  const isGeneratingSpeech = docStatus === 'processing';
  const hasAudio = duration > 0;
  const isDesktop = useMediaQuery('(min-width: 768px)');
  
  const handleDownload = async () => {
    if (!showDownload || !downloadUrl) return;
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Network response was not ok.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Download failed:', error);
      window.open(downloadUrl, '_blank');
    }
  };
  
  const getProcessingMessage = () => {
    switch(docStatus) {
        case 'processing': return 'Generating audio...';
        case 'failed': return 'Audio generation failed.';
        default: return '';
    }
  }


  return (
    <div className="p-2 md:p-4 w-full">
      <Card className="max-w-3xl mx-auto p-4 shadow-2xl bg-card/90 backdrop-blur-sm">
        <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-1 md:gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onRewind} disabled={!hasAudio}>
                            <Rewind className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Rewind 10s</p></TooltipContent>
                </Tooltip>
                <Button 
                    onClick={onPlayPause} 
                    size="lg" 
                    className="rounded-full w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground"
                    aria-label={isSpeaking ? 'Pause' : 'Play'}
                    disabled={isGeneratingSpeech || !canPlay}
                >
                    {isGeneratingSpeech ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                        isSpeaking ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />
                    )}
                </Button>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onForward} disabled={!hasAudio}>
                            <FastForward className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Forward 10s</p></TooltipContent>
                </Tooltip>
            </div>
            
            <div className="flex-1 flex flex-col gap-2">
                 <Slider
                    value={[currentTime]}
                    max={duration || 1}
                    step={1}
                    onValueChange={(value) => onSeek(value[0])}
                    disabled={!hasAudio}
                    className="w-full"
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span className={cn("text-xs font-medium flex items-center gap-1", docStatus === 'failed' && "text-destructive")}>
                      {docStatus === 'failed' && <AlertCircle className="h-4 w-4" />}
                      {getProcessingMessage()}
                    </span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
            
            {isDesktop && <Separator orientation="vertical" className="h-10" />}

            <div className="hidden md:flex items-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onZoomOut} disabled={!isPdfLoaded || zoomLevel <= 0.4}>
                            <ZoomOut className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Zoom Out</p></TooltipContent>
                </Tooltip>
                <span className="text-sm font-semibold w-16 text-center">{(zoomLevel * 100).toFixed(0)}%</span>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onZoomIn} disabled={!isPdfLoaded || zoomLevel >= 3}>
                            <ZoomIn className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Zoom In</p></TooltipContent>
                </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onSaveZoom} disabled={!isPdfLoaded || isSavingZoom}>
                            {isSavingZoom ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Save Zoom Level</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onFullScreenToggle} disabled={!isPdfLoaded}>
                            {isFullScreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}</p></TooltipContent>
                </Tooltip>
            </div>
            
            <Separator orientation="vertical" className="h-10" />
            
             <div className="flex items-center gap-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size={isDesktop ? 'sm' : 'icon'} className={isDesktop ? 'w-20' : ''} disabled={!hasAudio}>
                                <Wind className={isDesktop ? 'mr-2 h-4 w-4' : 'h-5 w-5'} />
                                {isDesktop && `${playbackRate.toFixed(2)}x`}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Playback Speed</p></TooltipContent>
                    </Tooltip>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center">
                    {playbackRates.map(rate => (
                        <DropdownMenuItem key={rate} onClick={() => onPlaybackRateChange(rate)}>
                            {rate.toFixed(2)}x {rate === 1.0 && "(Normal)"}
                        </DropdownMenuItem>
                    ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={!showDownload} onClick={handleDownload}>
                            <Download className="h-5 w-5"/>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Download Audio</p></TooltipContent>
                </Tooltip>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default AudioPlayer;
