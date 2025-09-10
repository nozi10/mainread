
'use server';

import OpenAI from 'openai';

// Function to split text into chunks without breaking sentences
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

        // Prioritize splitting at sentence-ending punctuation.
        const sentenceEnders = ['.', '?', '!', '\n'];
        for (const p of sentenceEnders) {
            const pos = chunk.lastIndexOf(p);
            // Ensure the punctuation is not part of a larger structure like "e.g."
            if (pos > -1 && (remainingText[pos + 1] === ' ' || remainingText[pos + 1] === '\n' || pos === chunk.length - 1)) {
                lastSentenceEnd = Math.max(lastSentenceEnd, pos);
            }
        }

        // If a sentence end is found, split there. Otherwise, split at the last space to avoid breaking words.
        let splitIndex;
        if (lastSentenceEnd !== -1) {
            splitIndex = lastSentenceEnd + 1;
        } else {
            const lastSpace = chunk.lastIndexOf(' ');
            splitIndex = lastSpace !== -1 ? lastSpace : maxLength; // Fallback to hard split if no space
        }
        
        chunk = remainingText.substring(0, splitIndex);
        chunks.push(chunk);
        remainingText = remainingText.substring(chunk.length);
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
}


export async function generateLemonfoxVoice(formattedText: string, voice: string, speed: number) {
    if (!process.env.LEMONFOX_API_KEY) {
        throw new Error('Lemonfox API key is not configured in environment variables.');
    }

    const lemonfox = new OpenAI({
        apiKey: process.env.LEMONFOX_API_KEY,
        baseURL: "https://api.lemonfox.ai/v1",
    });

    // Lemonfox API may have its own character limit, chunking is a safe approach.
    const textChunks = splitText(formattedText, 4000); 
    console.log(`Generated ${textChunks.length} text chunks for Lemonfox.`);

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
