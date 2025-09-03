
'use server';

import { kv } from '@vercel/kv';
import { getSession } from './session';
import type { User as DbUser, Document as DbDocument, Submission } from './db';
import { randomUUID } from 'crypto';
import { deleteDocument as dbDeleteDocument } from './db';
import { sendWelcomeEmail, sendAdminReplyEmail } from './email';

export interface Document extends DbDocument {}
export interface AdminSubmission extends Submission {}

export interface DocumentWithAuthorEmail extends Document {
    ownerEmail: string;
}

// Re-export User type from db to ensure consistency
export type User = DbUser;

export interface AdminDashboardStats {
    totalUsers: number;
    totalDocuments: number;
    newUsersLast30Days: number;
    docsUploadedLast30Days: number;
    userSignupsByWeek: { week: string; signups: number }[];
    topUsersByDocs: { id: string; email: string; docCount: number }[];
}


async function checkAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) {
    throw new Error('Unauthorized: Admin access required.');
  }
  return session;
}

export async function getAllUsers(): Promise<User[]> {
  await checkAdmin();
  const userKeys = await kv.keys('readify:user:id:*');
  if (userKeys.length === 0) return [];
  
  if(!userKeys.length) return [];
  const users = await kv.mget<User[]>(...userKeys);

  return users
    .filter((u): u is User => u !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAllDocuments(): Promise<DocumentWithAuthorEmail[]> {
    await checkAdmin();

    const users = await getAllUsers();
    const userEmailMap = new Map(users.map(u => [u.id, u.email]));

    const allUserKeys = await kv.keys('readify:user:id:*');
    if (allUserKeys.length === 0) {
        return [];
    }

    const userIds = allUserKeys.map(key => key.replace('readify:user:id:', ''));
    
    if (userIds.length === 0) {
        return [];
    }
    
    const pipeline = kv.pipeline();
    userIds.forEach(userId => pipeline.lrange(`readify:user:${userId}:docs`, 0, -1));
    const allDocIdLists = await pipeline.exec() as string[][];
    
    const allDocIds = allDocIdLists.flat();

    const uniqueDocIds = [...new Set(allDocIds.filter(id => id))];

    if (uniqueDocIds.length === 0) {
        return [];
    }
    
    const docKeys = uniqueDocIds.map(id => `readify:doc:${id}`);
    const allDocs = await kv.mget<Document[]>(...docKeys);
    
    const validDocs = allDocs.filter((d): d is Document => d !== null);

    const docsWithAuthorEmail = validDocs.map(doc => ({
        ...doc,
        ownerEmail: userEmailMap.get(doc.userId) || 'Unknown User'
    }));

    return docsWithAuthorEmail.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}


export async function deleteUser(userId: string): Promise<{ success: boolean; message?: string }> {
  await checkAdmin();
  
  try {
    const user: User | null = await kv.get(`readify:user:id:${userId}`);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isAdmin) {
      throw new Error('Cannot delete an admin user.');
    }

    const pipeline = kv.pipeline();
    const docListKey = `readify:user:${userId}:docs`;
    const docIds: string[] | null = await kv.lrange(docListKey, 0, -1);
    
    if (docIds && docIds.length > 0) {
      const validDocIds = docIds.filter(id => id);
      if (validDocIds.length > 0) {
        const docKeysToDelete = validDocIds.map(id => `readify:doc:${id}`);
        pipeline.del(...docKeysToDelete);
      }
    }
    
    pipeline.del(docListKey);
    pipeline.del(`readify:user:id:${userId}`);
    if (user.username) {
        pipeline.del(`readify:user:username:${user.username}`);
    }
    pipeline.del(`readify:user:email:${user.email}`);

    await pipeline.exec();

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Failed to delete user:', message);
    return { success: false, message };
  }
}

export async function createUser(userData: {
    name: string;
    email: string;
    role: 'Admin' | 'User';
}, submissionId?: string): Promise<{ success: boolean, message?: string }> {
    await checkAdmin();

    try {
        const { name, email, role } = userData;

        const existingUserByEmail: User | null = await kv.get(`readify:user:email:${email}`);
        if (existingUserByEmail) {
            return { success: false, message: 'User with this email already exists.' };
        }
        
        const setupToken = randomUUID();
        const setupTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const userId = randomUUID();
        const newUser: User = {
            id: userId,
            name,
            email,
            username: null,
            password: '', // Password will be set by the user
            isAdmin: role === 'Admin',
            createdAt: new Date().toISOString(),
            setupToken,
            setupTokenExpiry: setupTokenExpiry.toISOString(),
        };

        const pipeline = kv.pipeline();
        pipeline.set(`readify:user:email:${email}`, newUser);
        pipeline.set(`readify:user:id:${userId}`, newUser);
        
        if (submissionId) {
            const submission: Submission | null = await kv.get(`readify:submission:${submissionId}`);
            if (submission) {
                submission.status = 'Approved';
                pipeline.set(`readify:submission:${submissionId}`, submission);
            }
        }
        
        await pipeline.exec();
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const setupLink = `${appUrl}/setup-account/${setupToken}`;
        await sendWelcomeEmail(email, name, setupLink);

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Failed to create user:', message);
        return { success: false, message };
    }
}


export async function deleteDocumentAsAdmin(docId: string): Promise<{ success: boolean; message?: string }> {
    await checkAdmin();
    try {
        const result = await dbDeleteDocument(docId);
        if (result.success) {
             return { success: true };
        }
        return { success: false, message: 'Document not found.'};

    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Failed to delete document as admin:', message);
        return { success: false, message };
    }
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
    await checkAdmin();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const users = await getAllUsers();
    
    // Fetch documents from both environments
    const allDocs = await getAllDocuments();

    const newUsersLast30Days = users.filter(u => new Date(u.createdAt) > thirtyDaysAgo).length;
    const docsUploadedLast30Days = allDocs.filter(d => new Date(d.createdAt) > thirtyDaysAgo).length;

    // User signups by week
    const userSignupsByWeek: { [week: string]: number } = {};
    users.forEach(user => {
        const date = new Date(user.createdAt);
        const year = date.getUTCFullYear();
        const week = Math.ceil((((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1) / 7);
        const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;
        userSignupsByWeek[weekKey] = (userSignupsByWeek[weekKey] || 0) + 1;
    });

    const sortedWeeks = Object.keys(userSignupsByWeek).sort().slice(-8); // Get last 8 weeks
    const formattedSignups = sortedWeeks.map(week => ({ week, signups: userSignupsByWeek[week] }));

    // Top users by doc count
    const docCounts: { [userId: string]: number } = {};
    allDocs.forEach(doc => {
        docCounts[doc.userId] = (docCounts[doc.userId] || 0) + 1;
    });
    
    const topUsers = Object.entries(docCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 5)
        .map(([userId, docCount]) => {
            const user = users.find(u => u.id === userId);
            return {
                id: userId,
                email: user?.email || 'Unknown User',
                docCount,
            };
        });

    return {
        totalUsers: users.length,
        totalDocuments: allDocs.length,
        newUsersLast30Days,
        docsUploadedLast30Days,
        userSignupsByWeek: formattedSignups,
        topUsersByDocs: topUsers,
    };
}

export async function resendInvitation(userId: string): Promise<{success: boolean, message?: string}> {
    await checkAdmin();
    try {
        const user: User | null = await kv.get(`readify:user:id:${userId}`);
        if (!user) {
            return { success: false, message: 'User not found.' };
        }
        if (user.username) {
            return { success: false, message: 'User account is already active.' };
        }

        const setupToken = randomUUID();
        const setupTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const updatedUser: User = {
            ...user,
            setupToken,
            setupTokenExpiry: setupTokenExpiry.toISOString(),
        };

        const pipeline = kv.pipeline();
        pipeline.set(`readify:user:id:${userId}`, updatedUser);
        pipeline.set(`readify:user:email:${user.email}`, updatedUser);
        await pipeline.exec();

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const setupLink = `${appUrl}/setup-account/${setupToken}`;
        await sendWelcomeEmail(user.email, user.name, setupLink);

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Failed to resend invitation:', message);
        return { success: false, message };
    }
}

export async function getSubmissions(): Promise<Submission[]> {
    await checkAdmin();
    const submissionIds = await kv.lrange('readify:submissions', 0, -1);
    if (!submissionIds || submissionIds.length === 0) return [];
    
    const submissions = await kv.mget<Submission[]>(...submissionIds.map(id => `readify:submission:${id}`));
    return submissions.filter((s): s is Submission => s !== null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function sendReply(submissionId: string, replyMessage: string): Promise<{ success: boolean; message?: string }> {
    const session = await checkAdmin();

    try {
        const submission: Submission | null = await kv.get(`readify:submission:${submissionId}`);
        if (!submission) {
            throw new Error('Submission not found.');
        }

        await sendAdminReplyEmail({
            to: submission.email,
            fromName: session.name,
            originalMessage: submission.message,
            replyMessage,
        });

        submission.status = 'Replied';
        await kv.set(`readify:submission:${submissionId}`, submission);
        
        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Failed to send reply:', message);
        return { success: false, message };
    }
}

export async function updateSubmissionStatus(submissionId: string, status: 'Approved' | 'Rejected' | 'Pending' | 'Replied'): Promise<{ success: boolean; message?: string }> {
    await checkAdmin();
    try {
        const submission: Submission | null = await kv.get(`readify:submission:${submissionId}`);
        if (!submission) {
            throw new Error('Submission not found.');
        }
        submission.status = status;
        await kv.set(`readify:submission:${submissionId}`, submission);
        return { success: true };
    } catch(error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error(`Failed to update status for ${submissionId}:`, message);
        return { success: false, message };
    }
}

