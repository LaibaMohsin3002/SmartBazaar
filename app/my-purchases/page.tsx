
// src/app/my-purchases/page.tsx

'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import type { Order, OrderDocument, OrderStatus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, Eye, X, Check, Truck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const translationKeys = [
    'My Purchases', 'Review your order history and track deliveries.', 'Product', 'Sold By', 'Date',
    'Quantity', 'Total Price', 'Status', 'You haven\'t made any purchases yet.',
    'When you do, they will appear here.', 'Explore Marketplace', 'Actions', 'View Details', 'Order Details', 'Order Summary',
    'Ongoing Orders', 'Purchase History', 'Cancelled', 'Rejected'
];

const statusStyles: { [key: string]: string } = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    accepted: 'bg-blue-100 text-blue-800 border-blue-300',
    dispatched: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    in_warehouse: 'bg-purple-100 text-purple-800 border-purple-300',
    out_for_delivery: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    delivered: 'bg-green-100 text-green-800 border-green-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-300',
}

const OrderTable = ({ orders, isLoading, t }: { orders: Order[], isLoading: boolean, t: (key: string) => string }) => {
    if (isLoading) {
        return <PurchasesLoadingSkeleton />;
    }

    if (orders.length === 0) {
        return (
             <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium mt-4">No orders in this category.</h3>
                <p className="text-sm text-muted-foreground mt-1">Your orders will appear here.</p>
            </div>
        )
    }

    return (
        <>
            <div className="hidden md:block border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('Product')}</TableHead>
                            <TableHead>{t('Sold By')}</TableHead>
                            <TableHead className="text-right">{t('Date')}</TableHead>
                            <TableHead className="text-right">{t('Quantity')}</TableHead>
                            <TableHead>{t('Status')}</TableHead>
                            <TableHead className="text-right">{t('Total Price')}</TableHead>
                            <TableHead className="text-center">{t('Actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="font-medium">{order.cropName}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={order.farmerInfo.avatarUrl} />
                                            <AvatarFallback>{order.farmerInfo.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{order.farmerInfo.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">{order.createdAt.toDate().toLocaleDateString()}</TableCell>
                                <TableCell className="text-right">
                                    {order.quantity} {order.unit}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn("capitalize", statusStyles[order.status])}>
                                        {order.status.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                    PKR {order.totalPrice.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <Eye className="h-4 w-4"/>
                                                <span className="sr-only">{t('View Details')}</span>
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>{t('Order Details')}</DialogTitle>
                                                <DialogDescription>
                                                   ID: {order.id}
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="font-medium">{t('Order Summary')}</h4>
                                                    <Separator className="my-2" />
                                                    <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span>Subtotal:</span>
                                                            <span>PKR {(order.subtotal || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Delivery Fee:</span>
                                                            <span>PKR {order.deliveryCharge.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between font-bold">
                                                            <span>You Paid:</span>
                                                            <span>PKR {order.totalPrice.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="font-medium">Farmer's Earnings</h4>
                                                     <Separator className="my-2" />
                                                      <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span>Sale Subtotal:</span>
                                                            <span>PKR {(order.subtotal || 0).toLocaleString()}</span>
                                                        </div>
                                                         <div className="flex justify-between text-muted-foreground">
                                                            <span>Platform Commission (2%):</span>
                                                            <span>- PKR {(order.commission || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between font-bold">
                                                            <span>Farmer Payout:</span>
                                                            <span>PKR {(order.farmerEarning || 0).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="md:hidden space-y-4">
                {orders.map((order) => (
                    <Card key={order.id}>
                        <CardContent className="p-4 space-y-4">
                             <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold">{order.cropName}</p>
                                    <p className="text-sm text-muted-foreground">{order.createdAt.toDate().toLocaleDateString()}</p>
                                </div>
                                <Badge variant="outline" className={cn("capitalize whitespace-nowrap", statusStyles[order.status])}>
                                    {order.status.replace('_', ' ')}
                                </Badge>
                             </div>
                             <div className="flex justify-between items-center border-t pt-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">{t('Total Price')}</p>
                                    <p className="font-bold text-lg">PKR {order.totalPrice.toLocaleString()}</p>
                                </div>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <Eye className="mr-2 h-4 w-4"/>
                                            {t('View Details')}
                                        </Button>
                                    </DialogTrigger>
                                     <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>{t('Order Details')}</DialogTitle>
                                            <DialogDescription>
                                                ID: {order.id}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            {/* Dialog content is same as above, so it could be a shared component */}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                             </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </>
    )
}


const PurchasesLoadingSkeleton = () => (
    <div className="space-y-4">
        <div className="border rounded-lg">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                        <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                        <TableHead className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableHead>
                        <TableHead className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableHead>
                        <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                        <TableHead className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => (
                         <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-5 w-24" /></div></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </div>
);


export default function MyPurchasesPage() {
    const { user } = useUser();
    const { db } = useFirebase();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const t = useLanguage().manageTranslations(translationKeys);

    useEffect(() => {
        if (!user || !db) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('buyerId', '==', user.uid), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ordersData = snapshot.docs.map(orderDoc => {
                const data = orderDoc.data() as OrderDocument;
                return {
                    id: orderDoc.id,
                    ...data,
                    createdAt: data.createdAt,
                } as Order;
            });

            setOrders(ordersData);
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

    const ongoingStatuses: OrderStatus[] = ['pending', 'accepted', 'dispatched', 'in_warehouse', 'out_for_delivery'];
    const historyStatuses: OrderStatus[] = ['delivered', 'cancelled', 'rejected'];

    const ongoingOrders = useMemo(() => orders.filter(o => ongoingStatuses.includes(o.status)), [orders]);
    const purchaseHistory = useMemo(() => orders.filter(o => historyStatuses.includes(o.status)), [orders]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight font-headline">{t('My Purchases')}</h1>
        <p className="text-muted-foreground mt-2">{t('Review your order history and track deliveries.')}</p>
      </div>

       {isLoading ? (
            <PurchasesLoadingSkeleton />
        ) : orders.length === 0 ? (
            <div className="text-center py-24 border-2 border-dashed rounded-lg">
                <ShoppingBag className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="text-xl font-medium mt-4">{t('You haven\'t made any purchases yet.')}</h3>
                <p className="text-md text-muted-foreground mt-2">{t('When you do, they will appear here.')}</p>
                <Button asChild className="mt-6">
                    <Link href="/">{t('Explore Marketplace')}</Link>
                </Button>
            </div>
        ) : (
            <Tabs defaultValue="ongoing">
                <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
                    <TabsTrigger value="ongoing">{t('Ongoing Orders')}</TabsTrigger>
                    <TabsTrigger value="history">{t('Purchase History')}</TabsTrigger>
                </TabsList>
                <TabsContent value="ongoing">
                    <Card>
                         <CardContent className="p-0 md:p-6 pt-6">
                            <OrderTable orders={ongoingOrders} isLoading={isLoading} t={t} />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="history">
                     <Card>
                        <CardContent className="p-0 md:p-6 pt-6">
                             <OrderTable orders={purchaseHistory} isLoading={isLoading} t={t} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        )}
    </div>
  );
}

    