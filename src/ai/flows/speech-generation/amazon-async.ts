
'use server';

import { PollyClient, StartSpeechSynthesisTaskCommand, GetSpeechSynthesisTaskCommand, SpeechMarkType } from '@aws-sdk/client-polly';
import { saveDocument } from '@/lib/db';
import { parseSpeechMarks } from './amazon';
import { put as putBlob } from '@vercel/blob';

// Ensure required environment variables are set
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.AWS_S3_BUCKET_NAME) {
    console.warn('One or more AWS environment variables are missing (KEY_ID, SECRET_KEY, REGION, S3_BUCKET_NAME). Amazon Polly async synthesis will fail.');
}

const pollyClient = new PollyClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export async function startAmazonVoiceGeneration(
    { docId, text, voice }: { docId: string; text: string; voice: string }
): Promise<{ success: boolean; message?: string; taskId?: string }> {
    try {
        const command = new StartSpeechSynthesisTaskCommand({
            Text: text,
            VoiceId: voice as any,
            OutputFormat: 'mp3',
            OutputS3BucketName: process.env.AWS_S3_BUCKET_NAME,
            Engine: 'neural',
            SpeechMarkTypes: [SpeechMarkType.SENTENCE, SpeechMarkType.WORD],
        });

        const response = await pollyClient.send(command);
        const taskId = response.SynthesisTask?.TaskId;

        if (!taskId) {
            throw new Error("Polly did not return a Task ID.");
        }

        // Save the task ID to the document to track its progress
        await saveDocument({ id: docId, audioGenerationTaskId: taskId });
        
        return { success: true, taskId };
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to start Polly synthesis task:", message);
        return { success: false, message };
    }
}

export async function checkAmazonVoiceGeneration(
    { docId, taskId }: { docId: string; taskId: string }
): Promise<{ status: 'inProgress' | 'completed' | 'failed'; message?: string }> {
    try {
        const command = new GetSpeechSynthesisTaskCommand({ TaskId: taskId });
        const response = await pollyClient.send(command);
        const taskStatus = response.SynthesisTask?.TaskStatus;

        if (taskStatus === 'completed') {
            const s3Uri = response.SynthesisTask.OutputUri;
            const s3SpeechMarksUri = response.SynthesisTask.SpeechMarkUrl;
            if (!s3Uri || !s3SpeechMarksUri) {
                throw new Error("Task completed but S3 URI is missing.");
            }
            
            // Save the temporary S3 URL so the user can start listening
            await saveDocument({ id: docId, audioUrl: s3Uri });

            // Trigger the background copy without waiting for it to finish
            copyS3ToVercelBlob({ docId, s3AudioUrl: s3Uri, s3SpeechMarksUrl: s3SpeechMarksUri }).catch(err => {
                console.error(`[Background Copy Failed for doc ${docId}]:`, err);
            });

            return { status: 'completed' };
        } else if (taskStatus === 'failed') {
            await saveDocument({ id: docId, audioGenerationTaskId: null });
            return { status: 'failed', message: response.SynthesisTask?.TaskStatusReason || "Task failed for an unknown reason." };
        } else {
            return { status: 'inProgress' };
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to check Polly task status:", message);
        await saveDocument({ id: docId, audioGenerationTaskId: null });
        return { status: 'failed', message };
    }
}


// This function runs in the background
async function copyS3ToVercelBlob({ docId, s3AudioUrl, s3SpeechMarksUrl }: { docId: string; s3AudioUrl: string; s3SpeechMarksUrl: string }) {
    console.log(`Starting background copy for doc: ${docId}`);
    try {
        // 1. Download audio and speech marks from S3
        const [audioResponse, speechMarksResponse] = await Promise.all([
            fetch(s3AudioUrl),
            fetch(s3SpeechMarksUrl),
        ]);

        if (!audioResponse.ok) throw new Error(`Failed to fetch audio from S3: ${audioResponse.statusText}`);
        if (!speechMarksResponse.ok) throw new Error(`Failed to fetch speech marks from S3: ${speechMarksResponse.statusText}`);

        const audioBlob = await audioResponse.blob();
        const speechMarksJson = await speechMarksResponse.text();
        const speechMarks = parseSpeechMarks(speechMarksJson);
        
        // 2. Upload audio to Vercel Blob
        const blobResult = await putBlob(`${docId}-audio.mp3`, audioBlob, { access: 'public' });
        
        // 3. Update the document with the permanent Vercel Blob URL
        await saveDocument({
            id: docId,
            audioUrl: blobResult.url,
            speechMarks: speechMarks,
            audioGenerationTaskId: null, // Clear the task ID as the process is complete
        });
        
        console.log(`Background copy successful for doc: ${docId}. New URL: ${blobResult.url}`);
    } catch (error) {
        console.error(`Error in copyS3ToVercelBlob for doc ${docId}:`, error);
        // Optionally, update the document to indicate the copy failed
        await saveDocument({ id: docId, audioGenerationTaskId: null }); // Clear task ID to stop polling
    }
}
