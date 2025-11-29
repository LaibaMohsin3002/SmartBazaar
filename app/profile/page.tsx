
'use client';
import React, { useRef, useState, useEffect } from 'react';
import Image from "next/image";
import { Star, MapPin, Edit, PlusCircle, ShoppingBag, Camera, Loader2, List, Leaf, Droplets, ListTree } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Listing, ListingDocument, UserDocument } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import Link from "next/link";
import { useUser } from '@/firebase/auth/use-user';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/language-context';

const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        throw new Error('Image upload failed');
    }

    const data = await res.json();
    return data.secure_url;
}


const ProfileLoadingSkeleton = () => (
    <div className="space-y-8">
        <Card>
            <CardContent className="p-6">
                 <div className="flex flex-col md:flex-row items-start gap-6">
                    <Skeleton className="w-24 h-24 md:w-32 md:h-32 rounded-full" />
                    <div className="flex-1 space-y-4">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                         <Skeleton className="h-6 w-full" />
                         <Skeleton className="h-6 w-3/4" />
                    </div>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-60" />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-96 w-full" />
                    <Skeleton className="h-96 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </CardContent>
        </Card>
    </div>
)

const translationKeys = [
    'Not specified',
    'A dedicated member of the SmartBazaar community, connecting farmers and buyers for fresh, quality produce.',
    'Edit Profile',
    'reviews',
    'Member since',
    'My Active Listings',
    'Manage your current produce listings.',
    'New Listing',
    'No active listings',
    'Get started by creating your first listing.',
    'Create Listing',
    'My Purchase History',
    'View your past produce orders.',
    'No purchases yet',
    'Explore the marketplace and make your first purchase.',
    'Start Shopping',
    'Contact'
];

export default function ProfilePage() {
  const { user, data: userData, isLoading: isUserLoading } = useUser();
  const { db } = useFirebase();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [isListingsLoading, setIsListingsLoading] = useState(true);
  const t = useLanguage().manageTranslations([...translationKeys, 'Contact']);

  useEffect(() => {
    if (userData?.role !== 'farmer' || !db || !user) {
        setIsListingsLoading(false);
        return;
    };

    const fetchUserListings = async () => {
        setIsListingsLoading(true);
        try {
            const q = query(collection(db, 'listings'), where('farmerId', '==', user.uid), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const listingsData = querySnapshot.docs.map(docSnap => {
                const data = docSnap.data() as ListingDocument;
                return {
                    id: docSnap.id,
                    farmer: {
                        uid: user.uid,
                        name: userData.firstName ? `${userData.firstName} ${userData.lastName}` : user.displayName || 'Farmer',
                        avatarUrl: user.photoURL || '',
                        rating: userData.rating || 0,
                        reviews: userData.reviews || 0,
                    },
                    crop: { name: data.cropName, imageUrl: data.imageUrl, imageHint: data.imageHint },
                    quantity: data.quantity,
                    unit: data.unit,
                    pricePerUnit: data.pricePerUnit,
                    location: data.location,
                    createdAt: data.createdAt.toDate(),
                    status: data.status,
                };
            });
            setUserListings(listingsData);
        } catch (error) {
            console.error("Error fetching user listings: ", error);
        } finally {
            setIsListingsLoading(false);
        }
    };

    fetchUserListings();
}, [db, user, userData]);


  const userRole = userData?.role;
  const userProfile = {
      name: userData?.firstName ? `${userData.firstName} ${userData.lastName}` : (user?.displayName || "User"),
      role: userData?.role || t("Not specified"),
      location: userData?.location?.city || t("Not specified"),
      memberSince: user?.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "N/A",
      avatarUrl: user?.photoURL || '',
      rating: userData?.rating || 0,
      reviews: userData?.reviews || 0,
      bio: userData?.bio || t("A dedicated member of the SmartBazaar community, connecting farmers and buyers for fresh, quality produce.")
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);

    try {
      const photoURL = await uploadToCloudinary(file);

      // Update Firebase Auth profile
      await updateProfile(user, { photoURL });

      // Update Firestore document
      if (db) {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { photoURL });
      }

      toast({
        title: 'Profile Picture Updated',
        description: 'Your new picture has been saved.',
      });
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: 'There was an error updating your profile picture.',
      });
    } finally {
      setIsUploading(false);
    }
  };


  if (isUserLoading || !user || !userData) {
    return <ProfileLoadingSkeleton />;
  }


  const FarmerProfile = () => (
    <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader className="flex-row justify-between items-center">
                    <div>
                        <CardTitle>{t('My Active Listings')}</CardTitle>
                        <CardDescription>{t('Manage your current produce listings.')}</CardDescription>
                    </div>
                    <Button asChild>
                        <Link href="/sell"><PlusCircle className="mr-2 h-4 w-4"/> {t('New Listing')}</Link>
                    </Button>
                </CardHeader>
                <CardContent>
                {isListingsLoading ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Skeleton className="h-96 w-full" />
                        <Skeleton className="h-96 w-full" />
                     </div>
                ) : userListings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {userListings.filter(l => l.status === 'active').map((listing) => (
                        <ProductCard key={listing.id} listing={listing} />
                    ))}
                    </div>
                ) : (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <List className="mx-auto h-12 w-12 text-muted-foreground"/>
                        <h3 className="text-lg font-medium mt-4">{t('No active listings')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{t('Get started by creating your first listing.')}</p>
                        <Button asChild className="mt-4"><Link href="/sell">{t('Create Listing')}</Link></Button>
                    </div>
                )}
                </CardContent>
            </Card>
        </div>
        <div className="space-y-8">
             <Card>
                <CardHeader>
                    <CardTitle>Farm Details</CardTitle>
                    <CardDescription>Your current crop and soil information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Leaf className="h-6 w-6 text-primary" />
                        <div>
                            <p className="text-sm text-muted-foreground">Current Crop</p>
                            <p className="font-medium">{userData?.currentCrop || 'Not Set'}</p>
                        </div>
                    </div>
                     <Separator />
                     <div className="flex items-center gap-4">
                        <ListTree className="h-6 w-6 text-primary" />
                        <div>
                            <p className="text-sm text-muted-foreground">Soil Type</p>
                            <p className="font-medium">{userData?.soilType || 'Not Set'}</p>
                        </div>
                    </div>
                     <Separator />
                     <div className="flex items-center gap-4">
                        <Droplets className="h-6 w-6 text-primary" />
                        <div>
                            <p className="text-sm text-muted-foreground">Soil Moisture / pH</p>
                            <p className="font-medium">
                                {userData?.soilMoisture ? `${userData.soilMoisture}%` : 'N/A'} / {userData?.phLevel ? `pH ${userData.phLevel}` : 'N/A'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  )

  const BuyerProfile = () => (
    <>
        <Card>
        <CardHeader>
            <CardTitle>{t('My Purchase History')}</CardTitle>
            <CardDescription>{t('View your past produce orders.')}</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium mt-4">{t('No purchases yet')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('Explore the marketplace and make your first purchase.')}</p>
                <Button asChild className="mt-4"><Link href="/">{t('Start Shopping')}</Link></Button>
            </div>
        </CardContent>
      </Card>
    </>
  )

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="relative group shrink-0">
              <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background ring-2 ring-primary">
                <AvatarImage src={userProfile.avatarUrl} alt={userProfile.name} />
                <AvatarFallback className="text-4xl">{userProfile.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/png, image/jpeg"
                disabled={isUploading}
              />
              <button
                onClick={handleAvatarClick}
                disabled={isUploading}
                className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                ) : (
                  <Camera className="h-8 w-8 text-white" />
                )}
              </button>
            </div>
            <div className="flex-1 w-full text-center md:text-left">
              <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                <div>
                  <h1 className="text-3xl font-bold font-headline">{userProfile.name}</h1>
                  <Badge variant="secondary" className="mt-1 capitalize">{userProfile.role}</Badge>
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground mt-2">
                    <MapPin className="h-4 w-4" />
                    <span>{userProfile.location}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full sm:w-auto"><Edit className="mr-2 h-4 w-4" /> {t('Edit Profile')}</Button>
              </div>
              <div className="flex items-center flex-wrap justify-center sm:justify-start gap-x-4 gap-y-2 mt-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-accent text-accent" />
                  <span className="font-bold">{userProfile.rating}</span>
                  <span className="text-muted-foreground">({userProfile.reviews} {t('reviews')})</span>
                </div>
                <Separator orientation="vertical" className="h-5 hidden sm:block" />
                <span className="text-muted-foreground">{t('Member since')} {userProfile.memberSince}</span>
              </div>
              <p className="mt-4 text-card-foreground/80 max-w-prose">{userProfile.bio}</p>
            </div>
          </div>
        </CardContent>
      </Card>
        
      {userRole === 'farmer' ? <FarmerProfile /> : <BuyerProfile />}
    </div>
  );
}
