
'use server';

import { kv } from '@vercel/kv';
import { getSession } from './session';
import type { User as DbUser, Document as DbDocument } from './db';
import { randomUUID } from 'crypto';
import { deleteDocument as dbDeleteDocument } from './db';
import { sendWelcomeEmail } from './email';

export interface Document extends DbDocument {}

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

export async function getAllDocuments(isStaging: boolean = false): Promise<DocumentWithAuthorEmail[]> {
    await checkAdmin();
    const prefix = isStaging ? 'readify:staging' : 'readify';

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
    userIds.forEach(userId => pipeline.lrange(`${prefix}:user:${userId}:docs`, 0, -1));
    const allDocIdLists = await pipeline.exec() as string[][];
    
    const allDocIds = allDocIdLists.flat();

    const uniqueDocIds = [...new Set(allDocIds.filter(id => id))];

    if (uniqueDocIds.length === 0) {
        return [];
    }
    
    const docKeys = uniqueDocIds.map(id => `${prefix}:doc:${id}`);
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

    // Delete both production and staging documents
    const prodDocListKey = `readify:user:${userId}:docs`;
    const stagingDocListKey = `readify:staging:user:${userId}:docs`;
    const [prodDocIds, stagingDocIds] = await Promise.all([
        kv.lrange<string[]>(prodDocListKey, 0, -1),
        kv.lrange<string[]>(stagingDocListKey, 0, -1),
    ]);

    const allDocIds = [...prodDocIds, ...stagingDocIds];
    
    if (allDocIds.length > 0) {
      const validDocIds = allDocIds.filter(id => id);
      if (validDocIds.length > 0) {
        const prodDocKeysToDelete = prodDocIds.map(id => `readify:doc:${id}`);
        const stagingDocKeysToDelete = stagingDocIds.map(id => `readify:staging:doc:${id}`);
        // @ts-ignore
        if (prodDocKeysToDelete.length > 0) pipeline.del(...prodDocKeysToDelete);
        // @ts-ignore
        if (stagingDocKeysToDelete.length > 0) pipeline.del(...stagingDocKeysToDelete);
      }
    }
    
    pipeline.del(prodDocListKey);
    pipeline.del(stagingDocListKey);
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
}): Promise<{ success: boolean, message?: string }> {
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
        await pipeline.exec();
        
        const setupLink = `${process.env.NEXT_PUBLIC_APP_URL}/setup-account/${setupToken}`;
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
        // Try deleting from both staging and prod
        const prodResult = await dbDeleteDocument(docId, false);
        const stagingResult = await dbDeleteDocument(docId, true);
        
        // If either succeeded (or if it was already deleted), count as success
        if (prodResult.success || stagingResult.success) {
             return { success: true };
        }
        return { success: false, message: 'Document not found in any environment.'};

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
    const prodDocs = await getAllDocuments(false);
    const stagingDocs = await getAllDocuments(true);
    const allDocs = [...prodDocs, ...stagingDocs];
    const uniqueDocs = Array.from(new Map(allDocs.map(doc => [doc.id, doc])).values());


    const newUsersLast30Days = users.filter(u => new Date(u.createdAt) > thirtyDaysAgo).length;
    const docsUploadedLast30Days = uniqueDocs.filter(d => new Date(d.createdAt) > thirtyDaysAgo).length;

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
    uniqueDocs.forEach(doc => {
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
        totalDocuments: uniqueDocs.length,
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

        const setupLink = `${process.env.NEXT_PUBLIC_APP_URL}/setup-account/${setupToken}`;
        await sendWelcomeEmail(user.email, user.name, setupLink);

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
        console.error('Failed to resend invitation:', message);
        return { success: false, message };
    }
}

    