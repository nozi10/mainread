
/**
 * @fileOverview Implements a Genkit flow for voice selection in a text-to-speech application.
 *
 * Exports:
 *   - `getAvailableVoices`: Retrieves a list of available voices based on admin settings.
 *   - `AvailableVoice`: The type for an available voice.
 */

import {ai} from '@/ai/genkit';
import { getVoiceProviderSettings } from '@/lib/admin-actions';
import {z} from 'zod';

const AvailableVoiceSchema = z.object({
  name: z.string().describe('The unique identifier for the voice, including provider.'),
  displayName: z.string().describe('The user-facing name for the voice.'),
  gender: z.string().describe('The gender of the voice.'),
  provider: z.enum(['openai', 'amazon', 'vibevoice']).describe('The TTS provider for the voice.'),
});
export type AvailableVoice = z.infer<typeof AvailableVoiceSchema>;

const allVoices: AvailableVoice[] = [
    // OpenAI
    { name: 'openai/alloy', displayName: 'Alloy', gender: 'Neutral', provider: 'openai' },
    { name: 'openai/echo', displayName: 'Echo', gender: 'Male', provider: 'openai' },
    { name: 'openai/fable', displayName: 'Fable', gender: 'Male', provider: 'openai' },
    { name: 'openai/onyx', displayName: 'Onyx', gender: 'Male', provider: 'openai' },
    { name: 'openai/nova', displayName: 'Nova', gender: 'Female', provider: 'openai' },
    { name: 'openai/shimmer', displayName: 'Shimmer', gender: 'Female', provider: 'openai' },
    // Amazon Polly
    { name: 'amazon/Matthew', displayName: 'Matthew (US)', gender: 'Male', provider: 'amazon' },
    { name: 'amazon/Joanna', displayName: 'Joanna (US)', gender: 'Female', provider: 'amazon' },
    { name: 'amazon/Ivy', displayName: 'Ivy (US Child)', gender: 'Female', provider: 'amazon' },
    { name: 'amazon/Justin', displayName: 'Justin (US Child)', gender: 'Male', provider: 'amazon' },
    { name: 'amazon/Brian', displayName: 'Brian (British)', gender: 'Male', provider: 'amazon' },
    { name: 'amazon/Amy', displayName: 'Amy (British)', gender: 'Female', provider: 'amazon' },
    { name: 'amazon/Nicole', displayName: 'Nicole (Australian)', gender: 'Female', provider: 'amazon' },
    // VibeVoice
    { name: 'vibevoice/en-Alice_woman', displayName: 'Alice', gender: 'Female', provider: 'vibevoice' },
    { name: 'vibevoice/en-Carter_man', displayName: 'Carter', gender: 'Male', provider: 'vibevoice' },
    { name: 'vibevoice/en-Frank_man', displayName: 'Frank', gender: 'Male', provider: 'vibevoice' },
    { name: 'vibevoice/en-Maya_woman', displayName: 'Maya', gender: 'Female', provider: 'vibevoice' },
];

export async function getAvailableVoices(): Promise<AvailableVoice[]> {
  try {
    const settings = await getVoiceProviderSettings();
    const enabledProviders = Object.keys(settings).filter(provider => settings[provider]);
    
    // If no settings are stored, enable all providers by default.
    if (enabledProviders.length === 0) {
        return allVoices;
    }

    return allVoices.filter(voice => enabledProviders.includes(voice.provider));
  } catch (error) {
    console.error("Failed to fetch voice provider settings, returning all voices as a fallback:", error);
    // In case of an error (e.g., KV not available), return all voices to not break the app.
    return allVoices;
  }
}

export function getAllVoiceProviders(): string[] {
    const providers = new Set(allVoices.map(v => v.provider));
    return Array.from(providers);
}
