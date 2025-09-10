
'use server';
/**
 * @fileOverview Handles asynchronous text-to-speech using Amazon Polly's
 * StartSpeechSynthesisTask, which is designed for long-form audio.
 */

import { pollyClient } from './amazon';
import { StartSpeechSynthesisTaskCommand, GetSpeechSynthesisTaskCommand } from '@aws-sdk/client-polly';

const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
if (!S3_BUCKET_NAME) {
    console.warn("AWS_S3_BUCKET_NAME is not set. Amazon Polly audio generation will fail.");
}

type StartGenerationResponse = {
    taskId: string;
};

/**
 * Starts an asynchronous speech synthesis task with Amazon Polly.
 * This is suitable for long documents.
 */
export async function startAmazonVoiceGeneration(
  text: string,
  voiceId: string,
  speed: number,
  docId: string
): Promise<StartGenerationResponse> {
  // Replace characters that can break SSML
  const sanitizedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  const ssmlText = `<speak><prosody rate="${Math.round(speed * 100)}%">${sanitizedText}</prosody></speak>`;
  
  const command = new StartSpeechSynthesisTaskCommand({
    OutputFormat: 'mp3',
    OutputS3BucketName: S3_BUCKET_NAME,
    Text: ssmlText,
    TextType: 'ssml',
    VoiceId: voiceId,
    Engine: 'neural',
  });

  const response = await pollyClient.send(command);
  const taskId = response.SynthesisTask?.TaskId;

  if (!taskId) {
    throw new Error('Failed to start Amazon Polly synthesis task.');
  }
  
  return { taskId };
}

type CheckGenerationResponse = {
    status: 'completed' | 'inProgress' | 'failed';
    audioUrl?: string | null;
};

/**
 * Checks the status of a speech synthesis task.
 */
export async function checkAmazonVoiceGeneration(
    taskId: string
): Promise<CheckGenerationResponse> {
    
    const command = new GetSpeechSynthesisTaskCommand({ TaskId: taskId });
    const response = await pollyClient.send(command);
    const task = response.SynthesisTask;

    switch (task?.TaskStatus) {
        case 'completed':
            return { status: 'completed', audioUrl: task.OutputUri };
        case 'inProgress':
        case 'scheduled':
            return { status: 'inProgress' };
        case 'failed':
            console.error('Amazon Polly task failed:', task.TaskStatusReason);
            throw new Error(`Speech synthesis failed: ${task.TaskStatusReason}`);
        default:
            return { status: 'inProgress' }; // Assume it's still processing
    }
}
