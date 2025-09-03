
import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import { sendRejectionEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  if (!token || !email) {
    return new NextResponse('<h1>Invalid Request</h1><p>Missing token or email.</p>', {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const tokenKey = `readify:rejection-token:${token}`;
    const storedEmail = await kv.get(tokenKey);

    if (storedEmail !== email) {
      return new NextResponse('<h1>Invalid or Expired Link</h1><p>This rejection link is either invalid or has expired.</p>', {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Send the rejection email
    await sendRejectionEmail(email);

    // Invalidate the token by deleting it
    await kv.del(tokenKey);

    return new NextResponse('<h1>Request Rejected</h1><p>The access request has been successfully rejected. An email has been sent to the user.</p>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('Error processing rejection:', error);
    return new NextResponse('<h1>Server Error</h1><p>An unexpected error occurred while processing your request.</p>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
