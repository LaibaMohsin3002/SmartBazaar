
'use server';

import { StreamChat } from 'stream-chat';
import type { UserDocument } from '@/lib/types';
import { getDoc } from 'firebase/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Ensures a user exists in Stream's system. Fetches user data from Firestore
 * and upserts it into Stream.
 * This function should only be called from the server-side or a Server Action.
 *
 * @param userId The unique identifier of the user to upsert.
 * @returns {Promise<void>}
 * @throws {Error} If the user cannot be found in Firestore or if Stream API keys are missing.
 */
export async function ensureUserInStream(userId: string): Promise<void> {
    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const secretKey = process.env.STREAM_SECRET_KEY;
  
    if (!apiKey || !secretKey) {
      throw new Error('Stream API key or secret key is not set.');
    }
  
    if (!userId) {
      throw new Error('User ID must be provided to ensure user exists in Stream.');
    }
    
    // Fetch user data from Firestore
    const userDocRef = adminDb.doc(`users/${userId}`);
    let userDocSnap;

    try {
        userDocSnap = await userDocRef.get();
    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        // We throw the original error to halt execution if we can't get the user doc
        throw serverError;
    }
  
    if (!userDocSnap.exists) {
      throw new Error(`User with ID ${userId} not found in Firestore.`);
    }
  
    const userData = userDocSnap.data() as UserDocument;
  
    // Initialize Stream Chat client on the server
    const serverClient = StreamChat.getInstance(apiKey, secretKey);
  
    // Upsert the user to ensure they exist in Stream before any channel operations
    await serverClient.upsertUser({
      id: userId,
      name: `${userData.firstName} ${userData.lastName}`,
      image: userData.photoURL || undefined,
    });
}


/**
 * Generates a Stream Chat token for the currently authenticated user
 * and ensures the user exists in Stream's system.
 *
 * @param userId The unique identifier of the user to create a token for.
 * @returns {Promise<string>} A promise that resolves to the generated user token.
 * @throws {Error} If the user is not authenticated or if API keys are missing.
 */
export async function generateToken(userId: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const secretKey = process.env.STREAM_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('Stream API key is not set. Please check your environment variables.');
  }

  if (!userId) {
    throw new Error('User must be authenticated to generate a chat token.');
  }
  
  // Ensure the user exists in Stream before generating a token for them.
  await ensureUserInStream(userId);

  // Initialize Stream Chat client on the server to create the token
  const serverClient = StreamChat.getInstance(apiKey, secretKey);

  // Create a token for the user
  const token = serverClient.createToken(userId);

  return token;
}