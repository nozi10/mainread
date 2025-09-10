
'use server';
/**
 * @fileOverview A text-to-speech AI agent for previewing voices from multiple providers.
 *
 * - previewSpeech - A function that handles the voice preview generation.
 */
import 'dotenv/config';
import { ai } from '@/ai/genkit';
import { PreviewSpeechInputSchema, PreviewSpeechOutputSchema } from '@/ai/schemas';
import OpenAI from 'openai';
import { pollyClient, amazonVoices } from './speech-generation/amazon';
import { SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

async function handleOpenAIPreview(voice: string) {
    const { media } = await ai.generate({
      model: 'openai/tts-1',
      prompt: "Hello! This is a preview of my voice.",
      config: { voice: voice as any },
      output: { format: 'url' }
    });

    if (!media || !media.url) {
        throw new Error('No media URL returned from OpenAI.');
    }
    const audioResponse = await fetch(media.url);
    if (!audioResponse.ok) throw new Error('Failed to fetch audio from OpenAI URL.');
    
    const audioBuffer = await audioResponse.arrayBuffer();
    return `data:audio/mp3;base64,${Buffer.from(audioBuffer).toString('base64')}`;
}

async function handleLemonfoxPreview(voice: string) {
    if (!process.env.LEMONFOX_API_KEY) {
        throw new Error('Lemonfox API key is not configured in environment variables.');
    }

    const lemonfox = new OpenAI({
        apiKey: process.env.LEMONFOX_API_KEY,
        baseURL: "https://api.lemonfox.ai/v1",
    });
    
    const audio = await lemonfox.audio.speech.create({
        input: "Hello! This is a preview of my voice.",
        voice: voice,
        response_format: "mp3",
        model: "tts-1",
    });

    const audioBuffer = await audio.arrayBuffer();
    return `data:audio/mp3;base64,${Buffer.from(audioBuffer).toString('base64')}`;
}

async function handleAmazonPreview(voiceId: string) {
    const voiceConfig = amazonVoices.find(v => v.Id === voiceId);
    if (!voiceConfig) throw new Error(`Amazon voice not found: ${voiceId}`);

    const command = new SynthesizeSpeechCommand({
        OutputFormat: 'mp3',
        Text: "Hello! This is a preview of my voice.",
        VoiceId: voiceId,
        Engine: voiceConfig.SupportedEngines?.includes('neural') ? 'neural' : 'standard',
    });

    const response = await pollyClient.send(command);
    if (!response.AudioStream) throw new Error('No audio stream from Amazon Polly.');
    
    const audioBytes = await response.AudioStream.transformToByteArray();
    return `data:audio/mp3;base64,${Buffer.from(audioBytes).toString('base64')}`;
}


export const previewSpeech = ai.defineFlow(
  {
    name: 'previewSpeech',
    inputSchema: PreviewSpeechInputSchema,
    outputSchema: PreviewSpeechOutputSchema,
  },
  async (input) => {
    
    const [provider, voiceName] = input.voice.split('/');
    let audioDataUri = '';
    
    try {
        switch (provider) {
            case 'openai':
                audioDataUri = await handleOpenAIPreview(voiceName);
                break;
            case 'lemonfox':
                audioDataUri = await handleLemonfoxPreview(voiceName);
                break;
            case 'amazon':
                audioDataUri = await handleAmazonPreview(voiceName);
                break;
            default:
                throw new Error(`Unsupported voice provider: ${provider}`);
        }
        
        return { audioDataUri };
    } catch (error) {
        console.error("Error in previewSpeech flow:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        throw new Error(`Could not process voice preview: ${message}`);
    }
  }
);
