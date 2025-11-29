
'use client';
import { useEffect, useState, useRef } from "react";
import { useUser } from "@/firebase/auth/use-user";
import { useSearchParams, useRouter } from "next/navigation";
import type { Chat, Message as MessageType, UserDocument } from "@/lib/types";
import { useFirebase } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  increment,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Send, ArrowLeft, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';


const ChatListSkeleton = () => (
  <div className="p-2 space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
        <div className="h-10 w-10 rounded-full bg-muted animate-pulse"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse"></div>
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse"></div>
        </div>
      </div>
    ))}
  </div>
);

const translationKeys = [
    'Messages',
    'No conversations yet.',
    'Select a conversation to start chatting.',
    'Loading chats...',
    'Creating chat...',
    'Type your message...',
    'Send message',
];


function formatTimestamp(ts: Timestamp | undefined | null): string {
    if (!ts) return '';
    try {
        return format(ts.toDate(), 'h:mm a');
    } catch (e) {
        // Handle cases where timestamp might not be a valid Firestore Timestamp temporarily
        return '';
    }
}


export default function ChatPage() {
  const { user } = useUser();
  const { db } = useFirebase();
  const t = useLanguage().manageTranslations(translationKeys);

  const searchParams = useSearchParams();
  const router = useRouter();

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Effect to handle creating/opening a chat from a URL param
  useEffect(() => {
    const chatWithId = searchParams.get('with');
    const urlChatId = searchParams.get('chatId');

    if (urlChatId) {
        setActiveChatId(urlChatId);
    } else if (chatWithId && user && db) {
        const findOrCreateChat = async () => {
            setIsCreatingChat(true);

            const chatsRef = collection(db, "chats");
            const q = query(
                chatsRef,
                where("participants", "array-contains", user.uid)
            );

            const querySnapshot = await getDocs(q);
            let existingChat = null;

            querySnapshot.forEach((doc) => {
                const chat = doc.data() as Chat;
                if (chat.participants.includes(chatWithId)) {
                    existingChat = { id: doc.id, ...chat };
                }
            });

            if (existingChat) {
                setActiveChatId(existingChat.id);
                router.replace(`/chat?chatId=${existingChat.id}`);
            } else {
                try {
                    const otherUserDocRef = doc(db, 'users', chatWithId);
                    const currentUserDocRef = doc(db, 'users', user.uid);
                    
                    const [otherUserSnap, currentUserSnap] = await Promise.all([
                        getDoc(otherUserDocRef),
                        getDoc(currentUserDocRef),
                    ]);

                    if (!otherUserSnap.exists() || !currentUserSnap.exists()) {
                         console.error("One of the users in chat does not exist.");
                         setIsCreatingChat(false);
                         return;
                    }

                    const otherUserData = otherUserSnap.data() as UserDocument;
                    const currentUserData = currentUserSnap.data() as UserDocument;

                    const newChatData = {
                        participants: [user.uid, chatWithId],
                        participantInfo: {
                            [user.uid]: {
                                name: `${currentUserData.firstName} ${currentUserData.lastName}`,
                                photoURL: currentUserData.photoURL || '',
                            },
                            [chatWithId]: {
                                name: `${otherUserData.firstName} ${otherUserData.lastName}`,
                                photoURL: otherUserData.photoURL || '',
                            },
                        },
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        unreadCounts: {
                            [user.uid]: 0,
                            [chatWithId]: 0,
                        }
                    };
                    
                    const newChatRef = await addDoc(chatsRef, newChatData);
                    setActiveChatId(newChatRef.id);
                    router.replace(`/chat?chatId=${newChatRef.id}`);
                } catch(e) {
                    console.error('Failed to create chat', e);
                    const permissionError = new FirestorePermissionError({
                        path: 'chats',
                        operation: 'create',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                }
            }
            setIsCreatingChat(false);
        };

        findOrCreateChat();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user, db]);


  // Effect to listen for user's chats
  useEffect(() => {
    if (!user || !db) return;

    setIsLoadingChats(true);
    const chatsRef = collection(db, "chats");
    const q = query(
      chatsRef,
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(userChats);
      setIsLoadingChats(false);
    }, (error) => {
      console.error("Error fetching chats:", error);
      const permissionError = new FirestorePermissionError({
        path: 'chats',
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      setIsLoadingChats(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  // Effect to listen for messages in the active chat
  useEffect(() => {
    if (!activeChatId || !db) {
      setMessages([]);
      return;
    };

    setIsLoadingMessages(true);
    const messagesRef = collection(db, "chats", activeChatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageType));
      setMessages(chatMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      const permissionError = new FirestorePermissionError({
        path: `chats/${activeChatId}/messages`,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      setIsLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [activeChatId, db]);

  const activeChat = chats.find(c => c.id === activeChatId);
  const otherParticipantId = activeChat?.participants.find(p => p !== user?.uid);
  const otherParticipantInfo = otherParticipantId ? activeChat?.participantInfo[otherParticipantId] : null;

 const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeChatId || !db || !otherParticipantId) return;
  
    const currentMessageText = newMessage;
    setNewMessage("");

    try {
        const messagesRef = collection(db, "chats", activeChatId, "messages");
        const chatRef = doc(db, 'chats', activeChatId);
        const notificationRef = collection(db, 'users', otherParticipantId, 'notifications');
        
        // 1. Add the new message to the messages subcollection
        await addDoc(messagesRef, {
            senderId: user.uid,
            text: currentMessageText,
            timestamp: serverTimestamp(),
        });

        // 2. Use a batch to update the chat document and create a notification atomically
        const batch = writeBatch(db);

        // Update the last message and timestamp on the chat document
        batch.set(chatRef, { 
            lastMessage: {
                text: currentMessageText,
                senderId: user.uid,
                timestamp: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
            [`unreadCounts.${otherParticipantId}`]: increment(1)
        }, { merge: true });

        // Create a new notification for the other user
        const newNotificationRef = doc(notificationRef); // Automatically generate ID
        batch.set(newNotificationRef, {
            userId: otherParticipantId,
            type: 'new_message' as const,
            title: `New message from ${user.displayName || 'a user'}`,
            message: currentMessageText,
            link: `/chat?chatId=${activeChatId}`,
            isRead: false,
            createdAt: serverTimestamp(),
        });

        await batch.commit();
  
    } catch(error) {
        console.error("Error sending message:", error);
        // Revert optimistic UI update if something fails
        setNewMessage(currentMessageText);
        const permissionError = new FirestorePermissionError({
            path: `chats/${activeChatId}/messages`,
            operation: 'create',
            requestResourceData: { text: currentMessageText }
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  const handleSelectChat = async (chatId: string) => {
    setActiveChatId(chatId);
    router.push(`/chat?chatId=${chatId}`);

    // Reset unread count for the current user in this chat
    if (user && db) {
        const chatRef = doc(db, 'chats', chatId);
        try {
            await setDoc(chatRef, {
                [`unreadCounts.${user.uid}`]: 0
            }, { merge: true });
        } catch (error) {
            console.error("Error resetting unread count:", error);
        }
    }
  };
  
  const handleBackToList = () => {
    setActiveChatId(null);
    router.push('/chat');
  };

  return (
    <div className="md:max-w-7xl mx-auto w-full">
    <div className="h-[calc(100vh-8rem)] bg-card border rounded-lg shadow-sm flex overflow-hidden max-w-full">
        {/* Sidebar */}
        <div className={cn(
            "w-full md:w-2/5 md:border-r flex-col",
            activeChatId ? "hidden md:flex" : "flex"
        )}>
            <div className="p-4 border-b">
                <h2 className="text-xl font-bold">{t('Messages')}</h2>
            </div>
            <ScrollArea className="flex-1">
                {isLoadingChats ? (
                    <ChatListSkeleton />
                ) : chats.length > 0 ? (
                    chats.map(chat => {
                        const otherUserId = chat.participants.find(p => p !== user?.uid);
                        const info = otherUserId ? chat.participantInfo[otherUserId] : null;
                        const unreadCount = user ? chat.unreadCounts?.[user.uid] || 0 : 0;
                        return (
                            <div
                                key={chat.id}
                                onClick={() => handleSelectChat(chat.id)}
                                className={cn(
                                    "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50",
                                    chat.id === activeChatId && "bg-muted"
                                )}
                            >
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={info?.photoURL} />
                                    <AvatarFallback>{info?.name?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                    <div className="flex justify-between items-center">
                                      <p className="font-semibold truncate">{info?.name}</p>
                                      <p className={cn(
                                          "text-xs shrink-0",
                                          unreadCount > 0 ? "text-primary font-bold" : "text-muted-foreground"
                                      )}>
                                          {formatTimestamp(chat.lastMessage?.timestamp)}
                                      </p>
                                    </div>
                                    <div className="flex justify-between items-start gap-2">
                                      <p className={cn(
                                          "text-sm truncate", 
                                          unreadCount > 0 ? "text-primary font-bold" : "text-muted-foreground"
                                      )}>
                                          {chat.lastMessage?.text}
                                      </p>
                                      {unreadCount > 0 && (
                                          <Badge className="bg-primary hover:bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center p-0 text-xs shrink-0">
                                              {unreadCount}
                                          </Badge>
                                      )}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="p-4 text-center text-muted-foreground">{t('No conversations yet.')}</div>
                )}
            </ScrollArea>
        </div>

        {/* Main Chat Window */}
        <div className={cn(
            "w-full md:w-3/5 flex-col",
            activeChatId ? "flex" : "hidden md:flex"
        )}>
            {activeChatId ? (
                <>
                    <div className="p-4 border-b flex items-center gap-3">
                         <Button variant="ghost" size="icon" onClick={handleBackToList} className={cn("md:hidden mr-2", activeChatId ? 'flex' : 'hidden')}>
                            <ArrowLeft className="h-5 w-5" />
                         </Button>
                         <Avatar>
                            <AvatarImage src={otherParticipantInfo?.photoURL} />
                            <AvatarFallback>{otherParticipantInfo?.name?.charAt(0) || 'U'}</AvatarFallback>
                         </Avatar>
                         <div>
                            <p className="font-bold">{otherParticipantInfo?.name}</p>
                         </div>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                        {isLoadingMessages ? (
                           <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                             messages.map(msg => (
                                <div key={msg.id} className={cn(
                                    "flex items-end gap-2 mb-4",
                                    msg.senderId === user?.uid ? "justify-end" : "justify-start"
                                )}>
                                    {msg.senderId !== user?.uid && (
                                         <Avatar className="h-6 w-6">
                                            <AvatarImage src={otherParticipantInfo?.photoURL} />
                                            <AvatarFallback>{otherParticipantInfo?.name?.charAt(0) || 'U'}</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div className={cn(
                                        "rounded-lg px-3 py-2 max-w-[80%] break-words",
                                        msg.senderId === user?.uid
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                    )}>
                                        <p>{msg.text}</p>
                                        <div className={cn(
                                            "text-xs mt-1.5 flex items-center gap-1",
                                            msg.senderId === user?.uid ? "text-primary-foreground/70 justify-end" : "text-muted-foreground justify-start"
                                        )}>
                                            <span>{formatTimestamp(msg.timestamp)}</span>
                                            {msg.senderId === user?.uid && <CheckCheck className="h-4 w-4" />}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </ScrollArea>
                    <div className="p-4 border-t bg-background">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <Input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder={t('Type your message...')}
                                autoComplete="off"
                            />
                            <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                                <Send className="h-5 w-5" />
                                <span className="sr-only">{t('Send message')}</span>
                            </Button>
                        </form>
                    </div>
                </>
            ) : (
                 <div className="hidden h-full items-center justify-center text-center text-muted-foreground md:flex">
                    <div className="flex flex-col items-center gap-2">
                        {isCreatingChat || isLoadingChats ? (
                            <>
                                <Loader2 className="h-12 w-12 animate-spin" />
                                <p className="text-lg">{isCreatingChat ? t('Creating chat...') : t('Loading chats...')}</p>
                            </>
                        ) : (
                             <>
                                <MessageSquare className="h-12 w-12" />
                                <p className="text-lg">{t('Select a conversation to start chatting.')}</p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
    </div>
  );
}
