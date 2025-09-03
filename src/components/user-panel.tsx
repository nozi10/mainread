
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, LogOut, User as UserIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import type { UserSession } from '@/lib/db';
import ProfileDialog from './profile-dialog';
import { Dialog, DialogTrigger } from './ui/dialog';

type UserPanelProps = {
    session: UserSession;
    onLogout: () => void;
    onUpdate: () => void;
};

const UserPanel: React.FC<UserPanelProps> = ({ session, onLogout, onUpdate }) => {
    const router = useRouter();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    return (
        <>
            {session.isAdmin && (
                <>
                    <Separator />
                    <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => router.push('/admin')}>
                            <Settings />
                            Admin Dashboard
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    </SidebarMenu>
                </>
            )}
            <Separator />
            <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <div className="flex items-center gap-3 p-2">
                    <DialogTrigger asChild>
                        <SidebarMenuButton className="flex-1 justify-start">
                           <UserIcon />
                           Account
                        </SidebarMenuButton>
                    </DialogTrigger>
                    <Button onClick={onLogout} variant="ghost" size="icon">
                        <LogOut className="h-5 w-5"/>
                        <span className="sr-only">Log out</span>
                    </Button>
                </div>
                {isProfileOpen && (
                    <ProfileDialog 
                        session={session} 
                        onOpenChange={setIsProfileOpen}
                        onUpdate={() => {
                            onUpdate(); // Call parent's update function
                            setIsProfileOpen(false); // Close dialog on success
                        }}
                    />
                )}
            </Dialog>
        </>
    );
};

export default UserPanel;
