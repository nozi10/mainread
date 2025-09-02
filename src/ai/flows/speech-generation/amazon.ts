
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

// Helper to convert stream to Base64 string
async function streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    });
}

// Helper to parse speech mark JSON lines
function parseSpeechMarks(jsonLines: string): SpeechMark[] {
    if (!jsonLines) return [];
    const lines = jsonLines.trim().split('\n');
    return lines.map(line => {
        const mark = JSON.parse(line);
        // Ensure the type is one of the expected values
        if (mark.type === 'sentence' || mark.type === 'word') {
            return {
                time: mark.time,
                type: mark.type,
                start: mark.start,
                end: mark.end,
                value: mark.value,
            };
        }
        return null;
    }).filter((m): m is SpeechMark => m !== null);
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

    const audioCommand = new SynthesizeSpeechCommand({
        Text: formattedText,
        VoiceId: voice as any,
        OutputFormat: 'mp3',
        Engine: 'neural',
    });
    
    const speechMarksCommand = new SynthesizeSpeechCommand({
        Text: formattedText,
        VoiceId: voice as any,
        OutputFormat: 'json',
        SpeechMarkTypes: [SpeechMarkType.SENTENCE, SpeechMarkType.WORD],
        Engine: 'neural',
    });
    
    try {
        const [audioResponse, speechMarksResponse] = await Promise.all([
            pollyClient.send(audioCommand),
            pollyClient.send(speechMarksCommand)
        ]);

        if (!audioResponse.AudioStream) {
            throw new Error('Amazon Polly did not return audio.');
        }

        const audioBase64 = await streamToString(audioResponse.AudioStream as Readable);
        const audioDataUri = `data:audio/mp3;base64,${audioBase64}`;
        
        let speechMarks: SpeechMark[] = [];
        if (speechMarksResponse.AudioStream) {
            const speechMarksJson = await streamToString(speechMarksResponse.AudioStream as Readable);
            speechMarks = parseSpeechMarks(speechMarksJson);
        }

        return { 
            audioDataUris: [audioDataUri], // Return as an array with a single item for consistency
            speechMarks 
        };

    } catch (error) {
        console.error("Error with AWS Polly SDK:", error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred with Polly.';
        throw new Error(`Polly SDK Error: ${message}`);
    }
}
