
'use client';
import React, { useState, useEffect } from 'react';
import { doc, setDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';

import { useUser } from '@/firebase/auth/use-user';
import { useFirebase } from '@/firebase';
import { cn } from '@/lib/utils';
import type { Listing as ListingType } from '@/lib/types';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Bookmark, MapPin, MessageSquare, Star, ShoppingCart } from 'lucide-react';
import { Badge } from './ui/badge';
import { useLanguage } from '@/context/language-context';

export function ProductCard({ listing, className }: { listing: ListingType, className?: string }) {
  const { user } = useUser();
  const { db } = useFirebase();
  const t = useLanguage().manageTranslations(['Contact', 'Buy Now']);


  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    if (!user || !db || !listing) return;
    const checkIfBookmarked = async () => {
      const bookmarkRef = doc(db, 'users', user.uid, 'bookmarks', listing.id);
      try {
        const docSnap = await getDoc(bookmarkRef);
        setIsBookmarked(docSnap.exists());
      } catch (e) {
        console.error("Failed to check bookmark status:", e);
      }
    };
    checkIfBookmarked();
  }, [user, db, listing?.id]);

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event from bubbling up to parent Link
    if (!user || !db) {
      alert('You need to be logged in to bookmark items.');
      return;
    }
    
    setIsProcessing(true);
    const bookmarkRef = doc(db, 'users', user.uid, 'bookmarks', listing.id);

    try {
        if (isBookmarked) {
            await deleteDoc(bookmarkRef);
            setIsBookmarked(false);
        } else {
            await setDoc(bookmarkRef, {
                listingId: listing.id,
                bookmarkedAt: serverTimestamp(),
            });
            setIsBookmarked(true);
        }
    } catch (error) {
        console.error("Failed to toggle bookmark:", error);
        alert("There was an error updating your bookmark.");
    } finally {
        setIsProcessing(false);
    }
  };
  
  if (!listing) {
    return null;
  }

  return (
    <Card className={cn("w-full overflow-hidden transition-all hover:shadow-accent/20 hover:shadow-lg hover:-translate-y-1 flex flex-col", className)}>
      <CardHeader className="p-0">
        <Link href={`/listing/${listing.id}`} className="block">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={listing.crop.imageUrl}
              alt={listing.crop.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
             <Button 
                variant="secondary"
                className="absolute top-2 right-2 h-9 w-9 rounded-full bg-background/70 p-0 hover:bg-background/90"
                onClick={toggleBookmark}
                disabled={isProcessing}
                aria-label="Bookmark item"
              >
                <Bookmark className={cn("h-5 w-5 text-foreground", isBookmarked && "fill-amber-400 text-amber-500")} />
            </Button>
          </div>
        </Link>
      </CardHeader>
      <CardContent className="p-4 grid gap-2 flex-grow">
        <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-bold font-headline leading-tight">
                <Link href={`/listing/${listing.id}`}>{listing.crop.name}</Link>
            </h3>
            <Badge variant="outline" className="whitespace-nowrap shrink-0 mt-1">
                {listing.quantity} {listing.unit}
            </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 shrink-0" />
          <span>{listing.location}</span>
        </div>
        <div className="text-2xl font-bold text-primary font-headline">
          PKR {listing.pricePerUnit.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ {listing.unit}</span>
        </div>
      </CardContent>
       <CardFooter className="p-4 pt-0 mt-auto">
        {listing.farmer ? (
            <div className="w-full">
                <div className="flex justify-between items-center text-sm mb-4">
                    <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={listing.farmer.avatarUrl} alt={listing.farmer.name} />
                            <AvatarFallback>{listing.farmer.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                            <span className="font-medium">{listing.farmer.name}</span>
                            <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <Star className="w-3 h-3 fill-accent text-accent" />
                                <span className="font-semibold">{listing.farmer.rating.toFixed(1)}</span>
                                <span>({listing.farmer.reviews} reviews)</span>
                            </div>
                        </div>
                    </div>
                </div>
                 { user?.uid !== listing.farmer.uid && listing.status === 'active' && (
                    <div className="flex gap-2">
                         <Button asChild size="sm" className="flex-1">
                            <Link href={`/purchase/${listing.id}`}>
                                <ShoppingCart className="mr-2 h-4 w-4"/>
                                {t('Buy Now')}
                            </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="flex-1">
                            <Link href={`/chat?with=${listing.farmer.uid}`}>
                                <MessageSquare className="mr-2 h-4 w-4"/>
                                {t('Contact')}
                            </Link>
                        </Button>
                    </div>
                )}
            </div>
        ) : (
          <div className="flex items-center gap-2 text-sm w-full animate-pulse">
             <div className="h-8 w-8 rounded-full bg-muted"></div>
             <div className="grid gap-2 w-full">
                <div className="h-4 w-1/2 rounded-md bg-muted"></div>
                <div className="h-3 w-1/3 rounded-md bg-muted"></div>
             </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

// Re-adding the Card components here since they were removed from the original snippet
// and are necessary for the component to render.
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"
