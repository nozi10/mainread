
'use server';
/**
 * @fileOverview Handles asynchronous text-to-speech using Amazon Polly's
 * StartSpeechSynthesisTask, which is designed for long-form audio.
 * It now supports generating both the MP3 audio and the corresponding speech marks JSON file.
 */

import { pollyClient } from './amazon';
import { StartSpeechSynthesisTaskCommand, GetSpeechSynthesisTaskCommand, SpeechMarkType, VoiceId } from '@aws-sdk/client-polly';

const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
if (!S3_BUCKET_NAME) {
    console.warn("AWS_S3_BUCKET_NAME is not set. Amazon Polly audio generation will fail.");
}

type StartGenerationResponse = {
    audioTaskId: string;
    marksTaskId: string;
};

/**
 * Starts an asynchronous speech synthesis task with Amazon Polly for both audio and speech marks.
 */
export async function startAmazonVoiceGeneration(
  text: string, // Expects raw text for accurate speech marks
  voiceId: string,
  speed: number,
  docId: string,
  fileName?: string
): Promise<StartGenerationResponse> {
  const sanitizedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  const ssmlText = `<speak><prosody rate="${Math.round(speed * 100)}%">${sanitizedText}</prosody></speak>`;

  const baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : docId;
  const sanitizedBaseName = baseName.replace(/\s+/g, '_').replace(/[^0-9a-zA-Z!_.\-]/g, '');
  
  // Task for MP3 audio generation
  const audioCommand = new StartSpeechSynthesisTaskCommand({
    OutputFormat: 'mp3',
    OutputS3BucketName: S3_BUCKET_NAME,
    OutputS3KeyPrefix: `${sanitizedBaseName}.mp3`,
    Text: ssmlText,
    TextType: 'ssml',
    VoiceId: voiceId as VoiceId,
    Engine: 'neural',
  });

  // Task for JSON speech marks generation
  const marksCommand = new StartSpeechSynthesisTaskCommand({
      OutputFormat: 'json',
      OutputS3BucketName: S3_BUCKET_NAME,
      OutputS3KeyPrefix: `${sanitizedBaseName}.json`,
      SpeechMarkTypes: [SpeechMarkType.WORD, SpeechMarkType.SENTENCE],
      Text: ssmlText,
      TextType: 'ssml',
      VoiceId: voiceId as VoiceId,
      Engine: 'neural',
  });

  const [audioResponse, marksResponse] = await Promise.all([
      pollyClient.send(audioCommand),
      pollyClient.send(marksCommand)
  ]);
  
  const audioTaskId = audioResponse.SynthesisTask?.TaskId;
  const marksTaskId = marksResponse.SynthesisTask?.TaskId;

  if (!audioTaskId || !marksTaskId) {
    throw new Error('Failed to start one or both Amazon Polly synthesis tasks.');
  }
  
  return { audioTaskId, marksTaskId };
}

type CheckTaskResponse = {
    status: 'completed' | 'inProgress' | 'failed';
    outputUrl?: string | null;
};

/**
 * Checks the status of a single speech synthesis task.
 */
export async function checkAmazonVoiceGeneration(
    taskId: string
): Promise<CheckTaskResponse> {
    
    const command = new GetSpeechSynthesisTaskCommand({ TaskId: taskId });
    const response = await pollyClient.send(command);
    const task = response.SynthesisTask;

    switch (task?.TaskStatus) {
        case 'completed':
            return { status: 'completed', outputUrl: task.OutputUri };
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
