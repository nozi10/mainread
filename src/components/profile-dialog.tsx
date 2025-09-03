
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { changeUserPassword, updateUserProfile, deleteUserAccount } from '@/lib/user-actions';
import { Loader2, Trash2, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getUserSession, type Document, type UserSession } from '@/lib/db';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAvailableVoices, AvailableVoice } from '@/ai/flows/voice-selection';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

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

type ProfileDialogProps = {
  session: UserSession;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void; // To refresh session data on parent
};

export default function ProfileDialog({ session, onOpenChange, onUpdate }: ProfileDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
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
      const voices = await getAvailableVoices();
      setAvailableVoices(voices);

      if (session) {
        profileForm.reset({
            name: session.name || '',
            defaultVoice: session.defaultVoice || 'openai/alloy',
            defaultSpeakingRate: session.defaultSpeakingRate || 1.0,
            defaultZoomLevel: session.defaultZoomLevel || 1.0,
        });
      }
    }
    fetchData();
  }, [session]);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: session.name || '',
      defaultVoice: session.defaultVoice || 'openai/alloy',
      defaultSpeakingRate: session.defaultSpeakingRate || 1.0,
      defaultZoomLevel: session.defaultZoomLevel || 1.0,
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
        profileForm.reset(values);
        onUpdate(); // Trigger refresh
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
        onOpenChange(false);
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

  if (!session) return null;

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>My Account</DialogTitle>
        <DialogDescription>Manage your profile, preferences, and security settings.</DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="py-4">
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
                    
                    <h3 className="pt-4 border-t text-lg font-medium">Reading Preferences</h3>
                    
                    <FormField
                        control={profileForm.control}
                        name="defaultVoice"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Default Voice</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
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
                    <DialogFooter>
                        <Button type="submit" disabled={isProfileLoading || !isProfileDirty}>
                            {isProfileLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </TabsContent>
        <TabsContent value="security" className="py-4">
             <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                    <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                        <FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                        <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="submit" disabled={isPasswordLoading}>
                          {isPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Update Password
                      </Button>
                    </DialogFooter>
                </form>
            </Form>
        </TabsContent>
        <TabsContent value="danger" className="py-4">
            <p className="text-sm text-destructive mb-4">This action is permanent and cannot be undone.</p>
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="destructive"><Trash2 className="mr-2"/>Delete My Account</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Are you absolutely sure?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete your account and all associated data. To confirm, please type your email address (`{session.email}`) and current password below.
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
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
