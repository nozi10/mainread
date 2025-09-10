
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getSubmissions, sendReply, AdminSubmission, deleteSubmission, rejectSubmission } from '@/lib/admin-actions';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Inbox, Send, Eye, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { Label } from './ui/label';

export default function AdminInbox() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
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

  const handleAction = async (action: () => Promise<any>, submissionId: string, successMessage: string) => {
    setIsActionLoading(submissionId);
    try {
        const result = await action();
        if (result.success) {
            toast({ title: 'Success', description: successMessage });
            fetchSubmissions();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        });
    } finally {
        setIsActionLoading(null);
    }
  }

  const handleApprove = (submission: AdminSubmission) => {
    // Redirect to admin page with query params to open the Add User dialog
    const approveUrl = `/admin?action=addUser&name=${encodeURIComponent(submission.name)}&email=${encodeURIComponent(submission.email)}&submissionId=${submission.id}`;
    router.push(approveUrl);
  };
  
  const handleReject = async (submissionId: string) => {
    await handleAction(() => rejectSubmission(submissionId), submissionId, 'Access request rejected.');
  };
  
  const handleDelete = async (submissionId: string) => {
    await handleAction(() => deleteSubmission(submissionId), submissionId, 'Submission deleted.');
  };

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

  const getStatusVariant = (status: AdminSubmission['status']): 'default' | 'secondary' | 'destructive' | 'outline' => {
      switch(status) {
          case 'Approved': return 'default';
          case 'Pending': return 'secondary';
          case 'Rejected': return 'destructive';
          case 'Replied': return 'outline';
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
                <TableHead className="text-right">Actions</TableHead>
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
                  <TableCell className="space-x-1 text-right">
                    {isActionLoading === sub.id ? <Loader2 className="h-5 w-5 animate-spin inline-flex" /> : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleView(sub)}>
                          <Eye className="mr-2 h-4 w-4"/> View
                        </Button>
                        
                        {sub.type === 'Access Request' && sub.status === 'Pending' && (
                            <>
                                <Button size="sm" onClick={() => handleApprove(sub)} variant="secondary">
                                    <CheckCircle className="mr-2 h-4 w-4"/> Approve
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="destructive">
                                            <XCircle className="mr-2 h-4 w-4"/> Reject
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Reject Access Request?</AlertDialogTitle>
                                            <AlertDialogDescription>An email will be sent to the user informing them of the rejection. Are you sure?</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleReject(sub.id)} className="bg-destructive hover:bg-destructive/90">Reject</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </>
                        )}

                        {sub.type === 'General Inquiry' && sub.status !== 'Replied' && (
                             <Button size="sm" onClick={() => handleReply(sub)}>
                                <Send className="mr-2 h-4 w-4"/> Reply
                            </Button>
                        )}
                        
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently delete this submission. This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(sub.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
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

    