'use client';
import { useEffect, useState, useRef } from "react";
import { useUser } from "@/firebase/auth/use-user";
import type { Message as MessageType, UserDocument } from "@/lib/types";
import { useFirebase } from "@/firebase";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User as UserIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { askAgroGuru } from "@/ai/flows/agro-guru-chat";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';


const translationKeys = [
    'Welcome to AgroGuru!',
    'Ask me anything about farming.',
    'Type your question...',
    'Send',
];

function formatTimestamp(ts: Timestamp | Date | undefined | null): string {
    if (!ts) return '';
    const date = (ts instanceof Timestamp) ? ts.toDate() : ts;
    try {
        return format(date as Date, 'h:mm a');
    } catch (e) {
        return '';
    }
}


export default function AgroGuruPage() {
  const { user, data: userData } = useUser();
  const { db } = useFirebase();
  const t = useLanguage().manageTranslations(translationKeys);
  const { toast } = useToast();

  const [messages, setMessages] = useState<MessageType[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isResponding]);

  // Effect to listen for messages in the AgroGuru chat
  useEffect(() => {
    if (!user || !db) return;

    setIsLoading(true);
    const messagesRef = collection(db, "agroguru", user.uid, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageType));
      setMessages(chatMessages);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching AgroGuru messages:", error);
      const permissionError = new FirestorePermissionError({
        path: `agroguru/${user.uid}/messages`,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !db || !userData) return;
  
    const currentMessageText = newMessage;
    setNewMessage("");

    const userMessage: Omit<MessageType, 'id' | 'timestamp'> = {
        senderId: user.uid,
        text: currentMessageText,
        isBot: false,
    };
    
    // Optimistically add user message to UI
    const tempUserMessage = {...userMessage, id: 'temp-user', timestamp: new Date() as any};
    setMessages(prev => [...prev, tempUserMessage]);
    
    setIsResponding(true);

    try {
        const messagesRef = collection(db, "agroguru", user.uid, "messages");
        
        // Save user message to Firestore
        await addDoc(messagesRef, {
            ...userMessage,
            timestamp: serverTimestamp(),
        });
        
        // Call the AI flow
        const aiResult = await askAgroGuru({
            farmerQuery: currentMessageText,
            farmerContext: {
                language: userData.language || 'en',
                city: userData.location?.city || '',
                soilType: userData.soilType,
                soilMoisture: userData.soilMoisture,
                phLevel: userData.phLevel,
                currentCrop: userData.currentCrop
            }
        });

        const botMessage: Omit<MessageType, 'id' | 'timestamp'> = {
            senderId: 'agroguru-bot',
            text: aiResult.response,
            isBot: true,
        };

        // Save bot response to Firestore
        await addDoc(messagesRef, {
            ...botMessage,
            timestamp: serverTimestamp(),
        });

    } catch(error: any) {
        console.error("Error in AgroGuru chat:", error);
        toast({
            variant: "destructive",
            title: "AI Chat Error",
            description: "Could not get a response from AgroGuru. Please try again."
        });
        // Optionally remove the optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== 'temp-user'));
    } finally {
        setIsResponding(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] bg-card border rounded-lg shadow-sm flex flex-col overflow-hidden max-w-4xl mx-auto">
        <div className="p-4 border-b flex items-center gap-3 bg-primary/10">
             <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground"><Bot /></AvatarFallback>
             </Avatar>
             <div>
                <p className="font-bold text-lg">AgroGuru</p>
                <p className="text-sm text-muted-foreground">Your AI Farming Assistant</p>
             </div>
        </div>
        <ScrollArea className="flex-1 p-4">
            {isLoading ? (
               <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <Bot className="h-16 w-16 mb-4" />
                    <h2 className="text-xl font-semibold">{t('Welcome to AgroGuru!')}</h2>
                    <p>{t('Ask me anything about farming.')}</p>
                </div>
            ) : (
                 messages.map(msg => (
                    <div key={msg.id} className={cn(
                        "flex items-start gap-3 mb-6",
                        !msg.isBot && "justify-end"
                    )}>
                        {msg.isBot && (
                             <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                <AvatarFallback><Bot className="h-5 w-5"/></AvatarFallback>
                            </Avatar>
                        )}
                        <div className={cn(
                            "rounded-lg px-4 py-3 max-w-[85%] break-words shadow-sm",
                            msg.isBot
                                ? "bg-muted rounded-tl-none"
                                : "bg-primary text-primary-foreground rounded-tr-none"
                        )}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <div className={cn(
                                "text-xs mt-2 flex items-center gap-1",
                                msg.isBot ? "text-muted-foreground justify-start" : "text-primary-foreground/70 justify-end"
                            )}>
                               <span>{formatTimestamp(msg.timestamp)}</span>
                               {!msg.isBot && msg.id !== 'temp-user' && <Check className="h-4 w-4" />}
                            </div>
                        </div>
                         {!msg.isBot && (
                             <Avatar className="h-8 w-8">
                                <AvatarImage src={user?.photoURL || undefined} />
                                <AvatarFallback><UserIcon className="h-5 w-5"/></AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                ))
            )}
            {isResponding && (
                <div className="flex items-start gap-3 mb-6">
                    <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                        <AvatarFallback><Bot className="h-5 w-5"/></AvatarFallback>
                    </Avatar>
                    <div className="rounded-lg px-4 py-3 max-w-[85%] bg-muted rounded-tl-none shadow-sm flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin shrink-0"/>
                        <span>Thinking...</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </ScrollArea>
        <div className="p-4 border-t bg-background">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={t('Type your question...')}
                    autoComplete="off"
                    disabled={isResponding}
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim() || isResponding}>
                    <Send className="h-5 w-5" />
                    <span className="sr-only">{t('Send')}</span>
                </Button>
            </form>
        </div>
    </div>
  );
}
