
'use server';
/**
 * @fileOverview Handles text-to-speech using Amazon Polly and direct S3 upload.
 * This version handles long text by splitting it, synthesizing chunks in parallel,
 * merging them, and then uploading a single file to S3.
 */

import { pollyClient, s3Client } from './amazon';
import { SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
if (!S3_BUCKET_NAME) {
    console.warn("AWS_S3_BUCKET_NAME is not set. Amazon Polly audio will fail.");
}

// Function to split text into chunks without breaking sentences, respecting SSML limits.
function splitText(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remainingText = text;

    while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
            chunks.push(remainingText);
            break;
        }

        let chunk = remainingText.substring(0, maxLength);
        let lastSentenceEnd = -1;

        const sentenceEnders = ['.', '?', '!', '\n'];
        for (const p of sentenceEnders) {
            const pos = chunk.lastIndexOf(p);
            if (pos > -1 && (remainingText[pos + 1] === ' ' || remainingText[pos + 1] === '\n' || pos === chunk.length - 1)) {
                lastSentenceEnd = Math.max(lastSentenceEnd, pos);
            }
        }

        let splitIndex;
        if (lastSentenceEnd !== -1) {
            splitIndex = lastSentenceEnd + 1;
        } else {
            const lastSpace = chunk.lastIndexOf(' ');
            splitIndex = lastSpace !== -1 ? lastSpace : maxLength;
        }
        
        chunk = remainingText.substring(0, splitIndex);
        chunks.push(chunk);
        remainingText = remainingText.substring(chunk.length).trim();
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
}

async function mergeAudioBuffers(buffers: Buffer[]): Promise<Buffer> {
    return Buffer.concat(buffers);
}

export async function generateAmazonVoice(
  text: string,
  voiceId: string,
  speed: number,
  docId: string,
  fileName: string
): Promise<string> {
  
  // Amazon Polly's SynthesizeSpeech has a limit of 3000 characters for SSML.
  // We chunk the text to handle documents of any length.
  const textChunks = splitText(text, 2800);
  console.log(`Split text into ${textChunks.length} chunks for Amazon Polly.`);

  // 1. Synthesize Speech for each chunk in parallel
  const audioBufferPromises = textChunks.map(async (chunk) => {
    const ssmlText = `<speak><prosody rate="${Math.round(speed * 100)}%">${chunk.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</prosody></speak>`;
    
    const synthesizeCommand = new SynthesizeSpeechCommand({
        OutputFormat: 'mp3',
        Text: ssmlText,
        TextType: 'ssml',
        VoiceId: voiceId,
        Engine: 'neural',
    });

    const { AudioStream } = await pollyClient.send(synthesizeCommand);
    if (!AudioStream) {
        throw new Error('Failed to get audio stream from Amazon Polly for a chunk.');
    }
    const audioBytes = await AudioStream.transformToByteArray();
    return Buffer.from(audioBytes);
  });

  const audioBuffers = await Promise.all(audioBufferPromises);

  // 2. Merge the audio buffers into a single MP3 file
  const mergedAudioBuffer = await mergeAudioBuffers(audioBuffers);

  // 3. Upload the final merged audio stream to S3
  const s3Key = `readify-audio/${docId}-${fileName.replace(/\.pdf$/i, '.mp3')}`;

  const uploadCommand = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    Body: mergedAudioBuffer,
    ContentType: 'audio/mpeg',
    ACL: 'public-read', // Make the file publicly accessible
  });

  await s3Client.send(uploadCommand);

  // 4. Construct and return the public URL
  const region = process.env.AWS_REGION || 'us-east-1';
  const audioUrl = `https://${S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${s3Key}`;

  console.log(`Successfully generated and uploaded merged audio to ${audioUrl}`);
  return audioUrl;
}
