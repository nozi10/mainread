
'use server';

import OpenAI from 'openai';

const LEMONFOX_CHARACTER_LIMIT = 5000;

// Function to split text into chunks without breaking sentences
function splitText(text: string): string[] {
    const chunks: string[] = [];
    let remainingText = text;

    while (remainingText.length > 0) {
        if (remainingText.length <= LEMONFOX_CHARACTER_LIMIT) {
            chunks.push(remainingText);
            break;
        }

        let chunk = remainingText.substring(0, LEMONFOX_CHARACTER_LIMIT);
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
            splitIndex = lastSpace !== -1 ? lastSpace : LEMONFOX_CHARACTER_LIMIT;
        }
        
        chunk = remainingText.substring(0, splitIndex);
        chunks.push(chunk);
        remainingText = remainingText.substring(chunk.length);
    }
    return chunks.filter(chunk => chunk.trim().length > 0);
}

function getLemonfoxClient() {
    if (!process.env.LEMONFOX_API_KEY) {
        throw new Error('Lemonfox API key is not configured in environment variables.');
    }
    return new OpenAI({
        apiKey: process.env.LEMONFOX_API_KEY,
        baseURL: "https://api.lemonfox.ai/v1",
    });
}

function transformTimestampsToSpeechMarks(timestamps: any[]): any[] {
    const speechMarks: any[] = [];
    let characterOffset = 0;

    timestamps.forEach(item => {
        const { text, start, end } = item;
        
        // Lemonfox provides sentence and word timestamps. We'll format them consistently.
        // For simplicity, we'll treat every timestamped item as a "word" for highlighting.
        speechMarks.push({
            time: start * 1000, // convert to ms
            type: 'word',
            start: characterOffset,
            end: characterOffset + text.length,
            value: text,
        });

        characterOffset += text.length;

        // Add a space after each word for the next offset calculation
        if (![',', '.', '?', '!'].includes(text)) {
            characterOffset += 1;
        }
    });

    return speechMarks;
}


/**
 * Generates speech with timestamps from Lemonfox, saves them to cloud storage,
 * and returns the public URLs.
 */
export async function generateLemonfoxVoiceWithTimestamps(
    rawText: string, 
    voice: string, 
    speed: number,
    docId: string,
    fileName?: string
) {
    const lemonfox = getLemonfoxClient();
    const textChunks = splitText(rawText);
    
    let combinedAudioBuffer = new ArrayBuffer(0);
    let combinedSpeechMarks: any[] = [];
    let timeOffset = 0;

    for (const chunk of textChunks) {
        const response = await lemonfox.audio.speech.create({
            input: chunk,
            voice: voice,
            response_format: "json",
            model: "tts-1",
            speed: speed,
            word_timestamps: true,
        });
        
        const audioBuffer = Buffer.from(response.audio, 'base64');
        const newCombined = new Uint8Array(combinedAudioBuffer.byteLength + audioBuffer.length);
        newCombined.set(new Uint8Array(combinedAudioBuffer), 0);
        newCombined.set(audioBuffer, combinedAudioBuffer.byteLength);
        combinedAudioBuffer = newCombined.buffer;
        
        const durationSeconds = combinedAudioBuffer.byteLength / 24000 / 2;

        if (response.word_timestamps) {
            const adjustedMarks = response.word_timestamps.map((mark: any) => ({
                ...mark,
                start: mark.start + timeOffset,
                end: mark.end + timeOffset,
            }));
            combinedSpeechMarks.push(...adjustedMarks);
        }
        timeOffset = durationSeconds;
    }
    
    // Transform timestamps
    const formattedSpeechMarks = transformTimestampsToSpeechMarks(combinedSpeechMarks);
    
    // Upload audio and speech marks to Vercel Blob
    const baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : docId;
    const sanitizedBaseName = baseName.replace(/\s+/g, '_').replace(/[^0-9a-zA-Z!_.\-]/g, '');

    const audioFileName = `${sanitizedBaseName}.mp3`;
    const speechMarksFileName = `${sanitizedBaseName}.json`;

    const [audioBlobResult, speechMarksBlobResult] = await Promise.all([
        fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'audio/mp3', 'x-vercel-filename': audioFileName, 'x-doc-id': docId },
            body: Buffer.from(combinedAudioBuffer),
        }).then(res => res.json()),
        fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-vercel-filename': speechMarksFileName, 'x-doc-id': docId },
            body: formattedSpeechMarks.map(mark => JSON.stringify(mark)).join('\n'),
        }).then(res => res.json())
    ]);

    if (!audioBlobResult.url || !speechMarksBlobResult.url) {
        throw new Error('Failed to upload one or more files to storage.');
    }

    return {
        uploadedAudioUrl: audioBlobResult.url,
        uploadedSpeechMarksUrl: speechMarksBlobResult.url,
    };
}


/**
 * Generates speech synchronously using Lemonfox and returns an array of data URIs.
 * Used for short-form, on-the-fly generation (e.g., chat).
 */
export async function generateLemonfoxVoiceSync(formattedText: string, voice: string, speed: number) {
    const lemonfox = getLemonfoxClient();
    const textChunks = splitText(formattedText); 

    const audioGenerationPromises = textChunks.map(async (chunk) => {
        const audio = await lemonfox.audio.speech.create({
            input: chunk,
            voice: voice,
            response_format: "mp3",
            model: "tts-1",
            speed: speed,
        });
        
        const audioBuffer = await audio.arrayBuffer();
        return `data:audio/mp3;base64,${Buffer.from(audioBuffer).toString('base64')}`;
    });
    return Promise.all(audioGenerationPromises);
}
