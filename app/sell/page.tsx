
"use client"

import { useState, useCallback, useRef } from "react"
import Image from "next/image"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Wand2, Upload, Loader2, Info, ArrowLeft } from "lucide-react"
import { classifyUploadedImage } from "@/ai/flows/classify-uploaded-image"
import { suggestFairPrice } from "@/ai/flows/suggest-fair-price"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useLanguage } from "@/context/language-context"
import { useFirebase } from "@/firebase"
import { useUser } from "@/firebase/auth/use-user"
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from "@/components/ui/separator"

const stepOneSchema = z.object({
  cropName: z.string().min(2, { message: "Crop name must be at least 2 characters." }),
  category: z.string({ required_error: "Please select a category." }),
  quantity: z.coerce.number().positive({ message: "Please enter a valid quantity." }),
  unit: z.string({ required_error: "Please select a unit." }),
  location: z.string({ required_error: "Please select a province." }),
  description: z.string().optional(),
});

const stepTwoSchema = z.object({
    pricePerUnit: z.coerce.number().positive({ message: "Please enter a valid price." }),
});

type StepOneValues = z.infer<typeof stepOneSchema>;
type StepTwoValues = z.infer<typeof stepTwoSchema>;

type SuggestedPriceData = {
    price: number;
    justification: string;
}


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

const provinces = [
    'Sindh',
    'Punjab',
    'Balochistan',
    'Khyber Pakhtunkhwa',
    'Gilgit-Baltistan',
    'Azad Jammu & Kashmir',
    'Islamabad Capital Territory',
];

const translationKeys = [
    'Create a New Listing',
    'Fill out the details below to sell your produce on SmartBazaar.',
    'Product Image',
    'Click to upload or drag & drop',
    'PNG, JPG up to 5MB',
    'Identifying crop...',
    'Crop Name',
    'Category',
    'Select a category',
    'Fruits',
    'Vegetables',
    'Grains',
    'Other',
    'Quantity',
    'Unit',
    'Select a unit',
    'Kilogram (kg)',
    'Maund (mound)',
    'Dozen',
    'Piece',
    'Price per Unit (PKR)',
    'Suggest Price',
    'AI Price Suggestion',
    'Latest market price:',
    'per unit.',
    'Location / City',
    'Description (Optional)',
    'Add details about your produce, e.g., \'Organically grown, ready for harvest\'.',
    'This will help buyers know more about your product.',
    'Create Listing',
    'Proceed to Pricing',
    'Back to Details',
    'Step 1: Produce Details',
    'Step 2: Set Your Price',
];

export default function SellPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { app, db } = useFirebase();
  const { user } = useUser();

  const [step, setStep] = useState(1);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSuggestingPrice, setIsSuggestingPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepOneData, setStepOneData] = useState<StepOneValues | null>(null);
  const [suggestedPriceData, setSuggestedPriceData] = useState<SuggestedPriceData | null>(null);

  const t = useLanguage().manageTranslations(translationKeys);

  const stepOneForm = useForm<StepOneValues>({
    resolver: zodResolver(stepOneSchema),
    defaultValues: { cropName: "", category: "", quantity: 0, location: "", description: "" },
  });

  const stepTwoForm = useForm<StepTwoValues>({
    resolver: zodResolver(stepTwoSchema),
    defaultValues: { pricePerUnit: 0 },
  });

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setImageFile(file);
      const reader = new FileReader()
      reader.onloadend = async () => {
        const dataUri = reader.result as string
        setImagePreview(dataUri)
        setIsClassifying(true)
        try {
          const result = await classifyUploadedImage({ photoDataUri: dataUri })
          stepOneForm.setValue("cropName", result.cropType, { shouldValidate: true })
          toast({
            title: "Crop Identified!",
            description: `We think this is a ${result.cropType} with ${Math.round(result.confidence * 100)}% confidence.`,
          })
        } catch (error) {
          console.error("Image classification error:", error)
          toast({
            variant: "destructive",
            title: "Classification Failed",
            description: "Could not identify the crop from the image.",
          })
        } finally {
          setIsClassifying(false)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleStepOneSubmit = (data: StepOneValues) => {
    if (!imageFile) {
        toast({ variant: "destructive", title: "Image Required", description: "Please upload an image of your produce." });
        return;
    }
    setStepOneData(data);
    setStep(2);
    triggerPriceSuggestion(data);
  };

  const triggerPriceSuggestion = useCallback(async (data: StepOneValues) => {
    if (!data.cropName || !data.location || !db) {
      return;
    }
  
    setIsSuggestingPrice(true);
    setSuggestedPriceData(null);
  
    try {
      // 1. Fetch 3-day price history from 'market_prices'
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
  
      const cropNameLower = data.cropName.toLowerCase();
      const cropNameCapitalized = cropNameLower.charAt(0).toUpperCase() + cropNameLower.slice(1);
  
      const pricesQuery = query(
        collection(db, 'market_prices'),
        where('crop', 'in', [cropNameLower, cropNameCapitalized]),
        where('province', '==', data.location),
        where('date', '>=', threeDaysAgoStr),
        orderBy('date', 'desc')
      );
  
      const priceSnapshots = await getDocs(pricesQuery);
      
      if (priceSnapshots.empty) {
        setIsSuggestingPrice(false);
        return;
      }
      
      const threeDayPriceHistory = priceSnapshots.docs.map(doc => {
        const priceData = doc.data();
        return {
          date: priceData.date,
          // Handle cases where 'average' might be N/A or not a number
          price: typeof priceData.average === 'number' ? priceData.average : 0,
          unit: priceData.unit || 'kg', // Default to kg if unit is missing
        };
      }).filter(item => item.price > 0); // Filter out entries with invalid prices

      if (threeDayPriceHistory.length === 0) {
        setIsSuggestingPrice(false);
        return;
      }

      // 2. Fetch local supply (active listings)
      const listingsQuery = query(
        collection(db, 'listings'),
        where('cropName', '==', data.cropName),
        where('location', '==', data.location),
        where('status', '==', 'active')
      );
      const listingsSnapshot = await getDocs(listingsQuery);
      const localSupplyCount = listingsSnapshot.size;
  
      // 3. Fetch buyer demand from past orders
      const ordersQuery = query(
          collection(db, 'orders'),
          where('cropName', '==', data.cropName),
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const buyerDemandCount = ordersSnapshot.size;
  
      // 4. Call the AI Flow
      const suggestionResult = await suggestFairPrice({
        cropName: data.cropName,
        listingUnit: data.unit, // Pass the farmer's chosen unit
        quantity: data.quantity,
        location: data.location,
        threeDayPriceHistory,
        localSupplyCount,
        buyerDemandCount
      });
  
      if (suggestionResult) {
        setSuggestedPriceData({
            price: suggestionResult.suggestedPrice,
            justification: suggestionResult.justification
        });
        stepTwoForm.setValue("pricePerUnit", suggestionResult.suggestedPrice);
      }
  
    } catch (error) {
      console.error("Price suggestion error:", error);
      toast({
        variant: "destructive",
        title: "Suggestion Failed",
        description: "Could not generate a price suggestion at this time.",
      });
    } finally {
      setIsSuggestingPrice(false);
    }
  }, [db, stepTwoForm, toast]);


  async function onFinalSubmit(data: StepTwoValues) {
    if (!imageFile || !user || !app || !db || !stepOneData) {
        toast({
            variant: "destructive",
            title: "Submission Error",
            description: "Some information is missing. Please go back and check.",
        });
        return;
    }

    setIsSubmitting(true);

    try {
      const imageUrl = await uploadToCloudinary(imageFile);

      const listingData = {
          ...stepOneData,
          ...data,
          farmerId: user.uid,
          imageUrl,
          imageHint: 'produce',
          createdAt: serverTimestamp(),
          status: 'active',
      };
      
      const listingsCollection = collection(db, "listings");
      await addDoc(listingsCollection, listingData);

      toast({
        title: "Listing added successfully",
        description: "Your produce has been listed on the marketplace.",
      });
      router.push(`/my-listings`);

    } catch (error: any) {
        console.error("Error creating listing:", error);
        
        const permissionError = new FirestorePermissionError({
            path: "listings",
            operation: 'create',
            requestResourceData: { ...stepOneData, ...data },
        });
        errorEmitter.emit('permission-error', permissionError);

        toast({
            variant: "destructive",
            title: "Listing Creation Failed",
            description: "There was an error creating your listing. " + error.message,
        });
    } finally {
      setIsSubmitting(false);
    }
}

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">
            {step === 1 ? t('Step 1: Produce Details') : t('Step 2: Set Your Price')}
          </CardTitle>
          <CardDescription>
            {step === 1 ? t('Fill out the details below to sell your produce on SmartBazaar.') : 'Review details and set your price per unit.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <Form {...stepOneForm}>
              <form onSubmit={stepOneForm.handleSubmit(handleStepOneSubmit)} className="space-y-8">
                <div className="space-y-4">
                  <FormLabel>{t('Product Image')}</FormLabel>
                  <div className="relative aspect-video w-full max-w-sm rounded-md border-2 border-dashed border-muted-foreground/50 flex items-center justify-center text-center p-4 mx-auto">
                    {imagePreview ? (
                      <Image src={imagePreview} alt="Produce preview" fill className="object-cover rounded-md" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <p>{t('Click to upload or drag & drop')}</p>
                        <p className="text-xs">{t('PNG, JPG up to 5MB')}</p>
                      </div>
                    )}
                    <Input id="picture" type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleImageUpload} />
                    {isClassifying && (
                      <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center rounded-md gap-2">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p>{t('Identifying crop...')}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-8">
                  <FormField control={stepOneForm.control} name="cropName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Crop Name')}</FormLabel>
                      <FormControl>
                          <Input placeholder="e.g. Sindhri Mangoes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={stepOneForm.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Category')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={t('Select a category')} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="fruits">{t('Fruits')}</SelectItem>
                          <SelectItem value="vegetables">{t('Vegetables')}</SelectItem>
                          <SelectItem value="grains">{t('Grains')}</SelectItem>
                          <SelectItem value="other">{t('Other')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid sm:grid-cols-2 md:grid-cols-2 gap-8">
                  <FormField control={stepOneForm.control} name="quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Quantity')}</FormLabel>
                       <FormControl>
                          <Input type="number" placeholder="e.g. 100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={stepOneForm.control} name="unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Unit')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} >
                        <FormControl><SelectTrigger><SelectValue placeholder={t('Select a unit')} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="kg">{t('Kilogram (kg)')}</SelectItem>
                          <SelectItem value="maund">{t('Maund (mound)')}</SelectItem>
                          <SelectItem value="dozen">{t('Dozen')}</SelectItem>
                          <SelectItem value="piece">{t('Piece')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={stepOneForm.control} name="location" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Location / City')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                         <FormControl><SelectTrigger><SelectValue placeholder="Select a province" /></SelectTrigger></FormControl>
                         <SelectContent>
                            {provinces.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                         </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                <FormField control={stepOneForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Description (Optional)')}</FormLabel>
                    <FormControl><Textarea placeholder={t("Add details about your produce, e.g., 'Organically grown, ready for harvest'.")} className="min-h-24" {...field} /></FormControl>
                    <FormDescription>{t('This will help buyers know more about your product.')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                
                <div className="flex justify-end">
                  <Button type="submit" size="lg">
                      {t('Proceed to Pricing')}
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {step === 2 && (
            <Form {...stepTwoForm}>
                <form onSubmit={stepTwoForm.handleSubmit(onFinalSubmit)} className="space-y-8">
                    <Card className="bg-muted/50">
                        <CardHeader>
                            <CardTitle className="text-lg">Review Your Listing</CardTitle>
                        </CardHeader>
                        <CardContent className="grid sm:grid-cols-2 gap-6">
                            <div className="flex items-start gap-4">
                               {imagePreview && <Image src={imagePreview} alt="Preview" width={80} height={80} className="rounded-md aspect-square object-cover" />}
                               <div>
                                    <h3 className="font-bold text-lg">{stepOneData?.cropName}</h3>
                                    <p className="text-sm text-muted-foreground">{stepOneData?.category}</p>
                                    <p className="text-sm text-muted-foreground">{stepOneData?.location}</p>
                               </div>
                            </div>
                            <div className="flex items-center justify-start sm:justify-end">
                                <p className="text-2xl font-bold">{stepOneData?.quantity} <span className="text-lg font-medium text-muted-foreground">{stepOneData?.unit}</span></p>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Separator />

                    <FormField control={stepTwoForm.control} name="pricePerUnit" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-base">{t('Price per Unit (PKR)')}</FormLabel>
                             <FormControl>
                                <Input type="number" placeholder="e.g. 250" {...field} className="max-w-xs text-lg p-4" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    {isSuggestingPrice ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Analyzing market data...</span>
                        </div>
                    ) : suggestedPriceData ? (
                        <Alert className="bg-primary/10 border-primary/20 max-w-md">
                            <Wand2 className="h-4 w-4" />
                            <AlertTitle className="font-bold text-primary">{t('AI Price Suggestion')}</AlertTitle>
                            <AlertDescription>
                                We suggest a price of <strong>PKR {suggestedPriceData.price}</strong> per {stepOneData?.unit}. 
                                <br/>
                                <span className="text-xs">{suggestedPriceData.justification}</span>
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert variant="destructive" className="max-w-md">
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Suggestion Available</AlertTitle>
                            <AlertDescription>
                                We couldn't find recent market data for this crop in your province. Please set your price manually.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                        <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" /> {t('Back to Details')}</Button>
                        <Button type="submit" size="lg" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('Create Listing')}
                        </Button>
                    </div>
                </form>
            </Form>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
