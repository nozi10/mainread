
import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import { sendRejectionEmail } from '@/lib/email';
import { updateSubmissionStatus } from '@/lib/admin-actions';
import type { Submission } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse('<h1>Invalid Request</h1><p>Missing token.</p>', {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const tokenKey = `readify:rejection-token:${token}`;
    const submissionId: string | null = await kv.get(tokenKey);

    if (!submissionId) {
      return new NextResponse('<h1>Invalid or Expired Link</h1><p>This rejection link is either invalid or has expired.</p>', {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }
    
    const submission: Submission | null = await kv.get(`readify:submission:${submissionId}`);
    if(!submission) {
        return new NextResponse('<h1>Invalid Submission</h1><p>The submission associated with this link could not be found.</p>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
    }
    
    if (submission.status !== 'Pending') {
         return new NextResponse(`<h1>Request Already Actioned</h1><p>This access request has already been ${submission.status.toLowerCase()}. No further action is needed.</p>`, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
    }


    // Send the rejection email
    await sendRejectionEmail(submission.email);

    // Update submission status to 'Rejected'
    await updateSubmissionStatus(submissionId, 'Rejected');

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
