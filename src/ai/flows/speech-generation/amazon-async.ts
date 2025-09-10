
'use server';
/**
 * @fileOverview Handles asynchronous, long-form text-to-speech using Amazon Polly.
 * This flow starts a synthesis task and provides a way to poll for its completion.
 */

import { kv } from '@vercel/kv';
import { pollyClient, amazonVoices, s3Client } from './amazon';
import { StartSpeechSynthesisTaskCommand, GetSpeechSynthesisTaskCommand } from '@aws-sdk/client-polly';
import { saveDocument, Document } from '@/lib/db';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
if (!S3_BUCKET_NAME) {
    console.warn("AWS_S3_BUCKET_NAME is not set. Amazon Polly long-form audio will fail.");
}

export async function startAmazonVoiceGeneration(
  text: string,
  voiceId: string,
  speed: number,
  docId: string
) {
  const voiceConfig = amazonVoices.find(v => v.Id === voiceId);
  if (!voiceConfig) {
    throw new Error(`Amazon voice not found: ${voiceId}`);
  }

  const ssmlText = `<speak><prosody rate="${Math.round(speed * 100)}%">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</prosody></speak>`;

  const command = new StartSpeechSynthesisTaskCommand({
    OutputFormat: 'mp3',
    OutputS3BucketName: S3_BUCKET_NAME,
    Text: ssmlText,
    TextType: 'ssml',
    VoiceId: voiceId,
    Engine: voiceConfig.SupportedEngines?.includes('neural') ? 'neural' : 'standard',
  });

  const response = await pollyClient.send(command);
  const taskId = response.SynthesisTask?.TaskId;

  if (!taskId) {
    throw new Error('Failed to start Amazon Polly synthesis task.');
  }
  
  // Store the task ID associated with the document ID
  await kv.set(`readify:polly-task:${docId}`, taskId, { ex: 3600 }); // Expire in 1 hour

  return { taskId };
}

async function getS3FileUrl(s3Uri: string): Promise<string> {
    const url = new URL(s3Uri);
    const bucket = url.hostname;
    const key = url.pathname.substring(1); // remove leading '/'
   
    // Construct the region-agnostic public URL format
    // https://<bucket-name>.s3.amazonaws.com/<key>
    return `https://${bucket}.s3.amazonaws.com/${key}`;
}


export const checkAmazonVoiceGeneration = ai.defineFlow(
  {
    name: 'checkAmazonVoiceGeneration',
    inputSchema: z.object({ docId: z.string() }),
    outputSchema: z.object({
        status: z.enum(['in_progress', 'completed', 'failed']),
        audioUrl: z.string().optional(),
    }),
  },
  async ({ docId }) => {
    const taskId: string | null = await kv.get(`readify:polly-task:${docId}`);
    if (!taskId) {
      throw new Error('No active Polly task found for this document.');
    }

    const command = new GetSpeechSynthesisTaskCommand({ TaskId: taskId });
    const response = await pollyClient.send(command);
    const task = response.SynthesisTask;
    
    const status = task?.TaskStatus;

    if (status === 'completed' && task?.OutputUri) {
        const finalUrl = await getS3FileUrl(task.OutputUri);
        
        await saveDocument({ id: docId, audioUrl: finalUrl });
        await kv.del(`readify:polly-task:${docId}`); // Clean up
        
        return { status: 'completed', audioUrl: finalUrl };

    } else if (status === 'inProgress' || status === 'scheduled') {
        return { status: 'in_progress' };
    } else {
        console.error('Amazon Polly task failed:', task?.TaskStatusReason);
        await kv.del(`readify:polly-task:${docId}`); // Clean up
        return { status: 'failed' };
    }
  }
);
