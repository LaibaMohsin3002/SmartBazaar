
'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import type { Order, OrderDocument } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { History, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SalesHistoryLoadingSkeleton = () => (
    <>
    <div className="hidden md:block border rounded-lg">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                    <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                    <TableHead className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableHead>
                    <TableHead className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableHead>
                    <TableHead className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {[...Array(5)].map((_, i) => (
                     <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-5 w-24" /></div></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
    <div className="md:hidden space-y-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
    </>
);

const translationKeys = [
    'Sales History',
    'Review your past sales and earnings.',
    'Product',
    'Sold To',
    'Date',
    'Quantity',
    'Your Earning',
    'No sales recorded yet.',
    'Your sold listings will appear here.',
    'View My Listings'
];

export default function SalesHistoryPage() {
    const { user } = useUser();
    const { db } = useFirebase();
    const [sales, setSales] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const t = useLanguage().manageTranslations(translationKeys);

    useEffect(() => {
        if (!user || !db) return;

        setIsLoading(true);
        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef, 
            where('farmerId', '==', user.uid), 
            where('status', '==', 'delivered'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const salesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Order));

            setSales(salesData);
            setIsLoading(false);
        }, (error) => {
             const permissionError = new FirestorePermissionError({
                path: ordersRef.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, db]);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight font-headline">{t('Sales History')}</h1>
                <p className="text-muted-foreground mt-2">{t('Review your past sales and earnings.')}</p>
            </div>

            {isLoading ? (
                <SalesHistoryLoadingSkeleton />
            ) : sales.length > 0 ? (
                 <>
                    <div className="hidden md:block border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('Product')}</TableHead>
                                    <TableHead>{t('Sold To')}</TableHead>
                                    <TableHead className="text-right">{t('Date')}</TableHead>
                                    <TableHead className="text-right">{t('Quantity')}</TableHead>
                                    <TableHead className="text-right">{t('Your Earning')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sales.map((sale) => (
                                    <TableRow key={sale.id}>
                                        <TableCell className="font-medium">{sale.cropName}</TableCell>
                                        <TableCell>
                                             <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={sale.buyerInfo.avatarUrl} />
                                                    <AvatarFallback>{sale.buyerInfo.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{sale.buyerInfo.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">{sale.createdAt.toDate().toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline">{sale.quantity} {sale.unit}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-green-600">
                                            PKR {sale.farmerEarning.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     <div className="md:hidden space-y-4">
                        {sales.map((sale) => (
                            <Card key={sale.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>{sale.cropName}</CardTitle>
                                            <CardDescription>
                                                {sale.quantity} {sale.unit} - {sale.createdAt.toDate().toLocaleDateString()}
                                            </CardDescription>
                                        </div>
                                         <p className="font-semibold text-lg text-green-600">PKR {sale.farmerEarning.toLocaleString()}</p>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                     <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={sale.buyerInfo.avatarUrl} />
                                            <AvatarFallback>{sale.buyerInfo.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Sold to</p>
                                            <p className="font-medium">{sale.buyerInfo.name}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            ) : (
                <div className="text-center py-24 border-2 border-dashed rounded-lg">
                    <History className="mx-auto h-16 w-16 text-muted-foreground" />
                    <h3 className="text-xl font-medium mt-4">{t('No sales recorded yet.')}</h3>
                    <p className="text-md text-muted-foreground mt-2">{t('Your sold listings will appear here.')}</p>
                    <Button asChild className="mt-6">
                        <Link href="/my-listings">{t('View My Listings')}</Link>
                    </Button>
                </div>
            )}
        </div>
    );
}

    