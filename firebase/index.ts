
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { firebaseConfig } from './config';

import { useFirebase, FirebaseProvider } from './provider';
import { useUser } from './auth/use-user';
import { FirebaseClientProvider } from './client-provider';


function initializeFirebase() {
  const apps = getApps();
  const app = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Initialize Analytics if it's supported by the browser
  if (typeof window !== 'undefined') {
    isSupported().then((supported) => {
        if (supported) {
            getAnalytics(app);
        }
    });
  }

  // This function ensures that the app connects to the production services
  // and does not attempt to connect to any local emulators.

  return { app, auth, db };
}

export {
    initializeFirebase,
    FirebaseProvider,
    FirebaseClientProvider,
    useUser,
    useFirebase
};
