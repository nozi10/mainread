
'use client';

import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpeechMark } from '@/hooks/use-read-page';

pdfjs.GlobalWorkerOptions.workerSrc = `/static/pdf.worker.min.js`;

type PdfViewerProps = {
  file: string;
  zoomLevel: number;
  highlightedSentence: SpeechMark | null;
  pageCharacterOffsets: number[] | null | undefined;
  highlightColor: string;
  highlightStyle: 'background' | 'underline';
};

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    file, 
    zoomLevel,
    highlightedSentence,
    pageCharacterOffsets,
    highlightColor,
    highlightStyle,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [textItemsByPage, setTextItemsByPage] = useState<any[][]>([]);
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

  const onPageLoadSuccess = async (page: any) => {
    const textContent = await page.getTextContent();
    setTextItemsByPage(prev => {
        const newItems = [...prev];
        newItems[page.pageNumber - 1] = textContent.items;
        return newItems;
    });
  }

  const getHighlightStyle = (isHighlighted: boolean) => {
    if (!isHighlighted) return {};
    if (highlightStyle === 'underline') {
        return {
            textDecoration: 'underline',
            textDecorationColor: `hsl(var(--${highlightColor}))`,
            textDecorationThickness: '2px',
        };
    }
    // Default is background
    return {
        backgroundColor: `hsl(var(--${highlightColor}))`,
    };
  };

  const textRenderer = useCallback((pageNumber: number) => (textItem: any) => {
    if (!highlightedSentence || !pageCharacterOffsets) {
        return textItem.str;
    }
    
    // Determine the character offset for the start of the current page.
    const pageStartOffset = pageCharacterOffsets[pageNumber - 1] || 0;
    
    // Adjust the sentence's absolute start/end to be relative to the current page.
    const sentenceStart = highlightedSentence.start - pageStartOffset;
    const sentenceEnd = highlightedSentence.end - pageStartOffset;

    // Determine the start/end of the current text item within the page.
    const allTextItems = textItemsByPage[pageNumber-1] || [];
    const itemIndexInPage = allTextItems.findIndex(item => item === textItem);
    let itemStartOffset = 0;
    for (let i = 0; i < itemIndexInPage; i++) {
        itemStartOffset += allTextItems[i].str.length;
    }
    const itemEndOffset = itemStartOffset + textItem.str.length - 1;

    // Check for overlap between the text item and the highlighted sentence.
    const overlapStart = Math.max(sentenceStart, itemStartOffset);
    const overlapEnd = Math.min(sentenceEnd, itemEndOffset);

    if (overlapStart > overlapEnd) {
      // No overlap
      return textItem.str;
    }

    // There is an overlap, so we need to split the string and wrap the highlighted part.
    const pre = textItem.str.substring(0, Math.max(0, overlapStart - itemStartOffset));
    const highlight = textItem.str.substring(
        Math.max(0, overlapStart - itemStartOffset),
        overlapEnd - itemStartOffset + 1
    );
    const post = textItem.str.substring(overlapEnd - itemStartOffset + 1);

    const highlightStyle = getHighlightStyle(true);
    const styleString = Object.entries(highlightStyle).map(([key, value]) => `${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}:${value}`).join(';');
    
    return `${pre}<span data-sentence-id="${highlightedSentence.time}" style="${styleString}">${highlight}</span>${post}`;

  }, [highlightedSentence, pageCharacterOffsets, textItemsByPage, highlightColor, highlightStyle]);
  
  return (
    <div className="flex flex-col h-full w-full bg-muted">
      <style jsx global>{`
        .react-pdf__Page__textContent.custom-text-layer {
            opacity: 1 !important;
        }
        .dark span[data-sentence-id] {
            color: hsl(var(--foreground));
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
                onLoadSuccess={onPageLoadSuccess}
                customTextRenderer={textRenderer(index + 1)}
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
