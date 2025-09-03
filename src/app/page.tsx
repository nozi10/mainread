
'use client';

import { ArrowRight, BookOpen, Mic, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-headline font-bold">Readify</span>
          </Link>
          <nav className="flex items-center gap-2">
             <Button asChild variant="ghost">
              <Link href="/contact">
                Contact
              </Link>
            </Button>
            <Button asChild>
              <Link href="/login">
                Login <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="w-full py-16 md:py-20 lg:py-24">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline text-primary">
                  Transform Your Documents into Audiobooks
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Readify intelligently converts your PDFs into natural-sounding speech. Upload, listen, and learn on the go with our AI-powered tools.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row pt-4">
                <Button asChild size="lg">
                  <Link href="/login">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-16 md:py-20 lg:py-24 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm">Key Features</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Read Less, Learn More</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Our advanced AI tools help you interact with your documents in entirely new ways.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 lg:max-w-none mt-12">
              <Card>
                <CardHeader className="flex flex-col items-center text-center">
                  <div className="mb-4 rounded-full bg-primary/10 p-4">
                    <Mic className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>AI-Powered Narration</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground">
                  Choose from a variety of natural-sounding voices to listen to your documents, powered by cutting-edge text-to-speech technology.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-col items-center text-center">
                  <div className="mb-4 rounded-full bg-primary/10 p-4">
                    <BrainCircuit className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Intelligent Analysis</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground">
                  Instantly get summaries, key points, and glossaries. Chat with your documents and generate quizzes to test your knowledge.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-col items-center text-center">
                  <div className="mb-4 rounded-full bg-primary/10 p-4">
                    <BookOpen className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Interactive Reading</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground">
                  Experience synchronized word and sentence highlighting as you listen, keeping you focused and engaged with the content.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Readify. All rights reserved.</p>
      </footer>
    </div>
  );
}
