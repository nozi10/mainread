'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { generateFullAbsurdStory } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap } from 'lucide-react';
import { useEffect } from 'react';

const initialState = {
  title: '',
  story: '',
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
      size="lg"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Zap className="mr-2 h-4 w-4" />
          Generate Absurdity
        </>
      )}
    </Button>
  );
}

export function AbsurdGenerator() {
  const [state, formAction] = useFormState(
    generateFullAbsurdStory,
    initialState
  );
  const { toast } = useToast();

  useEffect(() => {
    if (state?.error) {
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: state.error,
      });
    }
  }, [state, toast]);

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-6">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl md:text-4xl font-headline tracking-tight">
            Absurd Story Generator
          </CardTitle>
          <CardDescription className="text-lg">
            Enter some keywords and let the AI weave a bizarre tale for you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="keywords" className="sr-only">Keywords (optional)</Label>
              <Input
                id="keywords"
                name="keywords"
                placeholder="e.g., cosmic, cheese, melancholy"
                className="bg-background text-center text-base"
              />
            </div>
            <div className="flex justify-center">
              <SubmitButton />
            </div>
          </form>
        </CardContent>
      </Card>

      {state?.title && state?.story && !state.error && (
        <Card className="mt-8 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl animate-in fade-in-0 duration-500">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-center">
              {state.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap text-lg text-justify">
              {state.story}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
