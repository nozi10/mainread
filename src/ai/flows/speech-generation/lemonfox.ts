'use server';

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
    const apiKey = process.env.LEMONFOX_API_KEY;
    if (!apiKey) {
        throw new Error('Lemonfox API key is not configured. Please set the LEMONFOX_API_KEY environment variable.');
    }

    // Using a safe character limit, similar to other providers.
    const textChunks = splitText(formattedText, 4000);
    console.log(`Generated ${textChunks.length} text chunks for Lemonfox.`);

    const audioGenerationPromises = textChunks.map(async (chunk) => {
        const response = await fetch("https://api.lemonfox.ai/v1/audio/speech", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                input: chunk,
                voice: voice,
                speed: speed,
                response_format: "mp3"
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Lemonfox API request failed with status ${response.status}: ${errorBody}`);
        }
        
        const audioBuffer = await response.arrayBuffer();
        return `data:audio/mp3;base64,${Buffer.from(audioBuffer).toString('base64')}`;
    });

    return Promise.all(audioGenerationPromises);
}