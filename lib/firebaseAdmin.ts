
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

// Check if the app is already initialized to prevent errors.
if (!getApps().length) {
    try {
        // In a Google Cloud environment like App Hosting, the SDK automatically
        // discovers the credentials when initializeApp() is called with no arguments.
        initializeApp();
    } catch (e: any) {
        console.error("Firebase Admin SDK initialization failed:", e);
        // This is a critical error and should not happen in a properly configured environment.
        throw new Error("Could not initialize Firebase Admin SDK. Service account credentials may be missing or invalid.");
    }
}

// getApp() retrieves the default initialized app.
// getFirestore() gets the Firestore instance from that app.
const adminDb = getFirestore(getApp());

export { admin, adminDb };
