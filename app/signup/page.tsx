
'use client';
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Leaf, Loader2, MapPin } from "lucide-react"
import Link from "next/link"
import { useFirebase } from "@/firebase";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/context/language-context";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import LanguageSwitcher from "@/components/language-switcher";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const provinces = [
    'Azad Jammu & Kashmir',
    'Balochistan',
    'Gilgit-Baltistan',
    'Islamabad Capital Territory',
    'Khyber Pakhtunkhwa',
    'Punjab',
    'Sindh'
];


const SignUpForm = ({ role }: { role: 'farmer' | 'buyer' }) => {
    const { app, db } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [cnic, setCnic] = useState('');
    const [phone, setPhone] = useState('');
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);
    const [location, setLocation] = useState({ address: '', city: '', province: '' });


    const t = useLanguage().manageTranslations([
        'First name',
        'Last name',
        'CNIC Number',
        'Phone Number',
        'Email',
        'Password',
        'Create a farmer account',
        'Create a buyer account',
        'Detect My Location',
        'Detecting...',
        'Address',
        'City',
        'Province',
        'Select a Province'
    ]);
    
    const handleDetectLocation = async () => {
        setIsDetectingLocation(true);
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) {
                    return reject(new Error('Geolocation is not supported by your browser.'));
                }
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                });
            });

            const { latitude, longitude } = position.coords;
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch location data. Status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data && data.address) {
                const { road, city, state, country, suburb, state_district, county, display_name } = data.address;
                const detectedAddress = [road, suburb].filter(Boolean).join(', ');
                const detectedCity = city || suburb || '';
                
                let detectedProvince = state || state_district || county || '';
                
                // Fallback to searching the display_name if province is still not found
                if (!detectedProvince) {
                     const displayNameLower = (display_name || '').toLowerCase();
                     const knownProvincesLower = provinces.map(p => p.toLowerCase());
                     for (const prov of knownProvincesLower) {
                        if (displayNameLower.includes(prov)) {
                            detectedProvince = provinces.find(p => p.toLowerCase() === prov) || '';
                            break;
                        }
                    }
                }

                setLocation({
                    address: detectedAddress,
                    city: detectedCity,
                    province: detectedProvince
                });
                
                toast({
                    title: 'Location Detected',
                    description: `${detectedCity}, ${detectedProvince}`,
                });
            } else {
                 throw new Error('Could not parse location data.');
            }

        } catch (error: any) {
            console.error('Location detection failed:', error);
            toast({
                variant: 'destructive',
                title: 'Location Error',
                description: error.message || 'Could not detect your location. Please enter it manually.',
            });
        } finally {
            setIsDetectingLocation(false);
        }
    };
  
    const handleSignUp = async () => {
      if (!app || !db) return;
      const auth = getAuth(app);
      
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
  
        await updateProfile(user, {
            displayName: `${firstName} ${lastName}`,
        });

        const userDocRef = doc(db, "users", user.uid);
        const userData = {
            uid: user.uid,
            email: user.email,
            role,
            firstName,
            lastName,
            cnic,
            phone,
            location,
            createdAt: new Date().toISOString(),
        };

        setDoc(userDocRef, userData)
            .catch(async (serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'create',
                    requestResourceData: userData,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
        
        toast({
            title: "Account Created",
            description: `Your ${role} account has been successfully created.`,
        });
        router.push(role === 'farmer' ? '/dashboard' : '/');
  
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Sign Up Failed",
          description: error.message || "Could not create your account.",
        });
      }
    }
  
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="first-name">{t('First name')}</Label>
            <Input id="first-name" placeholder="Max" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="last-name">{t('Last name')}</Label>
            <Input id="last-name" placeholder="Robinson" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2">
            <Label htmlFor="phone">{t('Phone Number')}</Label>
            <Input id="phone" type="tel" placeholder="+92 300 1234567" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-2">
            <Label htmlFor="cnic">{t('CNIC Number')}</Label>
            <Input id="cnic" placeholder="12345-1234567-1" required value={cnic} onChange={(e) => setCnic(e.target.value)} />
        </div>
        
        <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={handleDetectLocation} disabled={isDetectingLocation}>
                {isDetectingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MapPin className="mr-2 h-4 w-4"/>}
                {isDetectingLocation ? t('Detecting...') : t('Detect My Location')}
            </Button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label htmlFor="address">{t('Address')}</Label>
                    <Input id="address" placeholder="e.g. Street 123" value={location.address} onChange={(e) => setLocation(l => ({ ...l, address: e.target.value }))} />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="city">{t('City')}</Label>
                    <Input id="city" placeholder="e.g. Karachi" value={location.city} onChange={(e) => setLocation(l => ({ ...l, city: e.target.value }))} />
                </div>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="province">{t('Province')}</Label>
                <Select value={location.province} onValueChange={(value) => setLocation(l => ({...l, province: value}))}>
                    <SelectTrigger>
                        <SelectValue placeholder={t('Select a Province')} />
                    </SelectTrigger>
                    <SelectContent>
                        {provinces.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`email-${role}`}>{t('Email')}</Label>
          <Input id={`email-${role}`} type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`password-${role}`}>{t('Password')}</Label>
          <Input id={`password-${role}`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button onClick={handleSignUp} className="w-full">
          {role === 'farmer' ? t('Create a farmer account') : t('Create a buyer account')}
        </Button>
      </div>
    );
  }


const pageTranslationKeys = [
    'Join SmartBazaar',
    'Choose your role and start connecting',
    'Farmer',
    'Buyer',
    'Already have an account?',
    'Log in'
];

export default function SignUpPage() {
  const t = useLanguage().manageTranslations(pageTranslationKeys);
  return (
      <Card className="mx-auto max-w-md relative">
         <div className="absolute top-4 right-4">
            <LanguageSwitcher />
        </div>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Leaf className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center font-headline">{t('Join SmartBazaar')}</CardTitle>
          <CardDescription className="text-center">{t('Choose your role and start connecting')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="farmer" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="farmer">{t('Farmer')}</TabsTrigger>
              <TabsTrigger value="buyer">{t('Buyer')}</TabsTrigger>
            </TabsList>
            <TabsContent value="farmer" className="mt-6">
              <SignUpForm role="farmer" />
            </TabsContent>
            <TabsContent value="buyer" className="mt-6">
              <SignUpForm role="buyer" />
            </TabsContent>
          </Tabs>
          <div className="mt-4 text-center text-sm">
            {t('Already have an account?')}{" "}
            <Link href="/login" className="underline">
              {t('Log in')}
            </Link>
          </div>
        </CardContent>
      </Card>
  )
}
