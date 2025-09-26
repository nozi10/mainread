
'use client';

import React, 'useMemo } from 'react';
import type { SpeechMark } from '@/hooks/use-read-page';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

type HighlightLayerProps = {
  textItems: TextItem[] | undefined;
  pageNumber: number;
  highlightedSentence: SpeechMark | null;
  highlightColor: string;
  highlightStyle: 'background' | 'underline';
};

// Normalize text by removing common punctuation and converting to lowercase.
// This makes matching between speech marks and PDF text much more reliable.
const normalizeText = (text: string) => text.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase();

const HighlightLayer: React.FC<HighlightLayerProps> = ({
  textItems,
  pageNumber,
  highlightedSentence,
  highlightColor,
  highlightStyle,
}) => {
  // Memoize the set of normalized words from the current sentence for fast lookups.
  const sentenceWords = useMemo(() => {
    if (!highlightedSentence) return new Set();
    // Split sentence into words, normalize them, and filter out any empty strings.
    return new Set(normalizeText(highlightedSentence.value).split(/\s+/).filter(Boolean));
  }, [highlightedSentence]);

  if (!textItems || !highlightedSentence) {
    return null;
  }
  
  const highlights: React.ReactNode[] = [];

  // Iterate through each text item rendered on the PDF page.
  textItems.forEach((item, index) => {
    const normalizedItemText = normalizeText(item.str);
    
    // Check if the normalized word from the PDF exists in our set of sentence words.
    // This is the core logic that was failing before.
    if (sentenceWords.has(normalizedItemText)) {
      const { transform, width, height } = item;
      // Extract the x/y coordinates from the PDF's transform matrix.
      const x = transform[4];
      const y = transform[5];

      // Define the styles for the highlight span.
      const highlightStyleCss: React.CSSProperties = {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none', // Allow clicking/selecting text through the highlight.
      };
      
      // Apply either the underline or background style based on user preference.
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
          // Use a unique data attribute to help with scrolling and DOM selection.
          data-sentence-id={highlightedSentence.time} 
          style={highlightStyleCss}
        />
      );
    }
  });

  return (
    <div
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    >
      {highlights}
    </div>
  );
};

export default HighlightLayer;
