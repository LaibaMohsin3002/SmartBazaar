
'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import type { Listing, ListingDocument } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { List, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


const FarmerProductCard = ({ listing, className }: { listing: Listing, className?: string }) => {
    if (!listing) {
      return null;
    }
  
    return (
      <Card className={cn("w-full overflow-hidden transition-all hover:shadow-accent/20 hover:shadow-lg", className)}>
        <CardHeader className="p-0">
            <div className="relative aspect-[4/3] w-full">
                <Image
                    src={listing.crop.imageUrl}
                    alt={listing.crop.name}
                    fill
                    className="object-cover"
                    data-ai-hint={listing.crop.imageHint}
                />
            </div>
        </CardHeader>
        <CardContent className="p-4 grid gap-2">
            <h3 className="text-lg font-bold font-headline leading-tight">
                {listing.crop.name}
            </h3>
             <p className="text-sm text-muted-foreground">{listing.location}</p>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex justify-between items-center">
            <div className="text-xl font-bold text-primary font-headline">
                PKR {listing.pricePerUnit.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ {listing.unit}</span>
            </div>
            <Badge variant="outline" className="whitespace-nowrap shrink-0">
                {listing.quantity} {listing.unit}
            </Badge>
        </CardFooter>
      </Card>
    );
}


const MyListingsLoadingSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
        ))}
    </div>
);

const translationKeys = [
    'My Active Listings',
    'Manage your current produce listings.',
    'You have no active listings.',
    'Create your first listing to start selling.',
    'Create Listing'
];

export default function MyListingsPage() {
    const { user } = useUser();
    const { db } = useFirebase();
    const [myListings, setMyListings] = useState<Listing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const t = useLanguage().manageTranslations(translationKeys);

    useEffect(() => {
        if (!user || !db) return;
        
        setIsLoading(true);
        const listingsRef = collection(db, 'listings');
        // Query for listings created by the current farmer that are not sold or expired
        const q = query(listingsRef, where('farmerId', '==', user.uid), where('status', '==', 'active'));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const listingsData: Listing[] = snapshot.docs.map(docSnap => {
                 const data = docSnap.data() as ListingDocument;
                 return {
                    id: docSnap.id,
                     farmer: {
                        uid: user.uid,
                        name: user.displayName || 'Me',
                        avatarUrl: user.photoURL || '',
                        rating: 0,
                        reviews: 0,
                    },
                    crop: { name: data.cropName, imageUrl: data.imageUrl, imageHint: data.imageHint },
                    quantity: data.quantity,
                    unit: data.unit,
                    pricePerUnit: data.pricePerUnit,
                    location: data.location,
                    createdAt: data.createdAt.toDate(),
                    status: data.status,
                 }
            });
            
            setMyListings(listingsData);
            setIsLoading(false);
        }, (error) => {
            const permissionError = new FirestorePermissionError({
                path: listingsRef.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, db]);

    return (
        <div className="space-y-8">
             <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl lg:text-4xl font-bold tracking-tight font-headline">{t('My Active Listings')}</h1>
                    <p className="text-muted-foreground mt-2">{t('Manage your current produce listings.')}</p>
                </div>
                <Button asChild className="shrink-0">
                    <Link href="/sell"><PlusCircle className="mr-2 h-4 w-4"/> {t('Create Listing')}</Link>
                </Button>
            </div>

            {isLoading ? (
                 <MyListingsLoadingSkeleton />
            ) : myListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {myListings.map(listing => (
                        <FarmerProductCard key={listing.id} listing={listing} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 border-2 border-dashed rounded-lg">
                    <List className="mx-auto h-16 w-16 text-muted-foreground" />
                    <h3 className="text-xl font-medium mt-4">{t('You have no active listings.')}</h3>
                    <p className="text-md text-muted-foreground mt-2">{t('Create your first listing to start selling.')}</p>
                    <Button asChild className="mt-6">
                        <Link href="/sell"><PlusCircle className="mr-2 h-4 w-4"/> {t('Create Listing')}</Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
