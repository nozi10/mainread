
'use server';
/**
 * @fileOverview A text-to-speech AI agent for previewing voices from multiple providers.
 *
 * - previewSpeech - A function that handles the voice preview generation.
 */
import 'dotenv/config';
import { ai } from '@/ai/genkit';
import { PreviewSpeechInputSchema, PreviewSpeechOutputSchema } from '@/ai/schemas';
import { PollyClient, SynthesizeSpeechCommand, SpeechMarkType } from '@aws-sdk/client-polly';

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

async function handleAmazonPreview(voice: string) {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
        throw new Error('AWS credentials or region are not configured in environment variables.');
    }
    
    const pollyClient = new PollyClient({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    const command = new SynthesizeSpeechCommand({
        Text: 'Hello! This is a preview of my voice.',
        VoiceId: voice as any,
        OutputFormat: 'mp3',
        Engine: 'neural',
    });
    
    const response = await pollyClient.send(command);

    if (!response.AudioStream) {
        throw new Error('Amazon Polly did not return audio.');
    }

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
