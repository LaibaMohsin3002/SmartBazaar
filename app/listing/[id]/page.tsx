
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import type { Listing, ListingDocument, UserDocument } from '@/lib/types';
import { useLanguage } from '@/context/language-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, MapPin, MessageSquare, ShoppingCart, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const ListingDetailLoadingSkeleton = () => (
    <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div>
            <Skeleton className="aspect-video w-full rounded-lg" />
            <div className="mt-4 grid grid-cols-4 gap-2">
                <Skeleton className="aspect-square w-full rounded-md" />
                <Skeleton className="aspect-square w-full rounded-md" />
                <Skeleton className="aspect-square w-full rounded-md" />
                <Skeleton className="aspect-square w-full rounded-md" />
            </div>
        </div>
        <div className="space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-12 w-1/2" />
            <div className="space-y-2">
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-2/3" />
            </div>
            <Card>
                <CardHeader className="flex-row items-center gap-4">
                     <Skeleton className="h-12 w-12 rounded-full" />
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                     </div>
                </CardHeader>
            </Card>
            <div className="flex gap-4">
                 <Skeleton className="h-12 w-1/2" />
                 <Skeleton className="h-12 w-1/2" />
            </div>
        </div>
    </div>
);


export default function ListingDetailPage() {
    const { id: listingId } = useParams<{ id: string }>();
    const router = useRouter();
    const { db } = useFirebase();
    const { user } = useUser();
    const [listing, setListing] = useState<Listing | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const t = useLanguage().manageTranslations(['Contact', 'reviews', 'per']);

    useEffect(() => {
        if (!db || !listingId) return;

        const fetchListing = async () => {
            setIsLoading(true);
            try {
                const listingRef = doc(db, 'listings', listingId as string);
                const listingSnap = await getDoc(listingRef);

                if (!listingSnap.exists()) {
                    // Handle listing not found, maybe redirect to a 404 page
                    console.error("Listing not found");
                    setListing(null);
                    return;
                }

                const listingData = listingSnap.data() as ListingDocument;

                const farmerRef = doc(db, 'users', listingData.farmerId);
                const farmerSnap = await getDoc(farmerRef).catch(err => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: farmerRef.path, operation: 'get' }));
                    return null;
                });
                
                const farmerData = farmerSnap?.data() as UserDocument | undefined;

                const formattedListing: Listing = {
                    id: listingSnap.id,
                    farmer: {
                        uid: listingData.farmerId,
                        name: farmerData ? `${farmerData.firstName} ${farmerData.lastName}` : 'Verified Farmer',
                        avatarUrl: farmerData?.photoURL || '',
                        rating: farmerData?.rating || 0,
                        reviews: farmerData?.reviews || 0,
                    },
                    crop: {
                        name: listingData.cropName,
                        imageUrl: listingData.imageUrl,
                        imageHint: listingData.imageHint,
                    },
                    quantity: listingData.quantity,
                    unit: listingData.unit,
                    pricePerUnit: listingData.pricePerUnit,
                    location: listingData.location,
                    description: listingData.description,
                    createdAt: listingData.createdAt.toDate(),
                    status: listingData.status,
                };

                setListing(formattedListing);

            } catch (error) {
                console.error("Error fetching listing details:", error);
                 errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `listings/${listingId}`, operation: 'get' }));
            } finally {
                setIsLoading(false);
            }
        };

        fetchListing();
    }, [db, listingId]);


    if (isLoading) {
        return <ListingDetailLoadingSkeleton />;
    }

    if (!listing) {
        return (
             <div className="text-center py-24">
                <h1 className="text-2xl font-bold">Listing not found</h1>
                <p className="text-muted-foreground mt-2">The product you are looking for does not exist.</p>
                <Button asChild className="mt-6">
                    <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to Marketplace</Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-8">
             <Button variant="outline" onClick={() => router.back()} className="mb-8">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Listings
            </Button>
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                <div className="grid gap-4">
                    <div className="aspect-video w-full relative overflow-hidden rounded-lg border">
                        <Image
                            src={listing.crop.imageUrl}
                            alt={listing.crop.name}
                            fill
                            className="object-cover"
                            data-ai-hint={listing.crop.imageHint}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-6">
                     <div>
                        <Badge variant={listing.status === 'active' ? 'secondary' : 'default'} className={listing.status === 'sold' ? 'bg-destructive' : ''}>
                            {listing.status}
                        </Badge>
                        <h1 className="text-3xl lg:text-4xl font-bold font-headline mt-2">{listing.crop.name}</h1>
                        <div className="flex items-center gap-2 text-muted-foreground mt-2">
                            <MapPin className="h-4 w-4" />
                            <span>{listing.location}</span>
                        </div>
                     </div>
                     
                     <div className="text-4xl font-bold text-primary font-headline">
                        PKR {listing.pricePerUnit.toFixed(2)}
                        <span className="text-xl font-normal text-muted-foreground"> / {listing.unit}</span>
                     </div>
                     
                     {listing.description && (
                        <div>
                            <h2 className="text-lg font-semibold mb-2">About this produce</h2>
                            <p className="text-muted-foreground">{listing.description}</p>
                        </div>
                     )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Sold by</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center gap-4">
                            <Avatar className="h-14 w-14">
                                <AvatarImage src={listing.farmer.avatarUrl} />
                                <AvatarFallback>{listing.farmer.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold">{listing.farmer.name}</p>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Star className="h-4 w-4 fill-accent text-accent" />
                                    <span>{listing.farmer.rating.toFixed(1)} ({listing.farmer.reviews} {t('reviews')})</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    {listing.status === 'active' && user?.uid !== listing.farmer.uid && (
                        <div className="flex flex-col sm:flex-row gap-4">
                             <Button size="lg" className="flex-1" asChild>
                                <Link href={`/purchase/${listing.id}`}>
                                    <ShoppingCart className="mr-2 h-5 w-5"/>
                                    {t('Buy Now')}
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" asChild className="flex-1">
                                <Link href={`/chat?with=${listing.farmer.uid}`}>
                                    <MessageSquare className="mr-2 h-5 w-5"/>
                                    {t('Contact')}
                                </Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
