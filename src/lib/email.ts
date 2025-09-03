
'use server';

import { Resend } from 'resend';
import { WelcomeEmail } from '@/components/emails/welcome-email';
import { ContactFormEmail } from '@/components/emails/contact-form-email';
import { RejectionEmail } from '@/components/emails/rejection-email';
import { GeneralContactFormEmail } from '@/components/emails/general-contact-form-email';


const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const toEmail = process.env.ADMIN_EMAIL || process.env.FROM_EMAIL || 'onboarding@resend.dev';

export async function sendWelcomeEmail(
  to: string,
  name: string,
  setupLink: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: `Readify <${fromEmail}>`,
      to,
      subject: 'Welcome to Readify! Complete Your Account Setup',
      react: WelcomeEmail({ name, setupLink }),
    });

    if (error) {
      console.error('Resend Error:', error);
      // Throw a more specific error to be caught by the calling action
      throw new Error(`Resend failed: ${error.message}`);
    }

    console.log('Welcome email sent successfully:', data?.id);
    return data;
  } catch (error) {
    // Catch the error and re-throw it to ensure the calling function knows about it.
    // This now includes our more specific error from above.
    console.error('Error in sendWelcomeEmail:', error);
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Failed to send welcome email: ${message}`);
  }
}

export async function sendContactFormEmail({ name, email, message, approveUrl, rejectUrl }: { name: string, email: string, message: string, approveUrl: string, rejectUrl: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: `Readify Access Request <${fromEmail}>`,
            to: toEmail,
            subject: `New Readify Access Request from ${name}`,
            reply_to: email,
            react: ContactFormEmail({ name, email, message, approveUrl, rejectUrl }),
        });

        if (error) {
            console.error('Resend Error:', error);
            throw new Error(`Resend failed: ${error.message}`);
        }

        console.log('Access request email sent successfully:', data?.id);
        return data;

    } catch (error) {
        console.error('Error in sendContactFormEmail:', error);
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        throw new Error(`Failed to send access request email: ${message}`);
    }
}

export async function sendGeneralEmail({ name, email, message }: { name: string, email: string, message: string }) {
    try {
        const { data, error } = await resend.emails.send({
            from: `Readify Contact <${fromEmail}>`,
            to: toEmail,
            subject: `General Inquiry from ${name}`,
            reply_to: email,
            react: GeneralContactFormEmail({ name, email, message }),
        });

        if (error) {
            console.error('Resend Error:', error);
            throw new Error(`Resend failed: ${error.message}`);
        }

        console.log('General contact email sent successfully:', data?.id);
        return data;

    } catch (error) {
        console.error('Error in sendGeneralEmail:', error);
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        throw new Error(`Failed to send general contact email: ${message}`);
    }
}


export async function sendRejectionEmail(to: string) {
    try {
      const { data, error } = await resend.emails.send({
        from: `Readify <${fromEmail}>`,
        to,
        subject: 'Update on Your Readify Access Request',
        react: RejectionEmail(),
      });
  
      if (error) {
        throw new Error(`Resend failed: ${error.message}`);
      }
  
      console.log('Rejection email sent successfully:', data?.id);
      return data;
    } catch (error) {
      console.error('Error in sendRejectionEmail:', error);
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      throw new Error(`Failed to send rejection email: ${message}`);
    }
  }
