
'use server';
/**
 * @fileOverview Handles text-to-speech using Amazon Polly and direct S3 upload.
 */

import { pollyClient, s3Client } from './amazon';
import { SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
if (!S3_BUCKET_NAME) {
    console.warn("AWS_S3_BUCKET_NAME is not set. Amazon Polly audio will fail.");
}

export async function generateAmazonVoice(
  text: string,
  voiceId: string,
  speed: number,
  docId: string,
  fileName: string
): Promise<string> {
  
  // Generate SSML for speed control
  const ssmlText = `<speak><prosody rate="${Math.round(speed * 100)}%">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</prosody></speak>`;

  // 1. Synthesize Speech with Polly
  const synthesizeCommand = new SynthesizeSpeechCommand({
    OutputFormat: 'mp3',
    Text: ssmlText,
    TextType: 'ssml',
    VoiceId: voiceId,
    Engine: 'neural',
  });

  const { AudioStream } = await pollyClient.send(synthesizeCommand);

  if (!AudioStream) {
    throw new Error('Failed to get audio stream from Amazon Polly.');
  }

  // 2. Upload the audio stream directly to S3
  const audioBytes = await AudioStream.transformToByteArray();
  const s3Key = `readify-audio/${docId}-${fileName.replace(/\.pdf$/i, '.mp3')}`;

  const uploadCommand = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    Body: audioBytes,
    ContentType: 'audio/mpeg',
    ACL: 'public-read', // Make the file publicly accessible
  });

  await s3Client.send(uploadCommand);

  // 3. Construct and return the public URL
  const region = process.env.AWS_REGION || 'us-east-1';
  const audioUrl = `https://${S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${s3Key}`;

  return audioUrl;
}
