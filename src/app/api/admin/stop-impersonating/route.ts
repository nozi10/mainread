
import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/session';
import { kv } from '@vercel/kv';
import type { User } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const impersonatorId = cookieStore.get('impersonator_id')?.value;

  if (!impersonatorId) {
    return NextResponse.json({ message: 'No active impersonation session found' }, { status: 400 });
  }

  // Find the original admin user
  const adminUser: User | null = await kv.get(`readify:user:id:${impersonatorId}`);

  if (!adminUser || !adminUser.isAdmin) {
    // Clear cookies just in case, and redirect to login
    const response = NextResponse.redirect(new URL('/login', req.nextUrl));
    response.cookies.delete('session');
    response.cookies.delete('impersonator_id');
    return response;
  }
  
  // Create a new response so we can set cookies
  const response = NextResponse.json({ success: true });

  // Restore the admin's session
  await createSession(adminUser.id, adminUser.isAdmin, adminUser.username, response.cookies);

  // Clear the impersonator cookie
  response.cookies.delete('impersonator_id');
  
  return response;
}
