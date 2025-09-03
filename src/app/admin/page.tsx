
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, FileText, Trash2, LogOut, PlusCircle, User, File, TrendingUp, RefreshCcw, LogIn } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getAllUsers, getAllDocuments, deleteUser, deleteDocumentAsAdmin, getAdminDashboardStats, resendInvitation } from '@/lib/admin-actions';
import type { User as UserType, DocumentWithAuthorEmail as Document, AdminDashboardStats } from '@/lib/admin-actions';
import AddUserDialog from '@/components/add-user-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TooltipProvider, Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserType[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [prefilledUserData, setPrefilledUserData] = useState<{name: string, email: string} | null>(null);

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
        if (name && email) {
            setPrefilledUserData({ name, email });
            setIsAddUserOpen(true);
            // Clean up URL
            router.replace('/admin', { scroll: false });
        }
    }

  }, [searchParams, router]);

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user and all their documents? This action cannot be undone.')) {
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
      if(confirm('Are you sure you want to log in as this user? Your current admin session will be temporarily replaced.')) {
        // Implement this API route next
        // const response = await fetch('/api/admin/impersonate', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ userId }),
        // });
        // if(response.ok) {
        //     router.push('/read');
        // } else {
        //     const data = await response.json();
        //     toast({ variant: 'destructive', title: 'Error', description: data.message || 'Could not impersonate user.' });
        // }
        toast({ title: 'Coming Soon', description: 'User impersonation will be implemented soon.' });
      }
  }

  const handleDeleteDocument = async (docId: string) => {
    if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
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
                                <UiTooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
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
                             <UiTooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={() => handleImpersonate(user.id)}>
                                        <LogIn className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Log in as User</p></TooltipContent>
                             </UiTooltip>
                            <UiTooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="destructive" size="icon" onClick={() => handleDeleteUser(user.id)} disabled={user.isAdmin}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Delete User</p></TooltipContent>
                            </UiTooltip>
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
                            <Button variant="destructive" onClick={() => handleDeleteDocument(doc.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
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
