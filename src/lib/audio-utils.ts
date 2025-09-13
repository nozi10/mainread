
'use server';

export async function mergeAudio(audioDataUris: string[]): Promise<Blob> {
    const audioBuffers = await Promise.all(
        audioDataUris.map(async (uri) => {
            const response = await fetch(uri);
            return response.arrayBuffer();
        })
    );
    // This simple concatenation works for MP3 files if they have the same encoding parameters.
    // For a more robust solution, a server-side library like ffmpeg would be needed to
    // properly merge MP3s with different headers, but this is a good starting point.
    const totalLength = audioBuffers.reduce((acc, buffer) => acc + buffer.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    audioBuffers.forEach((buffer) => {
        merged.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
    });

    const firstUri = audioDataUris[0] || '';
    const mimeType = firstUri.substring(firstUri.indexOf(':') + 1, firstUri.indexOf(';')) || 'audio/mp3';

    return new Blob([merged], { type: mimeType });
}
