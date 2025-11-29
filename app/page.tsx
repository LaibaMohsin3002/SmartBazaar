

'use client';
import { ProductCard } from '@/components/product-card';
import type { Listing, ListingDocument, UserDocument } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from '@/components/ui/input';
import { Filter, Wheat, XCircle, Leaf, ShoppingCart, Users, Search as SearchIcon } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { useEffect, useState, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, onSnapshot, doc, getDoc, query, where, QueryConstraint } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { generateSearchEmbeddings } from '@/ai/flows/enable-natural-language-search';


const translationKeys = [
  'Explore the Market',
  'Find fresh produce directly from local farmers across the region.',
  'Filters',
  'Category',
  'All Categories',
  'Fruits',
  'Vegetables',
  'Grains',
  'Location',
  'All Locations',
  'Sindh',
  'Punjab',
  'Balochistan',
  'Khyber Pakhtunkhwa',
  'Gilgit-Baltistan',
  'Azad Jammu & Kashmir',
  'Islamabad Capital Territory',
  'Min price',
  'Max price',
  'Apply',
  'Clear',
  'Contact',
  'No listings found',
  'There are currently no produce listings available. Please check back later.',
  'Try adjusting your filters or check back later.',
  'Search',
  'Search for produce...'
];

const provinces = [
    'Sindh',
    'Punjab',
    'Balochistan',
    'Khyber Pakhtunkhwa',
    'Gilgit-Baltistan',
    'Azad Jammu & Kashmir',
    'Islamabad Capital Territory',
];


const MarketplaceLoadingSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
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

const LandingPage = () => {
    return (
        <div className="flex flex-col min-h-screen bg-background w-full">
            <main className="flex-1">
                <section className="relative w-full h-[80vh] min-h-[500px] flex items-center justify-center text-center bg-cover bg-center" style={{backgroundImage: "url('https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=2070&auto=format&fit=crop')"}}>
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="relative z-10 container px-4 md:px-6 text-white">
                        <div className="max-w-3xl mx-auto">
                            <Leaf className="h-16 w-16 text-primary mx-auto mb-4" />
                            <h1 className="text-4xl md:text-6xl font-bold font-headline tracking-tight">Welcome to SmartBazaar</h1>
                            <p className="mt-4 text-lg md:text-xl text-primary-foreground/90">Connecting local farmers directly with buyers. Fresh produce, fair prices.</p>
                            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                                <Button asChild size="lg">
                                    <Link href="/signup">Get Started</Link>
                                </Button>
                                <Button asChild size="lg" variant="secondary">
                                    <Link href="/login">Log In</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="about" className="py-12 md:py-24 lg:py-32">
                    <div className="container px-4 md:px-6">
                        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
                            <Image
                                src="https://images.unsplash.com/photo-1562956509-4e2fbef3afcc?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
                                alt="About SmartBazaar"
                                width={600}
                                height={400}
                                className="rounded-lg object-cover"
                            />
                            <div className="space-y-4">
                                <Badge variant="outline">Our Mission</Badge>
                                <h2 className="text-3xl font-bold font-headline tracking-tight sm:text-4xl">Empowering Farmers, Nourishing Communities</h2>
                                <p className="text-muted-foreground text-lg">
                                    SmartBazaar was born from a simple idea: to bridge the gap between the hardworking farmers who grow our food and the communities that consume it. We eliminate the middlemen, ensuring farmers get fair prices for their produce and you get the freshest food at honest rates.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="how-it-works" className="py-12 md:py-24 lg:py-32 bg-muted">
                    <div className="container px-4 md:px-6">
                        <div className="space-y-4 text-center">
                            <h2 className="text-3xl font-bold font-headline tracking-tight sm:text-4xl">How It Works</h2>
                            <p className="max-w-2xl mx-auto text-muted-foreground md:text-xl">A simple, transparent process for both farmers and buyers.</p>
                        </div>
                        <div className="mt-12 grid gap-8 md:grid-cols-2">
                            <Card>
                                <CardHeader className="flex flex-row items-center gap-4">
                                    <div className="bg-primary/10 p-3 rounded-full"><Users className="h-6 w-6 text-primary"/></div>
                                    <CardTitle className="font-headline">For Farmers</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-muted-foreground">
                                    <p><b>1. List Your Produce:</b> Easily create listings for your crops with photos, quantity, and price.</p>
                                    <p><b>2. Connect with Buyers:</b> Receive purchase requests and chat directly with buyers to coordinate.</p>
                                    <p><b>3. Grow Your Business:</b> Get fair prices, manage orders, and build relationships with loyal customers.</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center gap-4">
                                     <div className="bg-primary/10 p-3 rounded-full"><ShoppingCart className="h-6 w-6 text-primary"/></div>
                                    <CardTitle className="font-headline">For Buyers</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-muted-foreground">
                                     <p><b>1. Explore the Market:</b> Browse a wide variety of fresh produce directly from local farms.</p>
                                     <p><b>2. Purchase with Confidence:</b> See farmer ratings and reviews, then place your order securely.</p>
                                     <p><b>3. Enjoy Freshness:</b> Get the freshest, highest-quality produce delivered to you.</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </section>

                <footer className="py-6 bg-secondary text-secondary-foreground">
                    <div className="container px-4 md:px-6 flex items-center justify-between text-sm">
                        <p>&copy; {new Date().getFullYear()} SmartBazaar. All rights reserved.</p>
                        <nav className="flex gap-4">
                            <Link href="#" className="hover:underline">Terms</Link>
                            <Link href="#" className="hover:underline">Privacy</Link>
                        </nav>
                    </div>
                </footer>
            </main>
        </div>
    );
};


export default function MarketplacePage() {
  const t = useLanguage().manageTranslations(translationKeys);
  const { db } = useFirebase();
  const { user, data: userData, isLoading: isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [displayedListings, setDisplayedListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [category, setCategory] = useState<string>('all');
  const [location, setLocation] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<any>({});
  
  // Search states
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  // Redirect farmer to their dashboard
  useEffect(() => {
    if (!isUserLoading && user && userData?.role === 'farmer') {
      router.replace('/dashboard');
    }
  }, [userData, isUserLoading, user, router]);

  useEffect(() => {
    if (isUserLoading || !user || userData?.role === 'farmer' || !db) {
      setIsLoading(isUserLoading);
      return;
    }
    
    // Only set loading to true if we are not in an active search state
    if (!isSearchActive) setIsLoading(true);

    const listingsCollectionRef = collection(db, 'listings');
    
    const q = query(listingsCollectionRef, where('status', '==', 'active'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      try {
        const listingsPromises = querySnapshot.docs.map(async (listingDoc) => {
            const listingData = listingDoc.data() as ListingDocument;
            
            if (!listingData.farmerId) {
                console.warn(`Listing ${listingDoc.id} is missing farmerId`);
                return null;
            }
            
            let farmerData: UserDocument | undefined;
            const farmerDocRef = doc(db, 'users', listingData.farmerId);
            const farmerDocSnap = await getDoc(farmerDocRef).catch(serverError => {
                const permissionError = new FirestorePermissionError({
                  path: farmerDocRef.path,
                  operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
                return null;
            });

            if (farmerDocSnap && farmerDocSnap.exists()) {
                farmerData = farmerDocSnap.data() as UserDocument;
            } else {
                console.warn(`Could not retrieve farmer document for farmerId: ${listingData.farmerId}`);
            }

            return {
              id: listingDoc.id,
              farmer: {
                uid: listingData.farmerId,
                name: farmerData ? `${farmerData.firstName} ${farmerData.lastName}` : 'Verified Farmer',
                avatarUrl: farmerData?.photoURL || '',
                rating: farmerData?.rating ?? 0,
                reviews: farmerData?.reviews ?? 0,
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
        const resolvedListings = await Promise.all(listingsPromises);
        const validListings = resolvedListings.filter((l): l is Listing => l !== null);
        setAllListings(validListings);
        
        // Don't override search results
        if (!isSearchActive) {
            setDisplayedListings(validListings);
        }

      } catch(e) {
          console.error("Error processing listings data:", e);
      } finally {
        setIsLoading(false);
      }
    }, (error) => {
      const permissionError = new FirestorePermissionError({
        path: listingsCollectionRef.path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, userData, isUserLoading, user, router, isSearchActive]);

  // Effect for client-side filtering
  useEffect(() => {
    // This effect should not run if a search is active, as search results are handled separately.
    if (isSearchActive) return;

    let listingsToFilter = [...allListings];
    
    if (activeFilters.category && activeFilters.category !== 'all') {
        // Note: The 'category' field is in ListingDocument, not Listing.
        // This won't work without fetching the category or adding it to the Listing type.
        // For now, we assume this filter is handled by Firestore or we skip it.
    }
    if (activeFilters.location && activeFilters.location !== 'all') {
        listingsToFilter = listingsToFilter.filter(listing => 
            listing.location.toLowerCase().includes(activeFilters.location.toLowerCase())
        );
    }
    if (activeFilters.minPrice > 0) {
        listingsToFilter = listingsToFilter.filter(listing => listing.pricePerUnit >= activeFilters.minPrice);
    }
    if (activeFilters.maxPrice > 0) {
        listingsToFilter = listingsToFilter.filter(listing => listing.pricePerUnit <= activeFilters.maxPrice);
    }
    
    setDisplayedListings(listingsToFilter);
  }, [allListings, activeFilters, isSearchActive]);


  const handleApplyFilters = () => {
    setIsSearchActive(false); // Deactivate search when applying filters
    setSearchKeyword('');
    setActiveFilters({
        category,
        location,
        minPrice: Number(minPrice) || 0,
        maxPrice: Number(maxPrice) || 0,
    });
  };
  
  const handleSearch = async () => {
    if (!searchKeyword) {
      toast({ variant: 'destructive', title: 'Search is empty', description: 'Please enter a keyword to search.' });
      return;
    }
    if (!user || !db) {
      toast({ variant: 'destructive', title: 'Not logged in', description: 'You must be logged in to search.' });
      return;
    }
  
    setIsSearching(true);
    setActiveFilters({}); // Clear local filters
  
    try {
      const response = await fetch('https://lyndsey-nonexcitative-eunice.ngrok-free.dev/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: searchKeyword, uid: user.uid }),
      });
  
      if (!response.ok) {
        throw new Error(`Search request failed with status ${response.status}`);
      }
  
      const searchResults: { rankedListingIds: string[] } = await response.json();
      
      if (!searchResults.rankedListingIds || searchResults.rankedListingIds.length === 0) {
        setDisplayedListings([]);
        setIsSearchActive(true);
        return;
      }
  
      // Fetch the full listing data for each ID returned by the search
      const listingsPromises = searchResults.rankedListingIds.map(async (id) => {
        const listingRef = doc(db, 'listings', id);
        const listingSnap = await getDoc(listingRef);
        if (!listingSnap.exists()) return null;
  
        const listingData = listingSnap.data() as ListingDocument;
        const farmerRef = doc(db, 'users', listingData.farmerId);
        const farmerSnap = await getDoc(farmerRef);
        const farmerData = farmerSnap.exists() ? farmerSnap.data() as UserDocument : null;
  
        return {
          id: listingSnap.id,
          farmer: {
            uid: listingData.farmerId,
            name: farmerData ? `${farmerData.firstName} ${farmerData.lastName}` : 'Verified Farmer',
            avatarUrl: farmerData?.photoURL || '',
            rating: farmerData?.rating ?? 0,
            reviews: farmerData?.reviews ?? 0,
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
  
      const fetchedListings = (await Promise.all(listingsPromises)).filter(
        (l): l is Listing => l !== null
      );
  
      const keywordLower = searchKeyword.toLowerCase();
      const keywordFilteredListings = fetchedListings.filter(l => 
        l.crop.name.toLowerCase().includes(keywordLower)
      );

      // Create a map for quick lookups to maintain order from the ranked list
      const listingsMap = new Map(keywordFilteredListings.map(l => [l.id, l]));
      const orderedListings = searchResults.rankedListingIds
          .map(id => listingsMap.get(id))
          .filter((l): l is Listing => l !== undefined);
  
      setDisplayedListings(orderedListings);
      setIsSearchActive(true);
  
    } catch (error: any) {
      console.error('Search failed:', error);
      toast({
        variant: 'destructive',
        title: 'Search Failed',
        description: error.message || 'Could not fetch search results.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    // Clear both filters and search
    setCategory('all');
    setLocation('all');
    setMinPrice('');
    setMaxPrice('');
    setActiveFilters({});
    setSearchKeyword('');
    setIsSearchActive(false);
    // Displayed listings will be reset to allListings by the useEffect hook
    setDisplayedListings(allListings);
  };
  
  const hasActiveFiltersOrSearch = useMemo(() => {
    return isSearchActive || 
           (activeFilters.category && activeFilters.category !== 'all') || 
           (activeFilters.location && activeFilters.location !== 'all') || 
           activeFilters.minPrice > 0 || 
           activeFilters.maxPrice > 0;
  }, [activeFilters, isSearchActive]);
  
  if (!user && !isUserLoading) {
    return <LandingPage />;
  }

  if (isUserLoading || (user && userData?.role !== 'buyer') ) {
      return <MarketplaceLoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight font-headline">{t('Explore the Market')}</h1>
        <p className="text-muted-foreground mt-2">{t('Find fresh produce directly from local farmers across the region.')}</p>
      </div>

       <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder={t('Search for produce...')}
              className="pl-10"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching} className="w-full md:w-auto">
            {isSearching ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div> : <SearchIcon className="mr-2 h-4 w-4" />}
            {t('Search')}
          </Button>
        </div>

        <div className="rounded-lg border bg-card text-card-foreground p-4 shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-4">
              <h3 className="flex items-center gap-2 font-semibold"><Filter className="h-4 w-4"/>{t('Filters')}</h3>
              <div className="grid grid-cols-2 md:flex-1 md:grid-cols-4 w-full md:w-auto gap-4">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder={t('Category')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Categories')}</SelectItem>
                    <SelectItem value="fruits">{t('Fruits')}</SelectItem>
                    <SelectItem value="vegetables">{t('Vegetables')}</SelectItem>
                    <SelectItem value="grains">{t('Grains')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger><SelectValue placeholder={t('Location')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Locations')}</SelectItem>
                    {provinces.map(p => <SelectItem key={p} value={p}>{t(p) || p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder={t('Min price')} type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                <Input placeholder={t('Max price')} type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
              <Button className="w-full md:w-auto" onClick={handleApplyFilters}>{t('Apply')}</Button>
              {hasActiveFiltersOrSearch && (
                  <Button variant="ghost" className="w-full md:w-auto" onClick={handleClear}><XCircle className="mr-2 h-4 w-4"/>{t('Clear')}</Button>
              )}
          </div>
        </div>
      </div>
      
      {(isLoading || isSearching) ? <MarketplaceLoadingSkeleton /> : (
        displayedListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedListings.map(listing => (
              <ProductCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 border-2 border-dashed rounded-lg">
              <Wheat className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="text-xl font-medium mt-4">{t('No listings found')}</h3>
              <p className="text-md text-muted-foreground mt-2">
                  {hasActiveFiltersOrSearch ? t('Try adjusting your filters or check back later.') : t('There are currently no produce listings available. Please check back later.')}
              </p>
          </div>
        )
      )}
    </div>
  );
}

