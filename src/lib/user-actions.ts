
'use server';

import { kv } from '@vercel/kv';
import { del as deleteBlob, put as putBlob } from '@vercel/blob';
import { getSession, createSession, deleteSession } from './session';
import type { User } from './db';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').optional(),
  defaultVoice: z.string().optional(),
  defaultSpeakingRate: z.coerce.number().min(0.25).max(4.0).optional(),
  defaultZoomLevel: z.coerce.number().min(0.4).max(3).optional(),
});

export async function updateUserProfile(formData: FormData): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, message: 'Authentication required.' };
  }
  
  const result = profileUpdateSchema.safeParse({
    name: formData.get('name') || undefined,
    defaultVoice: formData.get('defaultVoice') || undefined,
    defaultSpeakingRate: formData.get('defaultSpeakingRate') || undefined,
    defaultZoomLevel: formData.get('defaultZoomLevel') || undefined,
  });

  if(!result.success) {
      return { success: false, message: result.error.errors.map(e => e.message).join(', ') };
  }

  try {
    const user: User | null = await kv.get(`readify:user:id:${session.userId}`);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }
    
    let avatarUrl = user.avatarUrl;
    const avatarFile = formData.get('avatar') as File;

    if (avatarFile && avatarFile.size > 0) {
        if (user.avatarUrl) {
            try {
                await deleteBlob(user.avatarUrl);
            } catch (error) {
                console.warn("Failed to delete old avatar, it might have been already removed:", error);
            }
        }
        
        const blob = await putBlob(avatarFile.name, avatarFile, {
          access: 'public',
        });
        
        avatarUrl = blob.url;
    }

    const updatedUser: User = {
        ...user,
        name: result.data.name ?? user.name,
        avatarUrl,
        defaultVoice: result.data.defaultVoice ?? user.defaultVoice,
        defaultSpeakingRate: result.data.defaultSpeakingRate ?? user.defaultSpeakingRate,
        defaultZoomLevel: result.data.defaultZoomLevel ?? user.defaultZoomLevel,
    };

    const pipeline = kv.pipeline();
    pipeline.set(`readify:user:id:${user.id}`, updatedUser);
    pipeline.set(`readify:user:email:${user.email}`, updatedUser);
    if(user.username) {
        pipeline.set(`readify:user:username:${user.username}`, updatedUser);
    }
    await pipeline.exec();
    
    revalidatePath('/read'); // Revalidate to update the user panel

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('Failed to update profile:', message);
    return { success: false, message: "Failed to save avatar." };
  }
}

export async function changeUserPassword(data: {
  currentPassword?: string;
  newPassword?: string;
}): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, message: 'Authentication required.' };
  }

  if (!data.currentPassword || !data.newPassword) {
      return { success: false, message: 'All fields are required.'}
  }

  try {
    const user: User | null = await kv.get(`readify:user:id:${session.userId}`);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const passwordsMatch = await bcrypt.compare(data.currentPassword, user.password);
    if (!passwordsMatch) {
      return { success: false, message: 'Incorrect current password.' };
    }

    const newHashedPassword = await bcrypt.hash(data.newPassword, 10);
    
    const updatedUser: User = {
        ...user,
        password: newHashedPassword,
    };

    const pipeline = kv.pipeline();
    pipeline.set(`readify:user:email:${user.email}`, updatedUser);
    pipeline.set(`readify:user:id:${user.id}`, updatedUser);
    if(user.username) {
        pipeline.set(`readify:user:username:${user.username}`, updatedUser);
    }
    await pipeline.exec();

    await createSession(user.id, user.isAdmin, user.username);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Failed to change password:', message);
    return { success: false, message };
  }
}

export async function deleteUserAccount(password: string): Promise<{ success: boolean; message?: string }> {
    const session = await getSession();
    if (!session?.userId) {
        return { success: false, message: 'Authentication required.' };
    }

    try {
        const user: User | null = await kv.get(`readify:user:id:${session.userId}`);
        if (!user) {
            return { success: false, message: 'User not found.' };
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (!passwordsMatch) {
            return { success: false, message: 'Incorrect password.' };
        }

        // Delete all user documents from blob storage and KV
        const docListKey = `readify:user:${user.id}:docs`;
        const docIds: string[] = await kv.lrange(docListKey, 0, -1);
        if (docIds.length > 0) {
            const validDocIds = docIds.filter(id => id);
            const docKeys = validDocIds.map(id => `readify:doc:${id}`);
            const docs: (User | null)[] = await kv.mget(...docKeys);
            const urlsToDelete: string[] = [];
            docs.forEach((doc: any) => {
                if (doc?.pdfUrl) urlsToDelete.push(doc.pdfUrl);
                if (doc?.audioUrl) urlsToDelete.push(doc.audioUrl);
            });
            if (urlsToDelete.length > 0) {
                await deleteBlob(urlsToDelete);
            }
            if(docKeys.length > 0) {
                // @ts-ignore
                await kv.del(...docKeys);
            }
        }
        
        if (user.avatarUrl) {
            await deleteBlob(user.avatarUrl);
        }

        const pipeline = kv.pipeline();
        pipeline.del(docListKey);
        pipeline.del(`readify:user:id:${user.id}`);
        if (user.username) {
            pipeline.del(`readify:user:username:${user.username}`);
        }
        pipeline.del(`readify:user:email:${user.email}`);
        await pipeline.exec();

        await deleteSession();

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        console.error('Failed to delete user account:', message);
        return { success: false, message };
    }
}
