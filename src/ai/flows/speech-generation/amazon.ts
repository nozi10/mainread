
'use server';
import { PollyClient, SynthesizeSpeechCommand, SpeechMarkType } from '@aws-sdk/client-polly';
import { Readable } from 'stream';
import getAudioDuration from 'get-audio-duration';

export type SpeechMark = {
    time: number;
    type: 'sentence' | 'word';
    start: number;
    end: number;
    value: string;
};

export type AmazonVoiceOutput = {
    audioDataUris: string[];
    speechMarks: SpeechMark[];
}

// Function to split text into Polly-friendly chunks (max 3000 chars)
function splitTextIntoChunks(text: string, maxLength = 2800): string[] {
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


// Helper to convert stream to Base64 string
async function streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    });
}

// Helper to convert stream to Buffer for duration calculation
async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}


// Helper to parse speech mark JSON lines
function parseSpeechMarks(jsonLines: string): SpeechMark[] {
    if (!jsonLines) return [];
    const lines = jsonLines.trim().split('\n');
    return lines.map(line => {
        try {
            const mark = JSON.parse(line);
            if (mark.type === 'sentence' || mark.type === 'word') {
                return {
                    time: mark.time,
                    type: mark.type,
                    start: mark.start,
                    end: mark.end,
                    value: mark.value,
                };
            }
        } catch (e) {
            // Ignore lines that are not valid JSON
        }
        return null;
    }).filter((m): m is SpeechMark => m !== null);
}

async function synthesizeChunk(pollyClient: PollyClient, textChunk: string, voice: string) {
    const audioCommand = new SynthesizeSpeechCommand({
        Text: textChunk,
        VoiceId: voice as any,
        OutputFormat: 'mp3',
        Engine: 'neural',
    });
    
    const speechMarksCommand = new SynthesizeSpeechCommand({
        Text: textChunk,
        VoiceId: voice as any,
        OutputFormat: 'json',
        SpeechMarkTypes: [SpeechMarkType.SENTENCE, SpeechMarkType.WORD],
        Engine: 'neural',
    });

    const [audioResponse, speechMarksResponse] = await Promise.all([
        pollyClient.send(audioCommand),
        pollyClient.send(speechMarksCommand)
    ]);

    if (!audioResponse.AudioStream || !speechMarksResponse.AudioStream) {
        throw new Error('Amazon Polly did not return required streams.');
    }
    
    const audioStreamReadable = audioResponse.AudioStream as Readable;
    const speechMarksStreamReadable = speechMarksResponse.AudioStream as Readable;

    // We need to clone the audio stream because it can only be consumed once.
    // One clone goes to get the duration, the other to be converted to a data URI.
    const audioBuffer = await streamToBuffer(audioStreamReadable);
    const audioDataUri = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;

    const duration = (await getAudioDuration(audioBuffer)) * 1000; // get duration in milliseconds
    
    const speechMarksJson = await streamToString(speechMarksStreamReadable);
    const speechMarks = parseSpeechMarks(speechMarksJson);

    return { audioDataUri, speechMarks, duration };
}


export async function generateAmazonVoice(formattedText: string, voice: string): Promise<AmazonVoiceOutput> {
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

    const textChunks = splitTextIntoChunks(formattedText);
    
    const allAudioDataUris: string[] = [];
    const allSpeechMarks: SpeechMark[] = [];
    let cumulativeDuration = 0;
    let characterOffset = 0;

    try {
        for (const chunk of textChunks) {
            const { audioDataUri, speechMarks, duration } = await synthesizeChunk(pollyClient, chunk, voice);
            
            allAudioDataUris.push(audioDataUri);
            
            const adjustedMarks = speechMarks.map(mark => ({
                ...mark,
                time: mark.time + cumulativeDuration, // Offset time by duration of previous chunks
                start: mark.start + characterOffset, // Offset character position
                end: mark.end + characterOffset
            }));
            allSpeechMarks.push(...adjustedMarks);
            
            cumulativeDuration += duration;
            characterOffset += chunk.length;
        }

        return { 
            audioDataUris: allAudioDataUris,
            speechMarks: allSpeechMarks
        };

    } catch (error) {
        console.error("Error with AWS Polly SDK:", error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred with Polly.';
        throw new Error(`Polly SDK Error: ${message}`);
    }
}
