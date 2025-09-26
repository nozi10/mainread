
'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, FileText, Trash2, LogOut, PlusCircle, User, File, TrendingUp, RefreshCcw, LogIn, Inbox, Loader2, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getAllUsers, getAllDocuments, deleteUser, deleteDocumentAsAdmin, getAdminDashboardStats, resendInvitation } from '@/lib/admin-actions';
import type { User as UserType, DocumentWithAuthorEmail as Document, AdminDashboardStats } from '@/lib/admin-actions';
import AddUserDialog from '@/components/add-user-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider, Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AdminInbox from '@/components/admin-inbox';
import AdminSettings from '@/components/admin-settings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const RechartsTooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });


function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserType[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [prefilledUserData, setPrefilledUserData] = useState<{name: string, email: string, submissionId?: string} | null>(null);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [usersData, documentsData, statsData] = await Promise.all([
        getAllUsers(),
        getAllDocuments(),
        getAdminDashboardStats(),
      ]);
      setUsers(usersData);
      setDocuments(documentsData);
      setStats(statsData);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch admin data.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();

    const action = searchParams.get('action');
    if (action === 'addUser') {
        const name = searchParams.get('name');
        const email = searchParams.get('email');
        const submissionId = searchParams.get('submissionId') || undefined;
        if (name && email) {
            setPrefilledUserData({ name, email, submissionId });
            setIsAddUserOpen(true);
            // Clean up URL
            router.replace('/admin', { scroll: false });
        }
    }

  }, [searchParams, router]);

  const handleDeleteUser = async (userId: string) => {
    try {
      const result = await deleteUser(userId);
      if (result.success) {
          toast({ title: 'Success', description: 'User deleted successfully.' });
          fetchAdminData(); // Refresh data
      } else {
          throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user.',
      });
    }
  };

  const handleResendInvitation = async (userId: string) => {
      try {
        const result = await resendInvitation(userId);
        if(result.success) {
            toast({ title: 'Success', description: 'Invitation has been resent.' });
            fetchAdminData();
        } else {
            throw new Error(result.message);
        }
      } catch (error) {
           toast({
                variant: 'destructive',
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to resend invitation.',
            });
      }
  }
  
  const handleImpersonate = async (userId: string) => {
    const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    if(response.ok) {
        router.push('/read');
    } else {
        const data = await response.json();
        toast({ variant: 'destructive', title: 'Error', description: data.message || 'Could not impersonate user.' });
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
        const result = await deleteDocumentAsAdmin(docId);
        if(result.success) {
            toast({ title: 'Success', description: 'Document deleted successfully.' });
            fetchAdminData(); // Refresh data
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
         toast({
            variant: 'destructive',
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to delete document.',
        });
    }
  }
  
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const handleAddUserClick = () => {
    setPrefilledUserData(null);
    setIsAddUserOpen(true);
  }
  

  return (
    <TooltipProvider>
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
       <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <h1 className="text-2xl font-headline text-primary">Admin Panel</h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push('/read')} variant="outline">Go to App</Button>
            <Button onClick={handleLogout} variant="ghost" size="icon">
                <LogOut className="h-5 w-5"/>
                <span className="sr-only">Log out</span>
            </Button>
          </div>
      </header>
      <main className="flex flex-1 flex-col gap-8 p-4 sm:px-6">
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="documents">Document Management</TabsTrigger>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="pt-6">
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalUsers}</div>
                  </CardContent>
                </Card>
                 <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">New Users (30d)</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">+{stats?.newUsersLast30Days}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                    <File className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalDocuments}</div>
                  </CardContent>
                </Card>
                 <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Documents Uploaded (30d)</CardTitle>
                    <File className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">+{stats?.docsUploadedLast30Days}</div>
                  </CardContent>
                </Card>
            </div>
            <div className='grid gap-4 md:grid-cols-2 mt-6'>
                <Card>
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2'><TrendingUp /> User Growth</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats?.userSignupsByWeek}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="week" />
                                <YAxis allowDecimals={false} />
                                <RechartsTooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                                <Bar dataKey="signups" fill="hsl(var(--primary))" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Top Users by Documents</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Documents</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats?.topUsersByDocs.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.docCount}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="pt-6">
            <Card>
                <CardHeader className="flex justify-between items-center flex-row">
                <div className="flex items-center gap-2">
                    <Users />
                    <CardTitle>User Management</CardTitle>
                </div>
                <Button onClick={handleAddUserClick}><PlusCircle className="mr-2"/>Add User</Button>
                </CardHeader>
                <CardContent>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Signed Up</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {users.map(user => (
                        <TableRow key={user.id}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.isAdmin ? 'Admin' : 'User'}</TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{user.username ? 'Active' : 'Pending Invitation'}</TableCell>
                        <TableCell className='space-x-1'>
                             {!user.username && (
                                <UiTooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" onClick={() => handleResendInvitation(user.id)}>
                                            <RefreshCcw className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Resend Invitation</p></TooltipContent>
                                </UiTooltip>
                             )}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                     <UiTooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="outline" size="icon" disabled={user.isAdmin}>
                                                <LogIn className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Log in as User</p></TooltipContent>
                                     </UiTooltip>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Log In as {user.email}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Your current admin session will be temporarily replaced. You can return to your admin account from a banner in the app.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleImpersonate(user.id)}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <UiTooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="destructive" size="icon" disabled={user.isAdmin}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Delete User</p></TooltipContent>
                                    </UiTooltip>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete the user and all their documents. This action cannot be undone.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90">Delete User</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="documents" className="pt-6">
            <Card>
                <CardHeader className="flex items-center gap-2 flex-row">
                    <FileText />
                    <CardTitle>Document Management</CardTitle>
                </CardHeader>
                <CardContent>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Owner (Email)</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {documents.map(doc => (
                        <TableRow key={doc.id}>
                        <TableCell>{doc.fileName}</TableCell>
                        <TableCell>{doc.ownerEmail}</TableCell>
                        <TableCell>{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="space-x-2">
                            <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline">View PDF</Button>
                            </a>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the document "{doc.fileName}". This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteDocument(doc.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inbox" className="pt-6">
             <AdminInbox />
          </TabsContent>
          
          <TabsContent value="settings" className="pt-6">
             <AdminSettings />
          </TabsContent>

        </Tabs>
      </main>
    </div>
    <AddUserDialog 
      isOpen={isAddUserOpen}
      onClose={() => setIsAddUserOpen(false)}
      onUserAdded={() => {
        fetchAdminData();
        setIsAddUserOpen(false);
      }}
      prefilledData={prefilledUserData}
    />
    </TooltipProvider>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    }>
      <AdminDashboard />
    </Suspense>
  );
}
