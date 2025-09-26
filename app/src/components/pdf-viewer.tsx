
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { SpeechMark } from '@/hooks/use-read-page';
import HighlightLayer from './highlight-layer';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

pdfjs.GlobalWorkerOptions.workerSrc = `/static/pdf.worker.min.js`;

type PdfViewerProps = {
  file: string;
  zoomLevel: number;
  highlightedSentence: SpeechMark | null;
  highlightColor: string;
  highlightStyle: 'background' | 'underline';
};

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    file, 
    zoomLevel,
    highlightedSentence,
    highlightColor,
    highlightStyle,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [textItemsByPage, setTextItemsByPage] = useState<Record<number, TextItem[]>>({});
  const { toast } = useToast();

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    // Reset text items when a new document is loaded to prevent stale data
    setTextItemsByPage({});
  }, []);

  const onDocumentLoadError = (error: Error) => {
    if (error.name === 'AbortException') return;
    console.error("PDF Load Error:", error);
    toast({
      variant: 'destructive',
      title: 'Error loading PDF',
      description: error.message || 'Failed to load the document.',
    });
  };

  // This function is called after each page successfully renders.
  // It extracts the text content and its coordinates, which is crucial for the HighlightLayer.
  const onPageLoadSuccess = async (page: any) => {
    try {
      const textContent = await page.getTextContent();
      setTextItemsByPage(prev => ({
          ...prev,
          [page.pageNumber]: textContent.items as TextItem[],
      }));
    } catch (error) {
       console.error("Failed to get text content from page", error);
    }
  };

  // This effect handles the auto-scrolling.
  useEffect(() => {
    if (highlightedSentence) {
        // Find the first span that is part of the current highlighted sentence.
        const highlightElement = document.querySelector(`span[data-sentence-id="${highlightedSentence.time}"]`);
        if (highlightElement) {
            // Scroll the element into the center of the view smoothly.
            highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [highlightedSentence]);
  
  return (
    <div className="flex flex-col h-full w-full bg-muted">
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
                onLoadSuccess={onPageLoadSuccess}
              />
              <HighlightLayer
                  textItems={textItemsByPage[index + 1]}
                  pageNumber={index + 1}
                  highlightedSentence={highlightedSentence}
                  highlightColor={highlightColor}
                  highlightStyle={highlightStyle}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
};

export default PdfViewer;
