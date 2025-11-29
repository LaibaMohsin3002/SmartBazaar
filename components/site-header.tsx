
'use client';

import Link from 'next/link';
import { User, LogOut, Bell, MessageSquare, Package } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import LanguageSwitcher from './language-switcher';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { getAuth, signOut } from 'firebase/auth';
import { useFirebase } from '@/firebase';
import { useLanguage } from '@/context/language-context';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const translationKeys = ['Profile', 'Logout', 'Login', 'Notifications', 'No new notifications'];


const NotificationIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'new_message': return <MessageSquare className="h-4 w-4 text-blue-500" />;
        case 'order_update': return <Package className="h-4 w-4 text-green-500" />;
        case 'new_order': return <Package className="h-4 w-4 text-yellow-500" />;
        default: return <Bell className="h-4 w-4 text-gray-500" />;
    }
}

export default function SiteHeader() {
  const router = useRouter();
  const { app } = useFirebase();
  const { user, claims, isLoading, data: userData } = useUser();
  const { notifications, unreadCount, markNotificationsAsRead } = useNotifications();
  const t = useLanguage().manageTranslations(translationKeys);

  const handleLogout = async () => {
    if (!app) return;
    const auth = getAuth(app);
    await signOut(auth);
    router.push('/login');
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && unreadCount > 0) {
        const notifIds = notifications.filter(n => !n.isRead).map(n => n.id);
        markNotificationsAsRead(notifIds);
    }
  }

  const userRole = userData?.role || 'buyer';
  const userName = user ? (user.displayName || user.email) : 'Guest';
  const userAvatarUrl = user?.photoURL;

  if (isLoading) {
      return (
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
            <SidebarTrigger className="shrink-0" />
            <div className="flex-1"></div>
             <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-muted animate-pulse"></div>
            </div>
        </header>
      )
  }


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      <SidebarTrigger className="shrink-0" />
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        {user && (
            <Popover onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{unreadCount}</Badge>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                    <div className="p-4">
                        <h3 className="text-lg font-medium">{t('Notifications')}</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map(notif => (
                                <Link href={notif.link} key={notif.id}>
                                    <div className={cn("flex items-start gap-4 p-4 hover:bg-muted/50", !notif.isRead && "bg-blue-50")}>
                                         <NotificationIcon type={notif.type} />
                                         <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium leading-none">{notif.title}</p>
                                            <p className="text-sm text-muted-foreground">{notif.message}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <p className="p-4 text-center text-sm text-muted-foreground">{t('No new notifications')}</p>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        )}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Avatar className="h-9 w-9">
                  {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt="User Avatar" />}
                  <AvatarFallback>{userName?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p>{userName}</p>
                <p className="text-xs font-normal text-muted-foreground capitalize">{userRole}</p>
                </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile"><User className="mr-2 h-4 w-4" /><span>{t('Profile')}</span></Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t('Logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild>
            <Link href="/login">{t('Login')}</Link>
          </Button>
        )}
      </div>
    </header>
  );
}