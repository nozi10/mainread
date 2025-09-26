
'use client';

import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

pdfjs.GlobalWorkerOptions.workerSrc = `/static/pdf.worker.min.js`;

type SpeechMark = {
  time: number;
  type: 'sentence' | 'word';
  start: number;
  end: number;
  value: string;
};

type PdfViewerProps = {
  file: string;
  zoomLevel: number;
  highlightedSentence: SpeechMark | null;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    file, 
    zoomLevel,
    highlightedSentence,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const { toast } = useToast();

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error: Error) => {
    if (error.name === 'AbortException') return;
    console.error("PDF Load Error:", error);
    toast({
      variant: 'destructive',
      title: 'Error loading PDF',
      description: error.message || 'Failed to load the document.',
    });
  };

  const textRenderer = useCallback((textItem: any) => {
    if (!highlightedSentence) {
        return textItem.str;
    }

    const { start, end, time } = highlightedSentence;
    const itemStart = textItem.itemIndex;
    const itemEnd = textItem.itemIndex + textItem.str.length -1;
    
    // A simple check to see if the sentence is likely on this page.
    // This is an approximation and might not be perfect for sentences spanning pages.
    if (start > itemEnd + 200 || end < itemStart - 200) {
        return textItem.str;
    }
    
    // Check if the current textItem is part of the highlighted sentence
    const isPartOfSentence = (itemStart >= start && itemEnd <= end);
    if (isPartOfSentence) {
        return `<span data-sentence-id="${time}" class="bg-yellow-200 dark:bg-yellow-600">${textItem.str}</span>`;
    }
    
    return textItem.str;

  }, [highlightedSentence]);
  
  return (
    <div className="flex flex-col h-full w-full bg-muted">
      <style jsx global>{`
        .react-pdf__Page__textContent.custom-text-layer {
            opacity: 1 !important;
        }
      `}</style>
      <div className="flex-1 overflow-auto relative flex items-start justify-center pt-4" id="pdf-viewer-container">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center space-x-2 pt-20">
              <Loader2 className="animate-spin" />
              <span>Loading document...</span>
            </div>
          }
          className="flex flex-col items-center"
        >
          {numPages && Array.from(new Array(numPages), (el, index) => (
            <div 
              key={`page_container_${index + 1}`} 
              className="my-2 shadow-lg relative"
            >
              <Page
                pageNumber={index + 1}
                scale={zoomLevel}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                customTextRenderer={textRenderer}
                className="custom-text-layer"
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
};

export default PdfViewer;

    