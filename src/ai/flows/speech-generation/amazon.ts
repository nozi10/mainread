
'use server';
import { PollyClient, SynthesizeSpeechCommand, SpeechMarkType } from '@aws-sdk/client-polly';
import { Readable } from 'stream';

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


// Helper to convert stream to Buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
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
    
    const audioBuffer = await streamToBuffer(audioResponse.AudioStream as Readable);
    const audioDataUri = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;
    
    const speechMarksJson = await streamToBuffer(speechMarksResponse.AudioStream as Readable).then(b => b.toString('utf8'));
    const speechMarks = parseSpeechMarks(speechMarksJson);

    // This is an estimation. A more accurate method would be to use a library to parse the mp3 duration.
    // Average reading speed is ~15 characters per second. 1000ms/15char = ~67ms per character.
    const estimatedDuration = textChunk.length * 60; // A rough but workable approximation.
    
    return { audioDataUri, speechMarks, duration: estimatedDuration };
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

    const chunkPromises = textChunks.map(chunk => synthesizeChunk(pollyClient, chunk, voice));
    const chunkResults = await Promise.all(chunkPromises);

    for(const result of chunkResults) {
        allAudioDataUris.push(result.audioDataUri);
        
        const adjustedMarks = result.speechMarks.map(mark => ({
            ...mark,
            time: mark.time + cumulativeDuration,
            start: mark.start + characterOffset,
            end: mark.end + characterOffset
        }));
        allSpeechMarks.push(...adjustedMarks);

        cumulativeDuration += result.duration;
        // Find the original chunk text based on the audio URI to get accurate length for offset
        const correspondingChunk = textChunks[allAudioDataUris.length - 1];
        characterOffset += correspondingChunk.length;
    }


    return { 
        audioDataUris: allAudioDataUris,
        speechMarks: allSpeechMarks
    };
}
