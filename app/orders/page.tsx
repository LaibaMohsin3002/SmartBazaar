
// src/app/orders/page.tsx

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc, updateDoc, serverTimestamp, orderBy, addDoc, runTransaction, increment } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import type { Order, OrderDocument, OrderStatus, ListingDocument } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageCheck, PackageX, ListOrdered, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const translationKeys = [
    'Manage Orders', 'Review, accept, and track all your orders.', 'Pending Approval', 'All Orders', 'Buyer',
    'Product', 'Total', 'Date', 'Status', 'Actions', 'No pending orders right now.', 'No orders found.',
    'Accept', 'Reject', 'Update Status', 'pending', 'accepted', 'rejected', 'dispatched', 'in_warehouse',
    'out_for_delivery', 'delivered'
];

const statusStyles: { [key in OrderStatus]: string } = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    accepted: 'bg-blue-100 text-blue-800 border-blue-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
    dispatched: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    in_warehouse: 'bg-purple-100 text-purple-800 border-purple-300',
    out_for_delivery: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    delivered: 'bg-green-100 text-green-800 border-green-300',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-300',
};

const OrderTableSkeleton = () => (
     <div className="hidden md:block border rounded-lg">
        <Table>
            <TableHeader>
                <TableRow>
                    {[...Array(6)].map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-24" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {[...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-5 w-24" /></div></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-9 w-24" /></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
     </div>
);

const statusUpdateOptions: OrderStatus[] = ['dispatched', 'in_warehouse', 'out_for_delivery', 'delivered'];

const OrderRow = ({ order, onUpdateStatus, t }: { order: Order, onUpdateStatus: (id: string, status: OrderStatus) => void, t: (key: string) => string }) => (
    <TableRow key={order.id} className="hidden md:table-row">
        <TableCell>
             <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={order.buyerInfo.avatarUrl} />
                    <AvatarFallback>{order.buyerInfo.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{order.buyerInfo.name}</span>
            </div>
        </TableCell>
        <TableCell>
            <div className="font-medium">{order.cropName}</div>
            <div className="text-sm text-muted-foreground">{order.quantity} {order.unit}</div>
        </TableCell>
        <TableCell>
            <div className="font-semibold text-green-600">
                PKR {order.farmerEarning.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">after 2% commission</div>
        </TableCell>
        <TableCell className="text-right text-muted-foreground">{order.createdAt.toDate().toLocaleDateString()}</TableCell>
        <TableCell>
            <Badge variant="outline" className={cn("capitalize whitespace-nowrap", statusStyles[order.status])}>
                <Truck className="mr-1.5 h-3 w-3" />
                {t(order.status) || order.status.replace('_', ' ')}
            </Badge>
        </TableCell>
        <TableCell className="text-right">
            {order.status === 'pending' ? (
                <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => onUpdateStatus(order.id, 'accepted')}>
                        <PackageCheck className="mr-2 h-4 w-4"/>
                        {t('Accept')}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onUpdateStatus(order.id, 'rejected')}>
                         <PackageX className="mr-2 h-4 w-4"/>
                         {t('Reject')}
                    </Button>
                </div>
            ) : order.status !== 'rejected' && order.status !== 'cancelled' && order.status !== 'delivered' ? (
                <Select onValueChange={(newStatus: OrderStatus) => onUpdateStatus(order.id, newStatus)}>
                    <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder={t('Update Status')} />
                    </SelectTrigger>
                    <SelectContent>
                        {statusUpdateOptions.map(status => (
                            <SelectItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                <span className="text-sm text-muted-foreground">No actions</span>
            )}
        </TableCell>
    </TableRow>
);

const OrderCard = ({ order, onUpdateStatus, t }: { order: Order, onUpdateStatus: (id: string, status: OrderStatus) => void, t: (key: string) => string }) => (
    <Card className="md:hidden">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
             <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={order.buyerInfo.avatarUrl} />
                    <AvatarFallback>{order.buyerInfo.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{order.buyerInfo.name}</p>
                   <p className="text-sm text-muted-foreground">{order.createdAt.toDate().toLocaleDateString()}</p>
                </div>
            </div>
            <Badge variant="outline" className={cn("capitalize", statusStyles[order.status])}>
                {t(order.status) || order.status.replace('_', ' ')}
            </Badge>
        </CardHeader>
        <CardContent className="space-y-4 pb-4">
             <div>
                <p className="font-medium">{order.cropName}</p>
                <p className="text-sm text-muted-foreground">{order.quantity} {order.unit}</p>
            </div>
             <div className="flex justify-between items-center text-sm border-t pt-2">
                 <p className="text-muted-foreground">Your Earning:</p>
                <p className="font-semibold text-lg text-green-600">PKR {order.farmerEarning.toLocaleString()}</p>
            </div>
        </CardContent>
         <CardFooter>
             {order.status === 'pending' ? (
                <div className="flex gap-2 w-full">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => onUpdateStatus(order.id, 'accepted')}>
                        <PackageCheck className="mr-2 h-4 w-4"/>
                        {t('Accept')}
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => onUpdateStatus(order.id, 'rejected')}>
                         <PackageX className="mr-2 h-4 w-4"/>
                         {t('Reject')}
                    </Button>
                </div>
            ) : order.status !== 'rejected' && order.status !== 'cancelled' && order.status !== 'delivered' ? (
                <Select onValueChange={(newStatus: OrderStatus) => onUpdateStatus(order.id, newStatus)}>
                    <SelectTrigger className="w-full h-9">
                        <SelectValue placeholder={t('Update Status')} />
                    </SelectTrigger>
                    <SelectContent>
                        {statusUpdateOptions.map(status => (
                            <SelectItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                <span className="text-sm text-muted-foreground w-full text-center">No actions available</span>
            )}
        </CardFooter>
    </Card>
)

export default function OrdersPage() {
    const { user } = useUser();
    const { db } = useFirebase();
    const { toast } = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const t = useLanguage().manageTranslations(translationKeys);

    useEffect(() => {
        if (!user || !db) return;

        setIsLoading(true);
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('farmerId', '==', user.uid), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setOrders([]);
                setIsLoading(false);
                return;
            }
            
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
            console.error("Error fetching orders:", error);
            const permissionError = new FirestorePermissionError({
                path: ordersRef.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, db]);

    const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
        if (!db || !user) return;
        
        const orderRef = doc(db, 'orders', orderId);
    
        try {
            await runTransaction(db, async (transaction) => {
                const orderSnap = await transaction.get(orderRef);
                if (!orderSnap.exists()) {
                    throw new Error("Order not found");
                }
                const orderData = orderSnap.data() as OrderDocument;
    
                // --- Restore quantity if order is rejected ---
                if (newStatus === 'rejected') {
                    const listingRef = doc(db, 'listings', orderData.listingId);
                    const listingSnap = await transaction.get(listingRef);
    
                    if (listingSnap.exists()) {
                        transaction.update(listingRef, { 
                            quantity: increment(orderData.quantity),
                            // If the listing was marked 'sold' because this was the last of the stock, revert it to 'active'
                            status: 'active'
                        });
                    }
                }
    
                // --- Update order status ---
                transaction.update(orderRef, { status: newStatus });
    
                // --- Create notification for the buyer ---
                const notificationRef = doc(collection(db, 'users', orderData.buyerId, 'notifications'));
                const notifData = {
                    userId: orderData.buyerId,
                    type: 'order_update' as const,
                    title: `Order Status: ${newStatus.replace('_', ' ')}`,
                    message: `Your order for ${orderData.cropName} has been updated.`,
                    link: `/my-purchases`,
                    isRead: false,
                    createdAt: serverTimestamp(),
                };
                transaction.set(notificationRef, notifData);
            });
    
            toast({
                title: 'Order Status Updated',
                description: `Order has been marked as ${newStatus.replace('_', ' ')}.`,
            });
    
        } catch (error: any) {
            console.error("Error updating order status:", error);
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: error.message || 'Could not update the order status.',
            });
        }
    };

    const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending'), [orders]);
    
    const renderOrderList = (orderList: Order[], emptyMessage: string, emptySubMessage: string) => {
        if (isLoading) {
            return (
                <>
                    <OrderTableSkeleton />
                    <div className="space-y-4 md:hidden">
                        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
                    </div>
                </>
            )
        }
        if (orderList.length === 0) {
            return (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <ListOrdered className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="text-lg font-medium mt-4">{emptyMessage}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{emptySubMessage}</p>
                </div>
            )
        }
        return (
            <>
                <div className="hidden md:block border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('Buyer')}</TableHead>
                                <TableHead>{t('Product')}</TableHead>
                                <TableHead>Your Earning</TableHead>
                                <TableHead className="text-right">{t('Date')}</TableHead>
                                <TableHead>{t('Status')}</TableHead>
                                <TableHead className="text-right w-[240px]">{t('Actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orderList.map(order => <OrderRow key={order.id} order={order} onUpdateStatus={handleUpdateStatus} t={t} />)}
                        </TableBody>
                    </Table>
                </div>
                <div className="space-y-4 md:hidden">
                    {orderList.map(order => <OrderCard key={order.id} order={order} onUpdateStatus={handleUpdateStatus} t={t} />)}
                </div>
            </>
        )
    };


    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight font-headline">{t('Manage Orders')}</h1>
                <p className="text-muted-foreground mt-2">{t('Review, accept, and track all your orders.')}</p>
            </div>

            <Tabs defaultValue="pending">
                <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
                    <TabsTrigger value="pending">{t('Pending Approval')} <Badge className="ml-2">{pendingOrders.length}</Badge></TabsTrigger>
                    <TabsTrigger value="all">{t('All Orders')}</TabsTrigger>
                </TabsList>
                <TabsContent value="pending">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Orders</CardTitle>
                             <CardDescription>These are new orders from buyers that need your confirmation.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           {renderOrderList(pendingOrders, t('No pending orders right now.'), "New orders will appear here when a buyer makes a purchase.")}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="all">
                     <Card>
                        <CardHeader>
                            <CardTitle>Order History</CardTitle>
                            <CardDescription>A complete log of all orders, including pending, completed, and rejected ones.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {renderOrderList(orders, t('No orders found.'), "Your order history is currently empty.")}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

    