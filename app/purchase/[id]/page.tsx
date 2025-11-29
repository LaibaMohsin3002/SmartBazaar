
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, writeBatch, serverTimestamp, collection, addDoc, Timestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import type { Listing, ListingDocument, UserDocument, OrderDocument } from '@/lib/types';
import { useLanguage } from '@/context/language-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, ShoppingCart, CheckCircle, Truck, Info } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const PurchaseLoadingSkeleton = () => (
    <Card className="max-w-2xl mx-auto">
        <CardHeader>
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex gap-4">
                <Skeleton className="w-24 h-24 rounded-md" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/3" />
                </div>
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
        </CardContent>
        <CardFooter>
            <Skeleton className="h-12 w-full" />
        </CardFooter>
    </Card>
);

export default function PurchasePage() {
    const { id: listingId } = useParams<{ id: string }>();
    const router = useRouter();
    const { db } = useFirebase();
    const { user, data: userData } = useUser();
    const { toast } = useToast();
    const [listing, setListing] = useState<Listing | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [purchaseComplete, setPurchaseComplete] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [orderId, setOrderId] = useState<string | null>(null);

    useEffect(() => {
        if (!db || !listingId) return;

        const fetchListing = async () => {
            setIsLoading(true);
            try {
                const listingRef = doc(db, 'listings', listingId as string);
                const listingSnap = await getDoc(listingRef);

                if (!listingSnap.exists()) {
                    toast({ variant: 'destructive', title: 'Listing not found' });
                    setListing(null);
                    return;
                }

                const listingData = listingSnap.data() as ListingDocument;
                
                if (listingData.status !== 'active') {
                    toast({ variant: 'destructive', title: 'Item unavailable', description: 'This item is already sold or expired.' });
                    router.push(`/listing/${listingId}`);
                    return;
                }

                const farmerRef = doc(db, 'users', listingData.farmerId);
                const farmerSnap = await getDoc(farmerRef).catch(() => null);
                const farmerData = farmerSnap?.data() as UserDocument | undefined;

                setListing({
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
                    createdAt: listingData.createdAt,
                    status: listingData.status,
                });

            } catch (error) {
                console.error("Error fetching listing:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load listing details.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchListing();
    }, [db, listingId, router, toast]);

    const handleConfirmPurchase = async () => {
        if (!user || !listing || quantity <= 0 || !db || !userData) return;

        if (quantity > listing.quantity) {
            toast({
                variant: 'destructive',
                title: 'Not enough stock',
                description: `You can only purchase up to ${listing.quantity} ${listing.unit}.`
            });
            return;
        }

        setIsProcessing(true);
        try {
            const deliveryCharge = 250; // Fixed delivery charge
            const subtotal = listing.pricePerUnit * quantity;
            const commission = subtotal * 0.02; // 2% platform commission
            const farmerEarning = subtotal - commission;
            const totalPrice = subtotal + deliveryCharge;
            
            const orderStatus = "pending";

            // Temporary console log for debugging
            console.log("Order being created:", {
              listingId: listing.id,
              buyerId: user.uid,
              farmerId: listing.farmer.uid,
              totalPrice: totalPrice,
              status: orderStatus,
              currentUser: user.uid
            });

            const batch = writeBatch(db);

            // 1. Create the new order document
            const orderRef = doc(collection(db, "orders"));
            setOrderId(orderRef.id);
            
            const orderData: Omit<OrderDocument, 'createdAt'> = {
                listingId: listing.id,
                buyerId: user.uid,
                farmerId: listing.farmer.uid,
                cropName: listing.crop.name,
                quantity: quantity,
                unit: listing.unit,
                pricePerUnit: listing.pricePerUnit,
                subtotal,
                deliveryCharge,
                commission,
                farmerEarning,
                totalPrice,
                status: orderStatus,
                farmerInfo: {
                    name: listing.farmer.name,
                    avatarUrl: listing.farmer.avatarUrl || "",
                },
                buyerInfo: {
                    name: `${userData.firstName} ${userData.lastName}`,
                    avatarUrl: userData.photoURL || "",
                },
                history: [
                    { status: "pending", timestamp: new Date() }
                ]
            };
            
            batch.set(orderRef, { ...orderData, createdAt: serverTimestamp() });

            // 2. Create notification for the farmer
            const notificationRef = doc(collection(db, "users", listing.farmer.uid, "notifications"));
            const notificationData = {
                userId: listing.farmer.uid,
                type: "new_order",
                title: "New Order Received!",
                message: `${userData.firstName} placed an order for ${quantity} ${listing.unit} of ${listing.crop.name}.`,
                link: `/orders`,
                isRead: false,
                createdAt: serverTimestamp(),
            };
            batch.set(notificationRef, notificationData);

            // 3. Update the listing quantity and status
            const listingRef = doc(db, "listings", listing.id);
            const newListingQuantity = listing.quantity - quantity;
            const newListingStatus = newListingQuantity <= 0 ? "sold" : "active";
            
            batch.update(listingRef, {
                quantity: newListingQuantity,
                status: newListingStatus,
            });

            await batch.commit();

            setPurchaseComplete(true);
            toast({
                title: 'Purchase Successful!',
                description: 'Your order has been placed and is pending farmer approval.',
            });

        } catch (error: any) {
            console.error("Purchase failed:", error);
            toast({
                variant: 'destructive',
                title: 'Purchase Failed',
                description: error.message || 'There was an error creating your order.',
            });
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'orders',
                operation: 'create',
            }));
        } finally {
            setIsProcessing(false);
        }
    };
    
    if (isLoading) {
        return <PurchaseLoadingSkeleton />;
    }

    if (!listing) {
        return (
             <div className="text-center py-24">
                <h1 className="text-2xl font-bold">Listing not found</h1>
                <p className="text-muted-foreground mt-2">The product you are looking for does not exist or is no longer available.</p>
                <Button asChild className="mt-6">
                    <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to Marketplace</Link>
                </Button>
            </div>
        )
    }
    
    const subtotal = quantity * listing.pricePerUnit;
    const deliveryCharge = 250; // This should ideally be dynamic
    const commission = subtotal * 0.02; // 2% platform commission
    const farmerEarning = subtotal - commission;
    const total = subtotal + deliveryCharge; // Buyer pays subtotal + delivery

    if (purchaseComplete) {
        return (
            <Card className="max-w-2xl mx-auto">
                <CardHeader className="items-center text-center">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                    <CardTitle className="text-2xl">Order Placed Successfully!</CardTitle>
                    <CardDescription>Your order is now pending approval from the farmer. You can track its status in your purchases.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md p-4 space-y-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Order ID:</span>
                            <span className="font-mono text-sm">{orderId}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Product:</span>
                            <span className="font-medium">{listing.crop.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Quantity:</span>
                            <span className="font-medium">{quantity} {listing.unit}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total Price:</span>
                            <span>PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex-col sm:flex-row gap-4">
                    <Button asChild className="w-full">
                        <Link href="/my-purchases">View My Purchases</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                         <Link href="/">Continue Shopping</Link>
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Confirm Your Purchase</CardTitle>
                <CardDescription>Review the item and confirm the quantity you wish to buy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/50">
                    <Image
                        src={listing.crop.imageUrl}
                        alt={listing.crop.name}
                        width={96}
                        height={96}
                        className="rounded-md object-cover aspect-square"
                    />
                    <div className="flex-1">
                        <h3 className="text-lg font-bold">{listing.crop.name}</h3>
                        <p className="text-sm text-muted-foreground">Sold by {listing.farmer.name}</p>
                        <p className="text-2xl font-bold mt-2 text-primary">
                            PKR {listing.pricePerUnit.toFixed(2)}
                            <span className="text-base font-normal text-muted-foreground"> / {listing.unit}</span>
                        </p>
                    </div>
                </div>

                <div className="grid w-full max-w-sm items-center gap-2">
                    <Label htmlFor="quantity">Quantity ({listing.unit})</Label>
                    <Input
                        id="quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        min="1"
                        max={listing.quantity}
                        className="text-lg"
                    />
                    <p className="text-sm text-muted-foreground">
                        {listing.quantity} {listing.unit} available
                    </p>
                </div>
                
                <Separator />

                <div>
                    <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
                    <div className="space-y-3 text-muted-foreground">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span className="font-medium text-foreground">PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="flex items-center gap-1.5"><Truck className="h-4 w-4" /> Delivery</span>
                            <span className="font-medium text-foreground">PKR {deliveryCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-1.5"><Info className="h-4 w-4" /> Platform Commission (2%)</span>
                            <span>PKR {commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                         <div className="flex justify-between text-sm">
                            <span>Farmer Earnings</span>
                            <span>PKR {farmerEarning.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <Separator className="my-4" />
                    <div className="flex justify-between text-xl font-bold">
                        <span>Total (incl. Delivery)</span>
                        <span>PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>

            </CardContent>
            <CardFooter className="flex-col gap-4">
                <Button 
                    size="lg" 
                    className="w-full" 
                    onClick={handleConfirmPurchase} 
                    disabled={isProcessing || quantity <= 0 || quantity > listing.quantity}
                >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                    Confirm Purchase
                </Button>
                 <Button variant="ghost" asChild>
                    <Link href={`/listing/${listingId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

    