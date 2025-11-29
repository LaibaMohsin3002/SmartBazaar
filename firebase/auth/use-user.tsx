
'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';

export function useUser() {
  const { auth, db } = useFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DocumentData | null>(null);
  const [claims, setClaims] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const tokenResult = await authUser.getIdTokenResult();
        setClaims(tokenResult.claims);

        if (db) {
          const userDocRef = doc(db, 'users', authUser.uid);
          const unsubscribeFirestore = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
              setData(doc.data());
            } else {
              setData(null);
            }
            setIsLoading(false);
          }, (error) => {
            console.error("Error fetching user data:", error);
            setData(null);
            setIsLoading(false);
          });
          return () => unsubscribeFirestore();
        }
      } else {
        setUser(null);
        setData(null);
        setClaims(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [auth, db]);

  return { user, data, claims, isLoading };
}
