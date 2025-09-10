
'use server';

import { kv } from '@vercel/kv';
import { del as deleteBlob } from '@vercel/blob';
import { getSession, type SessionPayload } from './session';
import { randomUUID } from 'crypto';
import { s3Client } from '@/ai/flows/speech-generation/amazon';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface QuizAttempt {
    questions: any[]; // Store the questions for review
    answers: Record<number, string>;
    score: number;
    suggestions: string;
    completedAt: string;
}

export interface Document {
  id: string; 
  userId: string;
  fileName: string;
  pdfUrl: string;
  textContent: string; // Add this field to store cleaned text
  audioUrl: string | null;
  zoomLevel: number;
  createdAt: string;
  chatHistory?: ChatMessage[];
  quizAttempt?: QuizAttempt | null;
}

export interface User {
    id: string;
    name: string;
    email: string;
    username: string | null; // Can be null for users who haven't set it yet
    password: string; // This is the hashed password
    isAdmin: boolean;
    createdAt: string;
    setupToken: string | null;
    setupTokenExpiry: string | null;
    // User preferences
    avatarUrl?: string | null;
    defaultVoice?: string | null;
    defaultSpeakingRate?: number | null;
    defaultZoomLevel?: number | null;
}

export interface UserSession extends SessionPayload {
    name: string;
    email: string;
    avatarUrl?: string | null;
    defaultVoice?: string | null;
    defaultSpeakingRate?: number | null;
    defaultZoomLevel?: number | null;
}

export interface Submission {
    id: string;
    type: 'Access Request' | 'General Inquiry';
    name: string;
    email: string;
    message: string;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Replied';
    createdAt: string;
}


export async function getUserSession(): Promise<UserSession | null> {
  const session = await getSession();
  if (session?.userId) {
    const user: User | null = await kv.get(`readify:user:id:${session.userId}`);
    if (user) {
        return {
            ...session,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            defaultVoice: user.defaultVoice,
            defaultSpeakingRate: user.defaultSpeakingRate,
            defaultZoomLevel: user.defaultZoomLevel,
        };
    }
  }
  return null;
}

export async function saveDocument(docData: Partial<Document>): Promise<Document> {
  const session = await getSession();
  if (!session?.userId) {
    throw new Error('Authentication required.');
  }
  const userId = session.userId;
  const prefix = 'readify';

  let docId = docData.id;
  const userDocListKey = `${prefix}:user:${userId}:docs`;

  if (docId) {
    const docKey = `${prefix}:doc:${docId}`;
    const existingDocRaw: Document | null = await kv.get(docKey);
    if (!existingDocRaw) {
        throw new Error('Document not found.');
    }
    
    if (!session.isAdmin && existingDocRaw.userId !== userId) {
      throw new Error('Access denied.');
    }
    const updatedDoc: Document = {
      ...existingDocRaw,
      ...docData,
      id: docId, // Ensure id is set correctly
    };
    await kv.set(docKey, updatedDoc);
    return updatedDoc;

  } else {
    if (!docData.fileName || !docData.pdfUrl || !docData.textContent) {
      throw new Error("fileName, pdfUrl, and textContent are required for new documents.");
    }
    docId = randomUUID();
    const newDoc: Document = {
      id: docId,
      userId,
      fileName: docData.fileName,
      pdfUrl: docData.pdfUrl,
      textContent: docData.textContent,
      audioUrl: docData.audioUrl || null,
      zoomLevel: docData.zoomLevel || 1,
      createdAt: new Date().toISOString(),
      chatHistory: [],
    };
    
    const docKey = `${prefix}:doc:${docId}`;
    const pipeline = kv.pipeline();
    pipeline.set(docKey, newDoc);
    pipeline.lpush(userDocListKey, docId);
    await pipeline.exec();

    return newDoc;
  }
}

export async function getDocuments(): Promise<Document[]> {
  const session = await getSession();
  if (!session?.userId) {
    return [];
  }
  const userId = session.userId;
  const prefix = 'readify';
  const userDocListKey = `${prefix}:user:${userId}:docs`;

  const docIds = await kv.lrange<string[]>(userDocListKey, 0, -1);
  if (docIds.length === 0) {
    return [];
  }

  const validDocIds = docIds.filter(id => id);
  if (validDocIds.length === 0) {
    return [];
  }

  const docKeys = validDocIds.map(id => `${prefix}:doc:${id}`);
  const docs = await kv.mget<Document[]>(...docKeys);

  return docs
    .filter((doc): doc is Document => doc !== null)
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteDocument(docId: string): Promise<{ success: boolean, message?: string }> {
    const session = await getSession();
    if (!session?.userId) {
        throw new Error('Authentication required.');
    }
    const prefix = 'readify';

    try {
        const docKey = `${prefix}:doc:${docId}`;
        const doc: Document | null = await kv.get(docKey);

        if (!doc) {
            return { success: true, message: 'Document already deleted.' };
        }

        if (doc.userId !== session.userId && !session.isAdmin) {
            throw new Error('You do not have permission to delete this document.');
        }
        
        // Delete from Vercel Blob if URL matches
        if (doc.pdfUrl && doc.pdfUrl.includes('public.blob.vercel-storage.com')) {
            await deleteBlob(doc.pdfUrl);
        }

        // Handle deletion from either Vercel Blob or S3 for the audio file
        if (doc.audioUrl) {
            if (doc.audioUrl.includes('public.blob.vercel-storage.com')) {
                await deleteBlob(doc.audioUrl);
            } else if (doc.audioUrl.includes('.s3.')) {
                // This is an S3 URL, so we delete it from the S3 bucket
                try {
                    const url = new URL(doc.audioUrl);
                    const bucket = url.hostname.split('.')[0];
                    const key = url.pathname.substring(1); // remove leading '/'
                    
                    const command = new DeleteObjectCommand({
                        Bucket: bucket,
                        Key: decodeURIComponent(key),
                    });
                    
                    await s3Client.send(command);
                    console.log(`Successfully deleted ${key} from S3 bucket ${bucket}.`);

                } catch (s3Error) {
                    console.error("Failed to delete object from S3, it may have already been removed:", s3Error);
                    // We don't re-throw, as we still want to remove the DB record
                }
            }
        }

        // Delete from KV database
        const pipeline = kv.pipeline();
        pipeline.del(docKey);
        pipeline.lrem(`${prefix}:user:${doc.userId}:docs`, 1, docId);
        await pipeline.exec();
        
        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Failed to delete document:', message);
        return { success: false, message };
    }
}

export async function clearChatHistory(docId: string): Promise<Document> {
    const session = await getSession();
    if (!session?.userId) {
        throw new Error('Authentication required.');
    }
    const prefix = 'readify';
    const docKey = `${prefix}:doc:${docId}`;
    const doc: Document | null = await kv.get(docKey);

    if (!doc) {
        throw new Error('Document not found.');
    }

    if (doc.userId !== session.userId && !session.isAdmin) {
        throw new Error('You do not have permission to modify this document.');
    }

    const updatedDoc: Document = {
        ...doc,
        chatHistory: [],
    };

    await kv.set(docKey, updatedDoc);

    return updatedDoc;
}
