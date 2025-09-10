
import { NextRequest, NextResponse } from 'next/server';
import { getSession, createSession } from '@/lib/session';
import { kv } from '@vercel/kv';
import type { User } from '@/lib/db';

export async function POST(req: NextRequest) {
  const adminSession = await getSession();

  // 1. Check if the current user is an admin
  if (!adminSession?.isAdmin) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
  }

  // 2. Find the user to impersonate
  const userToImpersonate: User | null = await kv.get(`readify:user:id:${userId}`);

  if (!userToImpersonate) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }
  
  if (userToImpersonate.isAdmin) {
      return NextResponse.json({ message: 'Cannot impersonate another admin.' }, { status: 403 });
  }

  // 3. Store the original admin's ID
  const adminId = adminSession.userId;
  const response = NextResponse.json({ success: true });
  response.cookies.set('impersonator_id', adminId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  // 4. Create a new session for the impersonated user
  // This will overwrite the current 'session' cookie
  await createSession(userToImpersonate.id, userToImpersonate.isAdmin, userToImpersonate.username, response.cookies);
  
  return response;
}
