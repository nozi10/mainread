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
  provider: z.enum(['openai', 'amazon', 'lemonfox']).describe('The TTS provider for the voice.'),
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
    // Lemonfox
    { name: 'lemonfox/heart', displayName: 'Heart', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/bella', displayName: 'Bella', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/michael', displayName: 'Michael', gender: 'Male', provider: 'lemonfox' },
    { name: 'lemonfox/alloy', displayName: 'Alloy', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/aoede', displayName: 'Aoede', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/kore', displayName: 'Kore', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/jessica', displayName: 'Jessica', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/nicole', displayName: 'Nicole', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/nova', displayName: 'Nova', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/river', displayName: 'River', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/sarah', displayName: 'Sarah', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/sky', displayName: 'Sky', gender: 'Female', provider: 'lemonfox' },
    { name: 'lemonfox/echo', displayName: 'Echo', gender: 'Male', provider: 'lemonfox' },
    { name: 'lemonfox/eric', displayName: 'Eric', gender: 'Male', provider: 'lemonfox' },
    { name: 'lemonfox/fenrir', displayName: 'Fenrir', gender: 'Male', provider: 'lemonfox' },
    { name: 'lemonfox/liam', displayName: 'Liam', gender: 'Male', provider: 'lemonfox' },
    { name: 'lemonfox/onyx', displayName: 'Onyx', gender: 'Male', provider: 'lemonfox' },
    { name: 'lemonfox/puck', displayName: 'Puck', gender: 'Male', provider: 'lemonfox' },
    { name: 'lemonfox/adam', displayName: 'Adam', gender: 'Male', provider: 'lemonfox' },
    { name: 'lemonfox/santa', displayName: 'Santa', gender: 'Male', provider: 'lemonfox' },
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
