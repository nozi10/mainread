
'use server';
/**
 * @fileOverview Handles synchronous, short-form text-to-speech using Amazon Polly.
 * This is used for on-the-fly audio generation (e.g., chat responses) that
 * does not need to be saved to S3.
 */

import { pollyClient, amazonVoices } from './amazon';
import { SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';

// Function to split text into chunks without breaking sentences.
// Polly's SynthesizeSpeech has a 3000 character limit for plain text. We'll use 2800 to be safe.
function splitText(text: string, maxLength: number = 2800): string[] {
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
        remainingText = remainingText.substring(chunk.length);
    }
    return chunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * Generates speech synchronously using Amazon Polly and returns an array of data URIs.
 */
export async function generateAmazonVoiceSync(
  text: string,
  voiceId: string,
  speed: number
): Promise<string[]> {
  const voiceConfig = amazonVoices.find(v => v.Id === voiceId);
  if (!voiceConfig) throw new Error(`Amazon voice not found: ${voiceId}`);

  // Sanitize and wrap text in SSML for speed control
  const sanitizedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const ssmlText = `<speak><prosody rate="${Math.round(speed * 100)}%">${sanitizedText}</prosody></speak>`;
  
  // SynthesizeSpeech has character limits, so we chunk the input.
  const textChunks = splitText(ssmlText);

  const audioGenerationPromises = textChunks.map(async (chunk) => {
    const command = new SynthesizeSpeechCommand({
      OutputFormat: 'mp3',
      Text: chunk,
      TextType: 'ssml',
      VoiceId: voiceId as VoiceId,
      Engine: voiceConfig.SupportedEngines?.includes('neural') ? 'neural' : 'standard',
    });

    const response = await pollyClient.send(command);
    if (!response.AudioStream) {
      throw new Error('No audio stream returned from Amazon Polly.');
    }

    const audioBytes = await response.AudioStream.transformToByteArray();
    return `data:audio/mp3;base64,${Buffer.from(audioBytes).toString('base64')}`;
  });

  return Promise.all(audioGenerationPromises);
}
