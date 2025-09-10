
import { z } from 'genkit';

export const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: z.string().describe('The identifier for the voice to use for the speech synthesis (e.g., "openai/alloy", "google/en-US-News-M").'),
  speakingRate: z.number().min(0.25).max(4.0).optional().describe('The speaking rate, where 1.0 is the normal speed.'),
  docId: z.string().optional().describe('The document ID, required for asynchronous providers like Amazon Polly.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

export const GenerateSpeechOutputSchema = z.object({
  audioDataUris: z.array(z.string()).optional().describe("An array of data URIs for the generated audio chunks. Each format: 'data:audio/mp3;base64,<encoded_data>'."),
  asyncTaskId: z.string().optional().describe('An identifier for an asynchronous task, used for polling.'),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;


// Schema for previewing a selected voice
export const PreviewSpeechInputSchema = z.object({
    voice: z.string().describe('The voice identifier to preview (e.g., "openai/alloy", "google/en-US-News-M").'),
});
export type PreviewSpeechInput = z.infer<typeof PreviewSpeechInputSchema>;

export const PreviewSpeechOutputSchema = z.object({
    audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/mp3;base64,<encoded_data>'."),
});
export type PreviewSpeechOutput = z.infer<typeof PreviewSpeechOutputSchema>;
