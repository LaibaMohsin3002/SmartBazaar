
'use client';
import { usePathname } from 'next/navigation';
import SiteHeader from '@/components/site-header';
import SiteSidebar from '@/components/site-sidebar';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';


function LoadingScreen() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Skeleton className="h-20 w-20 rounded-full" />
        </div>
    )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, data: userData } = useUser();
  const router = useRouter();

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
  
  // A public page is one that can be seen without a user.
  // The root page is public for non-logged-in users (landing page).
  const isPublicPage = isAuthPage || (pathname === '/' && !user);


  useEffect(() => {
    // If loading is done, there's no user, and they are on a protected page
    if (!isLoading && !user && !isPublicPage) {
      router.push('/login');
    }
     // If a user is logged in but on an auth page, redirect them.
     if (!isLoading && user && isAuthPage) {
        router.push(userData?.role === 'farmer' ? '/dashboard' : '/');
    }
  }, [user, isLoading, isPublicPage, isAuthPage, userData, router]);


  if (isLoading && !isPublicPage) {
    return <LoadingScreen />;
  }
  
  if(!user && !isPublicPage) {
    // This case handles when loading is finished, there's no user, and they're on a protected page.
    // It prevents flashing of protected content. The useEffect will handle the redirect.
    return <LoadingScreen />;
  }
  
  // Render landing page with no layout
  if (pathname === '/' && !user) {
    return <>{children}</>;
  }


  // If the user is on an auth page, show a centered layout without the sidebar
  if (isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 w-full">
      <div className="w-full max-w-md">
        {children}
      </div>
      </div>
    );
  }

  // This is the main authed layout with the sidebar for all other pages
  return (
    <div className="relative min-h-screen md:flex w-full">
      <SiteSidebar />
      <div className="flex flex-col w-full min-w-0">
        <SiteHeader />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-background/95">
          {children}
        </main>
      </div>
    </div>
  );
}
