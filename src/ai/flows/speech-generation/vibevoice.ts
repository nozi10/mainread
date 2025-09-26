
'use server';

import { Client } from "@gradio/client";

/**
 * Generates speech using the VibeVoice Gradio API and returns an array of data URIs.
 * This function specifically handles single-speaker generation.
 */
export async function generateVibeVoiceSpeech(
  text: string,
  voice: string,
  speed: number // Note: VibeVoice API doesn't seem to have a speed/rate param, so this is unused.
): Promise<string[]> {
  try {
    const client = await Client.connect("NeuralFalcon/VibeVoice-Colab");
    const result = await client.predict("/generate_podcast_with_timestamps", { 		
            num_speakers: 1, 		
            script: text, 		
            speaker_1: voice,
    });

    // The result.data is an array. Based on the docs, the audio file is one of the elements.
    // We need to find the one that corresponds to the audio output.
    let audioOutput;
    if (result.data && Array.isArray(result.data)) {
        audioOutput = result.data.find((d: any) => d && typeof d === 'object' && d.url);
    }

    if (!audioOutput || !audioOutput.url) {
        throw new Error('No audio URL returned from VibeVoice API.');
    }

    // The URL from Gradio is temporary. We must fetch it and convert it to a data URI.
    const audioResponse = await fetch(audioOutput.url);
    if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio from VibeVoice URL: ${audioResponse.statusText}`);
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    // The downloaded file is a .wav file.
    return [`data:audio/wav;base64,${base64Audio}`];

  } catch (error) {
      console.error("Error calling VibeVoice API:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      throw new Error(`VibeVoice API failed: ${message}`);
  }
}
