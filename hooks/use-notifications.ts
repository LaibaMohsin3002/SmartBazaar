
'use client';
import { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import { collection, query, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function useNotifications() {
  const { db } = useFirebase();
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !db) {
        setNotifications([]);
        setUnreadCount(0);
        return;
    }

    const notifsRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(notifsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      setNotifications(notifsData);
      const newUnreadCount = notifsData.filter(n => !n.isRead).length;
      setUnreadCount(newUnreadCount);

    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: notifsRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [user, db]);
  
  const markNotificationsAsRead = async (notificationIds: string[]) => {
    if (!db || !user || notificationIds.length === 0) return;
  
    try {
      const batch = writeBatch(db);
      notificationIds.forEach(id => {
        const notifRef = doc(db, 'users', user.uid, 'notifications', id);
        batch.update(notifRef, { isRead: true });
      });
      await batch.commit();
      
    } catch(error) {
       console.error("Error marking notifications as read:", error);
       const permissionError = new FirestorePermissionError({
          path: `users/${user.uid}/notifications`,
          operation: 'update',
       });
       errorEmitter.emit('permission-error', permissionError);
    }
  }


  return { notifications, unreadCount, markNotificationsAsRead };
}