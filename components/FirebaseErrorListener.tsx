
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

// This is a client-side component that should be used in a layout.
// It will listen for permission errors and display a toast.
// In a development environment, this could be extended to show a detailed overlay.
export default function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Throw the error to make it visible in the Next.js development overlay
      if (process.env.NODE_ENV === 'development') {
        // We wrap it in a timeout to break out of the current render cycle
        // and ensure Next.js catches it as an unhandled error.
        setTimeout(() => {
            throw new Error(`FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n${JSON.stringify(error.toContextObject(), null, 2)}`);
        }, 0);
      } else {
         toast({
            variant: 'destructive',
            title: 'Permission Denied',
            description: 'You do not have permission to perform this action.',
         });
      }
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null; // This component does not render anything
}
