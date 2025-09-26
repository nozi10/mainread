
'use client';

import React from 'react';
import type { SpeechMark } from '@/hooks/use-read-page';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

type HighlightLayerProps = {
  textItems: TextItem[] | undefined;
  pageNumber: number;
  highlightedSentence: SpeechMark | null;
  pageCharacterOffsets: number[] | null | undefined;
  highlightColor: string;
  highlightStyle: 'background' | 'underline';
};

const HighlightLayer: React.FC<HighlightLayerProps> = ({
  textItems,
  pageNumber,
  highlightedSentence,
  pageCharacterOffsets,
  highlightColor,
  highlightStyle,
}) => {
  if (!textItems || !highlightedSentence || !pageCharacterOffsets) {
    return null;
  }

  // Determine the character offset for the start of the current page.
  const pageStartOffset = pageCharacterOffsets[pageNumber - 1] ?? 0;
  
  // Adjust the sentence's absolute start/end to be relative to the current page.
  const sentenceStartOnPage = highlightedSentence.start - pageStartOffset;
  const sentenceEndOnPage = highlightedSentence.end - pageStartOffset;

  let currentOffset = 0;
  const highlights: React.ReactNode[] = [];

  textItems.forEach((item, index) => {
    const itemStartOffset = currentOffset;
    const itemEndOffset = itemStartOffset + item.str.length;

    // Check for overlap between the text item and the highlighted sentence.
    const overlapStart = Math.max(sentenceStartOnPage, itemStartOffset);
    const overlapEnd = Math.min(sentenceEndOnPage, itemEndOffset);

    if (overlapStart < overlapEnd) {
      // There is an overlap.
      const { transform, width, height } = item;
      const x = transform[4];
      const y = transform[5];

      const highlightStyleCss: React.CSSProperties = {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        opacity: 0.4,
        pointerEvents: 'none', // Allow clicking through the highlight
      };
      
      if(highlightStyle === 'underline') {
          highlightStyleCss.borderBottom = `2px solid hsl(var(--${highlightColor}))`;
          highlightStyleCss.opacity = 1;
      } else {
          highlightStyleCss.backgroundColor = `hsl(var(--${highlightColor}))`;
      }
      
      highlights.push(
        <span
          key={`${pageNumber}-${index}`}
          data-sentence-id={highlightedSentence.time}
          style={highlightStyleCss}
        />
      );
    }
    
    // Add a space offset if the item ends with a space.
    currentOffset += item.str.length + (item.hasEOL ? 1 : 0);
  });

  return (
    <div
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{
          // This ensures the overlay matches the rendered page dimensions.
          // The page's canvas has this transform applied.
          transform: `scale(${window.devicePixelRatio})`,
          transformOrigin: 'top left',
      }}
    >
      {highlights}
    </div>
  );
};

export default HighlightLayer;
