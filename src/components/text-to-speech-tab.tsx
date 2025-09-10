
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Mic } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type TextToSpeechTabProps = {
  onGenerate: (text: string) => Promise<{ success: boolean; audioUrl?: string; error?: string }>;
};

export default function TextToSpeechTab({ onGenerate }: TextToSpeechTabProps) {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter some text to generate audio.' });
      return;
    }
    setIsLoading(true);
    setAudioUrl(null);
    try {
      const result = await onGenerate(text);
      if (result.success && result.audioUrl) {
        setAudioUrl(result.audioUrl);
        toast({ title: 'Success', description: 'Audio generated and will play automatically.' });
      } else {
        throw new Error(result.error || 'Failed to generate audio.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = 'speech.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Card className="mt-6 border-0 shadow-none">
      <CardHeader className="text-center px-0">
        <CardTitle className="text-2xl font-headline">Freestyle Text-to-Speech</CardTitle>
        <CardDescription>Type or paste any text below to convert it into audio.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="grid w-full gap-4">
          <Textarea
            placeholder="Type your text here..."
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isLoading}
          />
          <div className="flex gap-2 justify-center">
            <Button onClick={handleGenerate} disabled={isLoading || !text.trim()} className="w-48">
              {isLoading ? <Loader2 className="animate-spin" /> : <Mic />}
              {isLoading ? 'Generating...' : 'Generate Audio'}
            </Button>
            <Button
              onClick={handleDownload}
              disabled={!audioUrl || isLoading}
              variant="outline"
              className="w-48"
            >
              <Download />
              Download Audio
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
