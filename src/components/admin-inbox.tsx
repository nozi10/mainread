
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getSubmissions, sendReply, AdminSubmission } from '@/lib/admin-actions';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Inbox, Send, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from './ui/label';

export default function AdminInbox() {
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<AdminSubmission | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const { toast } = useToast();

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const data = await getSubmissions();
      setSubmissions(data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch submissions.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleView = (submission: AdminSubmission) => {
    setSelectedSubmission(submission);
    setIsViewOpen(true);
  };

  const handleReply = (submission: AdminSubmission) => {
    setSelectedSubmission(submission);
    setIsReplyOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedSubmission || !replyMessage.trim()) return;
    setIsReplying(true);
    try {
      const result = await sendReply(selectedSubmission.id, replyMessage);
      if (result.success) {
        toast({ title: 'Success', description: 'Reply sent successfully.' });
        setIsReplyOpen(false);
        setReplyMessage('');
        fetchSubmissions(); // Refresh the list to show 'Replied' status
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send reply.',
      });
    } finally {
      setIsReplying(false);
    }
  };

  const getStatusVariant = (status: AdminSubmission['status']): 'default' | 'secondary' | 'destructive' => {
      switch(status) {
          case 'Approved': return 'default';
          case 'Pending': return 'secondary';
          case 'Rejected': return 'destructive';
          case 'Replied': return 'default';
          default: return 'secondary';
      }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex items-center gap-2 flex-row">
          <Inbox />
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : submissions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>{new Date(sub.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{sub.email}</TableCell>
                  <TableCell>{sub.type}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(sub.status)}>{sub.status}</Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleView(sub)}>
                      <Eye className="mr-2 h-4 w-4"/> View
                    </Button>
                    <Button size="sm" onClick={() => handleReply(sub)} disabled={sub.status === 'Replied'}>
                      <Send className="mr-2 h-4 w-4"/> Reply
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4 py-4">
              <div><strong>From:</strong> {selectedSubmission.name} ({selectedSubmission.email})</div>
              <div><strong>Date:</strong> {new Date(selectedSubmission.createdAt).toLocaleString()}</div>
              <div><strong>Type:</strong> {selectedSubmission.type}</div>
              <div><strong>Status:</strong> <Badge variant={getStatusVariant(selectedSubmission.status)}>{selectedSubmission.status}</Badge></div>
              <div className="space-y-1">
                  <Label>Message:</Label>
                  <p className="p-3 bg-muted rounded-md text-sm">{selectedSubmission.message}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Reply Dialog */}
      <Dialog open={isReplyOpen} onOpenChange={setIsReplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to {selectedSubmission?.name}</DialogTitle>
            <DialogDescription>Your reply will be sent via email to {selectedSubmission?.email}.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
             <div className="space-y-1">
                <Label>Original Message:</Label>
                <p className="p-3 bg-muted rounded-md text-sm">{selectedSubmission?.message}</p>
            </div>
            <Textarea
              placeholder="Type your reply here..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsReplyOpen(false)}>Cancel</Button>
            <Button onClick={handleSendReply} disabled={isReplying || !replyMessage.trim()}>
              {isReplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
