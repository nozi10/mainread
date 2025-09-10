
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
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

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
      const pageElement = pageRefs.current[highlightedSentence.pageNumber];
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedSentence]);

  const renderHighlights = (pageNumber: number) => {
    if (!highlightedSentence || highlightedSentence.pageNumber !== pageNumber) {
      return null;
    }
  
    // Combine adjacent items into a single highlight box for better visuals
    const combinedItems: { x: number, y: number, width: number, height: number }[] = [];
    let currentLine: { x: number, y: number, width: number, height: number, endX: number } | null = null;
  
    highlightedSentence.items.forEach(item => {
      if (currentLine && Math.abs(currentLine.y - (item.y * zoomLevel)) < 5) { // Same line
        currentLine.width += item.width * zoomLevel;
        currentLine.endX += item.width * zoomLevel;
      } else {
        if (currentLine) combinedItems.push(currentLine);
        currentLine = {
          x: item.x * zoomLevel,
          y: item.y * zoomLevel,
          width: item.width * zoomLevel,
          height: item.height * zoomLevel,
          endX: (item.x + item.width) * zoomLevel
        };
      }
    });
    if (currentLine) combinedItems.push(currentLine);
  
    return combinedItems.map((item, index) => (
      <div
        key={index}
        style={{
          position: 'absolute',
          left: `${item.x}px`,
          top: `${item.y}px`,
          width: `${item.width}px`,
          height: `${item.height}px`,
          backgroundColor: 'hsla(var(--primary) / 0.3)',
          zIndex: 10,
          pointerEvents: 'none',
          borderRadius: '2px',
        }}
      />
    ));
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
            <div 
              key={`page_container_${index + 1}`} 
              ref={(el) => pageRefs.current[index + 1] = el}
              className="my-2 shadow-lg relative"
            >
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
