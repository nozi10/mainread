'use server';

/**
 * @fileOverview AI flow to generate creative titles for absurd stories.
 *
 * - generateCreativeTitle - A function that generates creative titles for absurd stories.
 * - GenerateCreativeTitleInput - The input type for the generateCreativeTitle function.
 * - GenerateCreativeTitleOutput - The return type for the generateCreativeTitle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCreativeTitleInputSchema = z.object({
  story: z.string().describe('The absurd story to generate a title for.'),
});
export type GenerateCreativeTitleInput = z.infer<
  typeof GenerateCreativeTitleInputSchema
>;

const GenerateCreativeTitleOutputSchema = z.object({
  title: z.string().describe('The generated creative title for the story.'),
});
export type GenerateCreativeTitleOutput = z.infer<
  typeof GenerateCreativeTitleOutputSchema
>;

export async function generateCreativeTitle(
  input: GenerateCreativeTitleInput
): Promise<GenerateCreativeTitleOutput> {
  return generateCreativeTitleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCreativeTitlePrompt',
  input: {schema: GenerateCreativeTitleInputSchema},
  output: {schema: GenerateCreativeTitleOutputSchema},
  prompt: `You are a creative title generator for absurd stories.

  Generate a creative and catchy title for the following story:

  {{story}}`,
});

const generateCreativeTitleFlow = ai.defineFlow(
  {
    name: 'generateCreativeTitleFlow',
    inputSchema: GenerateCreativeTitleInputSchema,
    outputSchema: GenerateCreativeTitleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
