
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
import { useState } from 'react';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { sendContactMessage } from '@/lib/actions';

const contactFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  message: z.string().min(10, { message: 'Message must be at least 10 characters.' }),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function RequestAccessPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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
      const result = await sendContactMessage(values);
      if (result.success) {
        toast({
          title: 'Request Sent!',
          description: "Thanks for reaching out. We'll review your request and get back to you shortly.",
        });
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
          <CardTitle className="text-4xl font-headline text-primary">Request Access to Readify</CardTitle>
          <CardDescription>Fill out the form below to request an account. We'll review your request and get back to you shortly.</CardDescription>
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
              <Label htmlFor="message">Tell us a bit about why you'd like to use our app</Label>
              <Textarea id="message" {...form.register('message')} rows={5} />
               {form.formState.errors.message && <p className="text-sm font-medium text-destructive">{form.formState.errors.message.message}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : <Send className="mr-2" />}
              {isLoading ? 'Sending...' : 'Submit Request'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
