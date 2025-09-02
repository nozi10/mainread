// weave-absurd-story.ts
'use server';

/**
 * @fileOverview Weaves generated concepts into a bizarre, short story using a Large Language Model.
 *
 * - weaveAbsurdStory - A function that handles the weaving of concepts into a story.
 * - WeaveAbsurdStoryInput - The input type for the weaveAbsurdStory function.
 * - WeaveAbsurdStoryOutput - The return type for the weaveAbsurdStory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const WeaveAbsurdStoryInputSchema = z.object({
  concepts: z
    .array(z.string())
    .describe('An array of nonsensical concepts to weave into a story.'),
});
export type WeaveAbsurdStoryInput = z.infer<typeof WeaveAbsurdStoryInputSchema>;

const WeaveAbsurdStoryOutputSchema = z.object({
  story: z.string().describe('A bizarre, short story woven from the given concepts.'),
});
export type WeaveAbsurdStoryOutput = z.infer<typeof WeaveAbsurdStoryOutputSchema>;

export async function weaveAbsurdStory(input: WeaveAbsurdStoryInput): Promise<WeaveAbsurdStoryOutput> {
  return weaveAbsurdStoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'weaveAbsurdStoryPrompt',
  input: {schema: WeaveAbsurdStoryInputSchema},
  output: {schema: WeaveAbsurdStoryOutputSchema},
  prompt: `You are a creative storyteller specializing in weaving absurd concepts into bizarre, short stories.

  Weave the following concepts into a short story, highlighting their ridiculous nature. The story should be no more than 200 words.

  Concepts:
  {{#each concepts}}
  - {{{this}}}
  {{/each}}`,
});

const weaveAbsurdStoryFlow = ai.defineFlow(
  {
    name: 'weaveAbsurdStoryFlow',
    inputSchema: WeaveAbsurdStoryInputSchema,
    outputSchema: WeaveAbsurdStoryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
