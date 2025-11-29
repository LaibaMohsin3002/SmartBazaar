
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Leaf, Home, LineChart, MessageSquare, PlusCircle, ShoppingCart, Bookmark, List, History, ListOrdered, Bot, Newspaper } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useLanguage } from '@/context/language-context';

const translationKeys = [
    'Dashboard', 
    'Marketplace', 
    'My Listings',
    'Orders',
    'Sales History',
    'Messages', 
    'My Purchases', 
    'My Bookmarks', 
    'Create Listing',
    'AgroGuru AI',
    'Daily Reports',
];

export default function SiteSidebar() {
  const pathname = usePathname();
  const { data: userData } = useUser();
  const t = useLanguage().manageTranslations(translationKeys);
  
  const userRole = userData?.role || 'buyer';

  const farmerMenuItems = [
    { href: '/dashboard', label: t('Dashboard'), icon: LineChart },
    { href: '/my-listings', label: t('My Listings'), icon: List },
    { href: '/orders', label: t('Orders'), icon: ListOrdered },
    { href: '/sales-history', label: t('Sales History'), icon: History },
    { href: '/reports', label: t('Daily Reports'), icon: Newspaper },
    { href: '/agroguru', label: t('AgroGuru AI'), icon: Bot },
    { href: '/chat', label: t('Messages'), icon: MessageSquare },
  ];

  const buyerMenuItems = [
      { href: '/', label: t('Marketplace'), icon: Home },
      { href: '/my-purchases', label: t('My Purchases'), icon: ShoppingCart },
      { href: '/my-bookmarks', label: t('My Bookmarks'), icon: Bookmark },
      { href: '/chat', label: t('Messages'), icon: MessageSquare },
  ];

  const menuItems = userRole === 'farmer' ? farmerMenuItems : buyerMenuItems;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href={userRole === 'farmer' ? '/my-listings' : '/'} aria-label="Home">
              <Leaf className="size-6 text-primary" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight text-foreground font-headline">SmartBazaar</h1>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {userRole === 'farmer' && (
            <SidebarMenuItem className='mb-2'>
                <SidebarMenuButton asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" isActive={pathname === '/sell'}>
                <Link href="/sell">
                    <PlusCircle />
                    <span>{t('Create Listing')}</span>
                </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={{ children: item.label, side: 'right' }}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {/* Can add footer content here if needed */}
      </SidebarFooter>
    </Sidebar>
  );
}
