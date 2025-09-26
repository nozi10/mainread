
'use client';

import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { saveDocument, type Document, type UserSession } from '@/lib/db';

export function usePdfViewer(
    activeDoc: Document | null, 
    session: UserSession | null,
    fetchUserDocumentsAndFolders: () => void
) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [pdfZoomLevel, setPdfZoomLevel] = useState(1);
  const [isSavingZoom, setIsSavingZoom] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    setPdfZoomLevel(activeDoc?.zoomLevel || session?.defaultZoomLevel || 1);
  }, [activeDoc, session]);

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

  return {
    isFullScreen, setIsFullScreen,
    pdfZoomLevel,
    isSavingZoom,
    handleZoomIn,
    handleZoomOut,
    handleSaveZoom,
  };
}
