
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { sendGeneralContactMessage } from '@/lib/actions';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';

const contactFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  message: z.string().min(10, { message: 'Message must be at least 10 characters.' }),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSuccess) {
      timer = setTimeout(() => {
        router.push('/');
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [isSuccess, router]);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
  });

  const onSubmit = async (values: ContactFormValues) => {
    setIsLoading(true);
    try {
      const result = await sendGeneralContactMessage(values);
      if (result.success) {
        setIsSuccess(true);
        form.reset();
      } else {
        throw new Error(result.message || 'An unexpected error occurred.');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-background relative">
       <AlertDialog open={isSuccess}>
        <AlertDialogContent>
          <AlertDialogHeader className="flex flex-col items-center text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <AlertDialogTitle className="text-2xl">Message Sent!</AlertDialogTitle>
            <AlertDialogDescription>
              Thanks for reaching out. We'll get back to you soon. You will be redirected to the homepage shortly.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      <div className="absolute top-4 left-4">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-headline text-primary">Contact Us</CardTitle>
          <CardDescription>Have a question or feedback? Let us know!</CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && <p className="text-sm font-medium text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
               {form.formState.errors.email && <p className="text-sm font-medium text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Your Message</Label>
              <Textarea id="message" {...form.register('message')} rows={5} />
               {form.formState.errors.message && <p className="text-sm font-medium text-destructive">{form.formState.errors.message.message}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : <Send className="mr-2" />}
              {isLoading ? 'Sending...' : 'Send Message'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
