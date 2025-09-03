
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { changeUserPassword, updateUserProfile, deleteUserAccount } from '@/lib/user-actions';
import { Loader2, ArrowLeft, Trash2, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getDocuments, getUserSession, type Document, type UserSession } from '@/lib/db';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAvailableVoices, AvailableVoice } from '@/ai/flows/voice-selection';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

const profileFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  defaultVoice: z.string(),
  defaultSpeakingRate: z.number().min(0.25).max(4.0),
  defaultZoomLevel: z.number().min(0.4).max(3.0),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [availableVoices, setAvailableVoices] = useState<AvailableVoice[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const userSession = await getUserSession();
      setSession(userSession);
      const docs = await getDocuments();
      setRecentDocs(docs.slice(0, 5));
      const voices = await getAvailableVoices();
      setAvailableVoices(voices);

      if (userSession) {
        profileForm.reset({
            name: userSession.name || '',
            defaultVoice: userSession.defaultVoice || 'openai/alloy',
            defaultSpeakingRate: userSession.defaultSpeakingRate || 1.0,
            defaultZoomLevel: userSession.defaultZoomLevel || 1.0,
        });
      }
    }
    fetchData();
  }, []);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      defaultVoice: 'openai/alloy',
      defaultSpeakingRate: 1.0,
      defaultZoomLevel: 1.0,
    }
  });

  const { isDirty: isProfileDirty } = useFormState({ control: profileForm.control });

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    setIsPasswordLoading(true);
    try {
      const result = await changeUserPassword(values);
      if (result.success) {
        toast({ title: 'Success', description: 'Your password has been changed.' });
        passwordForm.reset();
      } else {
        throw new Error(result.message || 'Failed to change password.');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };
  
  const onProfileSubmit = async (values: ProfileFormValues) => {
    setIsProfileLoading(true);
    const formData = new FormData();
    const avatarInput = document.querySelector('input[name="avatar"]') as HTMLInputElement;

    formData.append('name', values.name);
    formData.append('defaultVoice', values.defaultVoice);
    formData.append('defaultSpeakingRate', values.defaultSpeakingRate.toString());
    formData.append('defaultZoomLevel', values.defaultZoomLevel.toString());
    
    if (avatarInput?.files?.[0]) {
      formData.append('avatar', avatarInput.files[0]);
    }

    try {
      const result = await updateUserProfile(formData);
      if (result.success) {
        toast({ title: 'Success', description: 'Your profile has been updated.' });
        profileForm.reset(values); // Reset to new values to clear dirty state
      } else {
        throw new Error(result.message || 'Failed to update profile.');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== session?.email) {
      toast({ variant: 'destructive', title: 'Confirmation failed', description: 'Please type your email correctly to confirm.' });
      return;
    }
    setIsDeleteLoading(true);
    try {
        const result = await deleteUserAccount(passwordForm.getValues('currentPassword'));
        if (result.success) {
            toast({ title: 'Account Deleted', description: 'Your account has been permanently deleted.' });
            router.push('/');
        } else {
            throw new Error(result.message || 'Failed to delete account.');
        }
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        });
    } finally {
        setIsDeleteLoading(false);
        setIsDeleteDialogOpen(false);
    }
  }

  const groupedVoices = useMemo(() => {
    return availableVoices.reduce((acc, voice) => {
        const provider = voice.provider;
        if (!acc[provider]) acc[provider] = [];
        acc[provider].push(voice);
        return acc;
    }, {} as Record<string, AvailableVoice[]>);
  }, [availableVoices]);

  if (!session) {
    return (
        <main className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin" />
        </main>
    )
  }

  return (
    <main className="flex flex-col items-center min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back to App
        </Button>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details here.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                    <div className="flex items-center gap-6">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={avatarPreview || session.avatarUrl} data-ai-hint="user avatar" />
                            <AvatarFallback>{session.name?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <FormField
                            control={profileForm.control}
                            name="name"
                            render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>Display Name</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                     <FormItem>
                        <FormLabel>Profile Picture</FormLabel>
                        <FormControl>
                            <Input name="avatar" type="file" accept="image/*" onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setAvatarPreview(URL.createObjectURL(e.target.files[0]));
                                }
                            }} />
                        </FormControl>
                        <FormDescription>Upload a new avatar. Max 2MB.</FormDescription>
                    </FormItem>
                    
                    <CardTitle className="pt-4 border-t">Reading Preferences</CardTitle>
                    
                    <FormField
                        control={profileForm.control}
                        name="defaultVoice"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Default Voice</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent>
                                    {Object.entries(groupedVoices).map(([provider, voices]) => (
                                        <SelectGroup key={provider}>
                                            <Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{provider.toUpperCase()}</Label>
                                            {voices.map(v => <SelectItem key={v.name} value={v.name}>{v.displayName} ({v.gender})</SelectItem>)}
                                        </SelectGroup>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormDescription>Your default voice for new documents.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={profileForm.control}
                        name="defaultSpeakingRate"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Default Speaking Rate: {field.value?.toFixed(2)}x</FormLabel>
                            <FormControl>
                                <Slider min={0.25} max={4.0} step={0.25} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={profileForm.control}
                        name="defaultZoomLevel"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Default PDF Zoom: {(field.value * 100).toFixed(0)}%</FormLabel>
                            <FormControl>
                                <Slider min={0.4} max={3.0} step={0.1} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <CardFooter className="px-0 pt-6">
                        <Button type="submit" disabled={isProfileLoading || !isProfileDirty}>
                            {isProfileLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </CardFooter>
                </form>
                </Form>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Enter your current password and a new password.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                    <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                        <FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                        <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <CardFooter className="px-0 pt-6">
                      <Button type="submit" disabled={isPasswordLoading}>
                          {isPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Update Password
                      </Button>
                    </CardFooter>
                </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="border-destructive">
                 <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="destructive"><Trash2 className="mr-2"/>Delete My Account</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Are you absolutely sure?</DialogTitle>
                                <DialogDescription>
                                    This action cannot be undone. This will permanently delete your account, documents, and all associated data. To confirm, please type your email address (`{session.email}`) below.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                 <Input 
                                    placeholder="Enter your email to confirm"
                                    value={deleteConfirmation}
                                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                                />
                                <div className="space-y-2 relative">
                                    <Label htmlFor="delete-password">Enter Your Current Password</Label>
                                    <Input {...passwordForm.register("currentPassword")} id="delete-password" type={showPassword ? 'text' : 'password'} required />
                                    <Button type="button" variant="ghost" size="icon" className="absolute bottom-1 right-1 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                                <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleteLoading || deleteConfirmation !== session.email}>
                                    {isDeleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    I understand, delete my account
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
          </div>

          <div className="md:col-span-1 space-y-8">
            <Card>
                <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
                <CardContent>
                    <ul className="space-y-3">
                        {recentDocs.length > 0 ? recentDocs.map(doc => (
                            <li key={doc.id} className="text-sm text-muted-foreground truncate">
                                <span className="font-medium text-foreground">Accessed:</span> {doc.fileName}
                            </li>
                        )) : (
                            <p className="text-sm text-muted-foreground">No recent documents.</p>
                        )}
                    </ul>
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
