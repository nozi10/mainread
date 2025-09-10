
'use client';

import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { UserX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ImpersonationBanner() {
  const router = useRouter();
  const { toast } = useToast();

  const handleStopImpersonating = async () => {
    const response = await fetch('/api/admin/stop-impersonating', { method: 'POST' });
    if (response.ok) {
      // Refresh the page to get the new session
      router.push('/admin');
      router.refresh();
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not stop impersonating. Please try logging out.',
      });
    }
  };

  return (
    <div className="bg-yellow-400 text-yellow-900 text-center p-2 flex items-center justify-center gap-4">
      <p className="font-semibold">You are currently impersonating a user.</p>
      <Button
        variant="secondary"
        size="sm"
        className="bg-yellow-500 hover:bg-yellow-600 text-yellow-900"
        onClick={handleStopImpersonating}
      >
        <UserX className="mr-2" />
        Return to Admin
      </Button>
    </div>
  );
}
