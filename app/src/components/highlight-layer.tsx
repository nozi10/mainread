
'use client';

import React, { useMemo } from 'react';
import type { SpeechMark } from '@/hooks/use-read-page';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

type HighlightLayerProps = {
  textItems: TextItem[] | undefined;
  pageNumber: number;
  highlightedSentence: SpeechMark | null;
  highlightColor: string;
  highlightStyle: 'background' | 'underline';
};

// Normalize text by removing punctuation and converting to lowercase
const normalizeText = (text: string) => text.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase();

const HighlightLayer: React.FC<HighlightLayerProps> = ({
  textItems,
  pageNumber,
  highlightedSentence,
  highlightColor,
  highlightStyle,
}) => {
  const sentenceWords = useMemo(() => {
    if (!highlightedSentence) return new Set();
    // Split sentence into words and normalize them for matching
    return new Set(normalizeText(highlightedSentence.value).split(/\s+/).filter(Boolean));
  }, [highlightedSentence]);

  if (!textItems || !highlightedSentence) {
    return null;
  }
  
  const highlights: React.ReactNode[] = [];

  textItems.forEach((item, index) => {
    const normalizedItemText = normalizeText(item.str);
    // Check if the normalized word from the PDF exists in our set of sentence words
    if (sentenceWords.has(normalizedItemText)) {
      const { transform, width, height } = item;
      const x = transform[4];
      const y = transform[5];

      const highlightStyleCss: React.CSSProperties = {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none', // Allow clicking through the highlight
      };
      
      if(highlightStyle === 'underline') {
          highlightStyleCss.borderBottom = `2px solid hsl(var(--${highlightColor}))`;
          highlightStyleCss.opacity = 1;
      } else {
          highlightStyleCss.backgroundColor = `hsl(var(--${highlightColor}))`;
          highlightStyleCss.opacity = 0.4;
      }
      
      highlights.push(
        <span
          key={`${pageNumber}-${index}`}
          // Use sentence time as a group identifier for all words in that sentence
          data-sentence-id={highlightedSentence.time} 
          style={highlightStyleCss}
        />
      );
    }
  });

  return (
    <div
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{
          // This ensures the overlay matches the rendered page dimensions.
          // react-pdf's canvas might have a transform applied for high-res displays.
      }}
    >
      {highlights}
    </div>
  );
};

export default HighlightLayer;
