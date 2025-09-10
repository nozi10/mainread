
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Sentence } from '@/hooks/use-read-page';

pdfjs.GlobalWorkerOptions.workerSrc = `/static/pdf.worker.min.js`;

type PdfViewerProps = {
  file: string;
  zoomLevel: number;
  onTextExtracted: (pageNumber: number, items: any[]) => void;
  highlightedSentence: Sentence | null;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    file, 
    zoomLevel,
    onTextExtracted,
    highlightedSentence,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const { toast } = useToast();
  const highlightRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const onPageRenderSuccess = useCallback(async (page: any) => {
    const textContent = await page.getTextContent();
    onTextExtracted(page.pageNumber, textContent.items);
  }, [onTextExtracted]);

  useEffect(() => {
    if (highlightedSentence) {
      const firstItem = highlightedSentence.items[0];
      if (firstItem) {
        const highlightId = `highlight-${firstItem.pageNumber}-${firstItem.text.slice(0, 10)}`;
        const element = highlightRefs.current[highlightId];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [highlightedSentence]);

  const renderHighlights = (pageNumber: number) => {
    if (!highlightedSentence || highlightedSentence.pageNumber !== pageNumber) {
      return null;
    }

    return highlightedSentence.items.map((item, index) => {
      const highlightId = `highlight-${pageNumber}-${item.text.slice(0, 10)}`;
      return (
        <div
          key={index}
          ref={(el) => (highlightRefs.current[highlightId] = el)}
          style={{
            position: 'absolute',
            left: `${item.x}px`,
            top: `${item.y}px`,
            width: `${item.width}px`,
            height: `${item.height}px`,
            backgroundColor: 'rgba(255, 255, 0, 0.4)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
      );
    });
  };

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
            <div key={`page_${index + 1}`} className="my-2 shadow-lg relative">
              <Page
                pageNumber={index + 1}
                scale={zoomLevel}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                onRenderSuccess={onPageRenderSuccess}
              />
              {renderHighlights(index + 1)}
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
};

export default PdfViewer;
