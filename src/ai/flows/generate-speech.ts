
'use server';

/**
 * @fileOverview An text-to-speech AI agent using multiple providers.
 * This flow generates audio from text, supporting long inputs by splitting them into chunks.
 * It returns an array of audio data URIs to be concatenated on the client.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 */
import 'dotenv/config';
import { ai } from '@/ai/genkit';
import { GenerateSpeechInputSchema, GenerateSpeechOutputSchema, GenerateSpeechInput } from '@/ai/schemas';
import { formatTextForSpeech } from './format-text-for-speech';
import { generateOpenAIVoice } from './speech-generation/openai';
import { generateLemonfoxVoice } from './speech-generation/lemonfox';
import { startAmazonVoiceGeneration } from './speech-generation/amazon-async';
import { generateAmazonVoiceSync } from './speech-generation/amazon-sync';
import { generateVibeVoiceSpeech } from './speech-generation/vibevoice';


// This function can be directly called from client components as a Server Action.
export async function generateSpeech(
  input: GenerateSpeechInput
): Promise<GenerateSpeechOutputSchema> {
    
    if (!input.text || !input.text.trim()) {
        throw new Error("Input text cannot be empty.");
    }

    try {
        console.log('--- Starting speech generation ---');

        const { formattedText } = await formatTextForSpeech({ rawText: input.text });
        
        const [provider, voiceName] = input.voice.split('/');
        const speakingRate = input.speakingRate || 1.0;
        let audioDataUris: string[] = [];
        let pollyTaskId: string | undefined;

        switch (provider) {
            case 'openai':
                audioDataUris = await generateOpenAIVoice(formattedText, voiceName, speakingRate);
                break;
            case 'lemonfox':
                audioDataUris = await generateLemonfoxVoice(formattedText, voiceName, speakingRate);
                break;
            case 'vibevoice':
                audioDataUris = await generateVibeVoiceSpeech(formattedText, voiceName, speakingRate);
                break;
            case 'amazon':
                // If a docId is present, we are generating audio for a full document
                // and should use the asynchronous, S3-saving method.
                if (input.docId) {
                    const { taskId } = await startAmazonVoiceGeneration(formattedText, voiceName, speakingRate, input.docId, input.fileName);
                    pollyTaskId = taskId;
                } else {
                    // Otherwise, it's a short, on-the-fly request (e.g., chat, TTS tab),
                    // so we use the synchronous method that returns a data URI directly.
                    audioDataUris = await generateAmazonVoiceSync(formattedText, voiceName, speakingRate);
                }
                break;
            default:
                throw new Error(`Unsupported voice provider: ${provider}`);
        }

        if (pollyTaskId) {
            return { pollyTaskId };
        }
        
        if (audioDataUris.length === 0) {
            throw new Error("No audio was generated.");
        }

        return { audioDataUris };

    } catch (error: any) {
        console.error("Error in generateSpeech action:", error);
        // Re-throw the error so the client can catch it.
        throw new Error(`Failed to generate speech: ${error.message}`);
    }
}
