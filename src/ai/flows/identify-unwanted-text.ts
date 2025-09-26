
'use server';

/**
 * @fileOverview An AI agent for identifying unwanted text artifacts in a document.
 * This flow does not clean the text, but rather returns a list of phrases to be ignored.
 *
 * - identifyUnwantedText - A function that identifies headers, footers, etc.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IdentifyUnwantedTextInputSchema = z.object({
  rawText: z.string().describe('The raw, unmodified text extracted from a document.'),
});

const IdentifyUnwantedTextOutputSchema = z.object({
  unwantedText: z.array(z.string()).describe('A list of repetitive headers, footers, page numbers, and other artifacts found in the text.'),
});
export type IdentifyUnwantedTextOutput = z.infer<typeof IdentifyUnwantedTextOutputSchema>;

export async function identifyUnwantedText(
  input: z.infer<typeof IdentifyUnwantedTextInputSchema>
): Promise<IdentifyUnwantedTextOutput> {
  return identifyUnwantedTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifyUnwantedTextPrompt',
  input: {schema: IdentifyUnwantedTextInputSchema},
  output: {schema: IdentifyUnwantedTextOutputSchema},
  prompt: `You are an expert document processor. Your task is to analyze the following raw text from a document and identify all repetitive content that appears to be a header, footer, or page number.

  Follow these rules:
  1.  **Identify Repetitions**: Look for text fragments that repeat on multiple pages or in a predictable pattern.
  2.  **List Exact Phrases**: Return the exact phrases you identify. For example, if "Chapter 3: The Journey" is a header, return that exact string. If "Page 12" is a footer, return "Page 12".
  3.  **Be Comprehensive**: Find all unique instances of such artifacts.
  4.  **Do Not Modify**: Do not alter the main body of the text in any way. Your only output should be the list of unwanted text fragments.

  Raw Document Text:
  ---
  {{{rawText}}}
  ---
  `,
});

const identifyUnwantedTextFlow = ai.defineFlow(
  {
    name: 'identifyUnwantedTextFlow',
    inputSchema: IdentifyUnwantedTextInputSchema,
    outputSchema: IdentifyUnwantedTextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
