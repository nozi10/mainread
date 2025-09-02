'use server';

import { z } from 'zod';
import { generateAbsurdConcepts } from '@/ai/flows/generate-absurd-concepts';
import { generateCreativeTitle } from '@/ai/flows/generate-creative-title';
import { weaveAbsurdStory } from '@/ai/flows/weave-absurd-story';

const inputSchema = z.object({
  keywords: z.string().optional(),
});

export async function generateFullAbsurdStory(
  prevState: any,
  formData: FormData
) {
  try {
    const validatedInput = inputSchema.safeParse({
      keywords: formData.get('keywords') as string,
    });

    if (!validatedInput.success) {
      return {
        title: '',
        story: '',
        error: 'Invalid input.',
      };
    }

    const { keywords } = validatedInput.data;

    const conceptsResult = await generateAbsurdConcepts({ keywords });
    const allConcepts = [
      ...conceptsResult.nouns,
      ...conceptsResult.verbs,
      ...conceptsResult.adjectives,
    ];

    if (allConcepts.length === 0) {
      return {
        title: '',
        story: '',
        error: 'Could not generate any concepts. Try different keywords.',
      };
    }

    const storyResult = await weaveAbsurdStory({ concepts: allConcepts });
    if (!storyResult.story) {
      return {
        title: '',
        story: '',
        error: 'Failed to weave a story from the concepts.',
      };
    }

    const titleResult = await generateCreativeTitle({
      story: storyResult.story,
    });

    return {
      title: titleResult.title,
      story: storyResult.story,
      error: undefined,
    };
  } catch (e) {
    console.error(e);
    return {
      title: '',
      story: '',
      error: 'An unexpected error occurred while generating the story.',
    };
  }
}
