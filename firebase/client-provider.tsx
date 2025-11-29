
"use client";

import { useEffect, useState, ReactNode, useMemo } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseInstances, setFirebaseInstances] = useState<{
    app: FirebaseApp | null;
    auth: Auth | null;
    db: Firestore | null;
  }>({ app: null, auth: null, db: null });

  useEffect(() => {
    const instances = initializeFirebase();
    setFirebaseInstances(instances);
  }, []);

  const providerValue = useMemo(() => ({
    app: firebaseInstances.app,
    auth: firebaseInstances.auth,
    db: firebaseInstances.db,
  }), [firebaseInstances]);


  if (!providerValue.app) {
    return null;
  }

  return (
    <FirebaseProvider
      app={providerValue.app}
      auth={providerValue.auth}
      db={providerValue.db}
    >
      {children}
    </FirebaseProvider>
  );
}
