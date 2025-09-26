
'use server';

import { kv } from '@vercel/kv';
import type { VoiceProviderSettings } from './admin-actions';

const CLEANUP_FLAG_KEY = 'readify:cleanup:lemonfox-setting-removed';

/**
 * A one-time action to remove the 'lemonfox' provider from saved voice settings in KV.
 * It uses a flag to ensure it only runs once per environment.
 */
export async function removeLemonfoxFromSettings(): Promise<{ success: boolean; message: string }> {
  try {
    const hasRun = await kv.get(CLEANUP_FLAG_KEY);

    if (hasRun) {
      return { success: true, message: 'Cleanup has already been performed.' };
    }

    console.log('Running one-time cleanup to remove Lemonfox from voice settings...');

    const VOICE_SETTINGS_KEY = 'readify:settings:voice-providers';
    const settings = await kv.get<VoiceProviderSettings>(VOICE_SETTINGS_KEY);

    if (settings && 'lemonfox' in settings) {
      delete settings.lemonfox;
      await kv.set(VOICE_SETTINGS_KEY, settings);
      console.log('Successfully removed Lemonfox key from voice settings.');
    } else {
      console.log('No Lemonfox key found in voice settings. No action needed.');
    }

    // Set the flag to prevent this from running again.
    await kv.set(CLEANUP_FLAG_KEY, true);

    return { success: true, message: 'Cleanup completed successfully.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('Error during settings cleanup:', message);
    return { success: false, message };
  }
}
