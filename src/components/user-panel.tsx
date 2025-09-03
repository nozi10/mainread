
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, LogOut } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import type { UserSession } from '@/lib/db';

type UserPanelProps = {
    session: UserSession;
    onLogout: () => void;
};

const UserPanel: React.FC<UserPanelProps> = ({ session, onLogout }) => {
    const router = useRouter();

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
            <div className="flex items-center gap-3 p-2">
                <button onClick={() => router.push('/profile')} className="flex-shrink-0">
                    <Avatar>
                        <AvatarImage src={session.avatarUrl || undefined} data-ai-hint="user avatar" />
                        <AvatarFallback>{session.name?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                </button>
                <div className="flex-1 overflow-hidden">
                    <button onClick={() => router.push('/profile')} className="w-full text-left">
                        <p className="text-sm font-medium truncate hover:underline">{session.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{session.email}</p>
                    </button>
                </div>
                <Button onClick={onLogout} variant="ghost" size="icon">
                    <LogOut className="h-5 w-5"/>
                    <span className="sr-only">Log out</span>
                </Button>
            </div>
        </>
    );
};

export default UserPanel;
