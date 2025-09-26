
import type {Metadata} from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from '@/components/theme-provider';
import Script from 'next/script';
import ImpersonationBanner from '@/components/impersonation-banner';
import { getSession } from '@/lib/session';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'Readify',
  description: 'A PDF viewer and reader with text-to-speech capabilities.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const impersonatorId = (await cookies()).get('impersonator_id')?.value;
  const isImpersonating = !!impersonatorId && session?.isAdmin === false;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn("font-body antialiased", "min-h-screen bg-background font-sans")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {isImpersonating && <ImpersonationBanner />}
          {children}
          <Toaster />
        </ThemeProvider>
        <Script src="/static/pdf.min.js" />
      </body>
    </html>
  );
}
