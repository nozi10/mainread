
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
import { startAmazonVoiceGeneration } from './speech-generation/amazon-async';
import { generateAmazonVoiceSync } from './speech-generation/amazon-sync';
import { generateVibeVoiceSpeech } from './speech-generation/vibevoice';
import { generateLemonfoxVoiceWithTimestamps, generateLemonfoxVoiceSync } from './speech-generation/lemonfox';


// This function can be directly called from client components as a Server Action.
export async function generateSpeech(
  input: GenerateSpeechInput
): Promise<GenerateSpeechOutputSchema> {
    
    if (!input.text || !input.text.trim()) {
        throw new Error("Input text cannot be empty.");
    }

    try {
        console.log('--- Starting speech generation ---');

        // Note: For Amazon and Lemonfox async, we use the raw text for accurate timestamps. For others, we format it first.
        const useRawText = (input.voice.startsWith('amazon') || input.voice.startsWith('lemonfox')) && input.docId;
        const textToUse = useRawText
            ? input.text
            : (await formatTextForSpeech({ rawText: input.text })).formattedText;
        
        const [provider, voiceName] = input.voice.split('/');
        const speakingRate = input.speakingRate || 1.0;
        let audioDataUris: string[] = [];
        let pollyAudioTaskId: string | undefined;
        let pollyMarksTaskId: string | undefined;
        let audioUrl: string | undefined;
        let speechMarksUrl: string | undefined;

        switch (provider) {
            case 'openai':
                audioDataUris = await generateOpenAIVoice(textToUse, voiceName, speakingRate);
                break;
            case 'vibevoice':
                audioDataUris = await generateVibeVoiceSpeech(textToUse, voiceName, speakingRate);
                break;
            case 'lemonfox':
                 if (input.docId) {
                    const { uploadedAudioUrl, uploadedSpeechMarksUrl } = await generateLemonfoxVoiceWithTimestamps(textToUse, voiceName, speakingRate, input.docId, input.fileName);
                    audioUrl = uploadedAudioUrl;
                    speechMarksUrl = uploadedSpeechMarksUrl;
                } else {
                    audioDataUris = await generateLemonfoxVoiceSync(textToUse, voiceName, speakingRate);
                }
                break;
            case 'amazon':
                // If a docId is present, we are generating audio for a full document
                // and should use the asynchronous, S3-saving method.
                if (input.docId) {
                    const { audioTaskId, marksTaskId } = await startAmazonVoiceGeneration(textToUse, voiceName, speakingRate, input.docId, input.fileName);
                    pollyAudioTaskId = audioTaskId;
                    pollyMarksTaskId = marksTaskId;
                } else {
                    // Otherwise, it's a short, on-the-fly request (e.g., chat, TTS tab),
                    // so we use the synchronous method that returns a data URI directly.
                    audioDataUris = await generateAmazonVoiceSync(textToUse, voiceName, speakingRate);
                }
                break;
            default:
                throw new Error(`Unsupported voice provider: ${provider}`);
        }

        if (pollyAudioTaskId && pollyMarksTaskId) {
            return { pollyAudioTaskId, pollyMarksTaskId };
        }
        
        if (audioUrl && speechMarksUrl) {
            return { audioUrl, speechMarksUrl };
        }

        if (audioDataUris.length > 0) {
            return { audioDataUris };
        }

        // If we get here, it means no audio was generated and it wasn't an async task.
        throw new Error("Audio generation resulted in no audio output.");


    } catch (error: any) {
        console.error("Error in generateSpeech action:", error);
        // Re-throw the error so the client can catch it.
        throw new Error(`Failed to generate speech: ${error.message}`);
    }
}
