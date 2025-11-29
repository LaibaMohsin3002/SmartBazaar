
'use client';
import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { Leaf } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { useLanguage } from "@/context/language-context";
import LanguageSwitcher from "@/components/language-switcher";

const translationKeys = [
    'Welcome Back',
    'Enter your credentials to access your account.',
    'Email',
    'Password',
    'Forgot your password?',
    'Login',
    'Login with Google',
    'Don\'t have an account?',
    'Sign up',
];

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { app } = useFirebase();
  const t = useLanguage().manageTranslations(translationKeys);

  const handleSuccessfulLogin = async (user: User) => {
    if (!app) return;
    const db = getFirestore(app);
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    toast({
      title: "Login Successful",
      description: "Welcome back!",
    });

    if (userDoc.exists() && userDoc.data().role === 'farmer') {
      router.push('/dashboard');
    } else {
      router.push('/');
    }
  };


  const handleLogin = async () => {
    if (!app) return;
    const auth = getAuth(app);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleSuccessfulLogin(userCredential.user);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
      });
    }
  };

  const handleGoogleLogin = async () => {
    if (!app) return;
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await handleSuccessfulLogin(result.user);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Google Login Failed",
        description: error.message || "Could not log in with Google.",
      });
    }
  };

  return (
      <Card className="mx-auto max-w-md relative">
        <div className="absolute top-4 right-4">
            <LanguageSwitcher />
        </div>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Leaf className="h-10 w-10 text-primary"/>
          </div>
          <CardTitle className="text-2xl text-center font-headline">{t('Welcome Back')}</CardTitle>
          <CardDescription className="text-center">
             {t('Enter your credentials to access your account.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t('Email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">{t('Password')}</Label>
                <Link
                  href="#"
                  className="ml-auto inline-block text-sm underline"
                >
                  {t('Forgot your password?')}
                </Link>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button onClick={handleLogin} className="w-full">
              {t('Login')}
            </Button>
            <Button variant="outline" onClick={handleGoogleLogin} className="w-full">
              {t('Login with Google')}
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            {t("Don't have an account?")}{" "}
            <Link href="/signup" className="underline">
              {t('Sign up')}
            </Link>
          </div>
        </CardContent>
      </Card>
  )
}
