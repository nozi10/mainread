
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Document } from '@/lib/db';
import type { SpeechMark } from './use-read-page';
import { useToast } from './use-toast';

export function useAudioPlayer(audioRef: React.RefObject<HTMLAudioElement>, activeDoc: Document | null) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [speechMarks, setSpeechMarks] = useState<SpeechMark[] | null>(null);
  const [highlightedSentence, setHighlightedSentence] = useState<SpeechMark | null>(null);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const localAudioUrlRef = useRef<string | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    return () => { // Cleanup on unmount
        if (localAudioUrlRef.current) {
            URL.revokeObjectURL(localAudioUrlRef.current);
        }
    }
  }, []);

  useEffect(() => {
    if (localAudioUrl) {
      localAudioUrlRef.current = localAudioUrl;
    }
  }, [localAudioUrl]);


  useEffect(() => {
    if (!audioRef.current) return;
    
    const audioEl = audioRef.current;
    
    if (localAudioUrl) {
        const handleAutoplay = async () => {
            if (!audioEl) return;
            try {
                await audioEl.play();
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
        audioEl.src = localAudioUrl;
        handleAutoplay();
    } else if (activeDoc?.audioUrl && audioEl.src !== activeDoc.audioUrl) {
        audioEl.src = activeDoc.audioUrl;
        audioEl.load();
        setIsSpeaking(false); 
    } else if (!activeDoc) {
        audioEl.src = "";
        audioEl.removeAttribute('src');
        setAudioDuration(0);
        setAudioCurrentTime(0);
        setAudioProgress(0);
        setSpeechMarks(null);
        setHighlightedSentence(null);
    }

  }, [activeDoc, localAudioUrl, toast, audioRef]);
  
  useEffect(() => {
    const fetchSpeechMarks = async () => {
        if (activeDoc?.speechMarksUrl) {
            try {
                const response = await fetch(activeDoc.speechMarksUrl);
                if (!response.ok) throw new Error('Failed to fetch speech marks');
                const marksText = await response.text();
                const marks = marksText.trim().split('\n').map(line => JSON.parse(line));
                setSpeechMarks(marks);
            } catch (error) {
                console.error("Error fetching or parsing speech marks:", error);
                setSpeechMarks(null);
                toast({
                    variant: "destructive",
                    title: "Highlighting Error",
                    description: "Could not load data for text highlighting."
                });
            }
        } else {
            setSpeechMarks(null);
            setHighlightedSentence(null);
        }
    };
    fetchSpeechMarks();
  }, [activeDoc, toast]);
  
  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    const audioEl = audioRef.current;
    if (isSpeaking) {
      audioEl.pause();
    } else if (audioEl.src && audioEl.src !== window.location.href) { 
      try {
        await audioEl.play();
      } catch (error) {
        console.error("Error playing audio:", error);
        toast({ variant: "destructive", title: "Playback Error", description: "Could not play the audio file."});
        setIsSpeaking(false);
        audioEl.src = '';
        audioEl.removeAttribute('src');
      }
    }
  };
  
  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    const audioEl = audioRef.current;
    const currentTimeMs = audioEl.currentTime * 1000;
    setAudioCurrentTime(audioEl.currentTime);
    if (audioDuration > 0) setAudioProgress((audioEl.currentTime / audioDuration) * 100);

    if (!speechMarks) return;
    
    const currentSentence = speechMarks.findLast(
        (mark): mark is SpeechMark => mark.type === 'sentence' && currentTimeMs >= mark.time
    );
    
    if (currentSentence && currentSentence.value !== highlightedSentence?.value) {
        setHighlightedSentence(currentSentence);
    }
  };
  
  useEffect(() => {
    if(audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, audioRef]);

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

  return {
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
  };
}
