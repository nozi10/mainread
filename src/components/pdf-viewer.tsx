
'use client';

import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `/static/pdf.worker.min.js`;

type PdfViewerProps = {
  file: string;
  zoomLevel: number;
  onTextExtracted: (pageNumber: number, items: any[]) => void;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    file, 
    zoomLevel,
    onTextExtracted,
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

  const onPageRenderSuccess = useCallback(async (page: any) => {
    const textContent = await page.getTextContent();
    onTextExtracted(page.pageNumber, textContent.items);
  }, [onTextExtracted]);


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
                onRenderSuccess={onPageRenderSuccess}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
};

export default PdfViewer;
