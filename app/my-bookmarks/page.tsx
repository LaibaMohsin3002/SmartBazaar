
'use client';
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import type { Listing, ListingDocument, UserDocument } from '@/lib/types';
import { ProductCard } from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bookmark } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const BookmarksLoadingSkeleton = () => (
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
    'My Bookmarks',
    'Your saved listings for future reference.',
    'You haven\'t bookmarked any items yet.',
    'Click the star icon on a listing to save it here.',
    'Explore Marketplace',
    'Contact'
];

export default function MyBookmarksPage() {
    const { user } = useUser();
    const { db } = useFirebase();
    const [bookmarkedListings, setBookmarkedListings] = useState<Listing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const t = useLanguage().manageTranslations(translationKeys);

    useEffect(() => {
        if (!user || !db) {
            setIsLoading(false);
            return;
        };
        
        setIsLoading(true);
        const bookmarksRef = collection(db, 'users', user.uid, 'bookmarks');
        const q = query(bookmarksRef, orderBy('bookmarkedAt', 'desc'));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const bookmarkDocs = snapshot.docs;

            try {
                const listingsPromises = bookmarkDocs.map(async (bookmarkDoc) => {
                    const bookmarkData = bookmarkDoc.data();
                    const listingRef = doc(db, 'listings', bookmarkData.listingId);
                    
                    const listingSnap = await getDoc(listingRef).catch(serverError => {
                        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: listingRef.path, operation: 'get' }));
                        throw serverError; // Prevent further processing
                    });

                    if (!listingSnap.exists()) {
                        return null;
                    }

                    const listingData = listingSnap.data() as ListingDocument;
                    const farmerDocRef = doc(db, 'users', listingData.farmerId);
                    
                    const farmerDocSnap = await getDoc(farmerDocRef).catch(serverError => {
                        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: farmerDocRef.path, operation: 'get' }));
                        // Don't throw, allow fallback
                        return null;
                    });

                    const farmerData = farmerDocSnap?.data() as UserDocument | undefined;

                    return {
                        id: listingSnap.id,
                        farmer: {
                            uid: listingData.farmerId,
                            name: farmerData ? `${farmerData.firstName} ${farmerData.lastName}` : 'Unknown Farmer',
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
                });
                
                const listings = await Promise.all(listingsPromises);
                setBookmarkedListings(listings.filter((l): l is Listing => l !== null));

            } catch (error) {
                 // Errors from getDoc are now caught and emitted, so we just log other potential errors.
                console.error("An unexpected error occurred while processing bookmarks:", error);
            } finally {
                setIsLoading(false);
            }
        }, (error) => {
            const permissionError = new FirestorePermissionError({
                path: bookmarksRef.path,
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
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight font-headline">{t('My Bookmarks')}</h1>
                <p className="text-muted-foreground mt-2">{t('Your saved listings for future reference.')}</p>
            </div>

            {isLoading ? (
                 <BookmarksLoadingSkeleton />
            ) : bookmarkedListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {bookmarkedListings.map(listing => (
                        <ProductCard key={listing.id} listing={listing} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 border-2 border-dashed rounded-lg">
                    <Bookmark className="mx-auto h-16 w-16 text-muted-foreground" />
                    <h3 className="text-xl font-medium mt-4">{t('You haven\'t bookmarked any items yet.')}</h3>
                    <p className="text-md text-muted-foreground mt-2">{t('Click the star icon on a listing to save it here.')}</p>
                    <Button asChild className="mt-6">
                        <Link href="/">{t('Explore Marketplace')}</Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
