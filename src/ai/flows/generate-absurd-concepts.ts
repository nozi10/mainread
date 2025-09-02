'use server';

/**
 * @fileOverview Generates a series of nonsensical concepts based on various semantic categories.
 *
 * - generateAbsurdConcepts - A function that generates absurd concepts.
 * - GenerateAbsurdConceptsInput - The input type for the generateAbsurdConcepts function.
 * - GenerateAbsurdConceptsOutput - The return type for the generateAbsurdConcepts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAbsurdConceptsInputSchema = z.object({
  keywords: z
    .string()
    .describe('Keywords to guide the generation of absurd concepts.')
    .optional(),
});
export type GenerateAbsurdConceptsInput = z.infer<typeof GenerateAbsurdConceptsInputSchema>;

const GenerateAbsurdConceptsOutputSchema = z.object({
  nouns: z.array(z.string()).describe('List of nonsensical nouns.'),
  verbs: z.array(z.string()).describe('List of nonsensical verbs.'),
  adjectives: z.array(z.string()).describe('List of nonsensical adjectives.'),
});
export type GenerateAbsurdConceptsOutput = z.infer<typeof GenerateAbsurdConceptsOutputSchema>;

export async function generateAbsurdConcepts(
  input: GenerateAbsurdConceptsInput
): Promise<GenerateAbsurdConceptsOutput> {
  return generateAbsurdConceptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAbsurdConceptsPrompt',
  input: {schema: GenerateAbsurdConceptsInputSchema},
  output: {schema: GenerateAbsurdConceptsOutputSchema},
  prompt: `You are a creative AI that generates lists of absurd concepts.

  Generate a list of nouns, verbs, and adjectives based on the following keywords, if provided: {{{keywords}}}. The output should be creative, unique, and nonsensical, rather than real words.

  Nouns:
  - Example: Quantum Banana
  Verbs:
  - Example: Galactic Giggling
  Adjectives:
  - Example: Transdimensional
  `,
});

const generateAbsurdConceptsFlow = ai.defineFlow(
  {
    name: 'generateAbsurdConceptsFlow',
    inputSchema: GenerateAbsurdConceptsInputSchema,
    outputSchema: GenerateAbsurdConceptsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
