
import { z } from 'genkit';

export const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: z.string().describe('The identifier for the voice to use for the speech synthesis (e.g., "openai/alloy", "google/en-US-News-M").'),
  speakingRate: z.number().min(0.25).max(4.0).optional().describe('The speaking rate, where 1.0 is the normal speed.'),
  docId: z.string().optional().describe('The document ID, required for asynchronous providers like Amazon Polly.'),
  fileName: z.string().optional().describe('The original file name, used by providers like Amazon Polly to name the output file.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

export const GenerateSpeechOutputSchema = z.object({
  audioDataUris: z.array(z.string()).optional().describe("An array of data URIs for the generated audio chunks. Each format: 'data:audio/mp3;base64,<encoded_data>'."),
  audioUrl: z.string().optional().describe("A single, final URL for audio stored in a cloud bucket (e.g., S3)."),
  pollyTaskId: z.string().optional().describe("The task ID for an asynchronous Amazon Polly generation task."),
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
