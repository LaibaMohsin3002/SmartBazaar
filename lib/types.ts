
// src/lib/types.ts

import type { DocumentData, Timestamp } from "firebase/firestore";

// This represents the data fetched from Firestore, including user details
export type Listing = {
  id: string; // The document ID
  farmer: {
    name: string;
    avatarUrl: string;
    rating: number;
    reviews: number;
    uid: string;
  };
  crop: {
    name: string;
    imageUrl: string;
    imageHint: string;
  };
  quantity: number;
  unit: string;
  pricePerUnit: number;
  location: string;
  description?: string;
  createdAt: Timestamp | Date;
  status: 'active' | 'sold' | 'expired';
};

// This represents the raw document data stored in Firestore for a listing
export type ListingDocument = {
  farmerId: string;
  cropName: string;
  category: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  location: string;
  imageUrl: string;
  imageHint: string;
  description?: string;
  createdAt: Timestamp;
  status: 'active' | 'sold' | 'expired';
  buyerId?: string; // Added to track who bought the item
} & DocumentData;


// This represents the raw document data stored in Firestore for a user
export type UserDocument = {
    uid: string;
    email: string;
    role: 'farmer' | 'buyer';
    firstName: string;
    lastName: string;
    cnic: string;
    phone: string;
    location?: {
        address: string;
        city: string;
        province: string;
    };
    photoURL?: string;
    createdAt: string;
    rating?: number;
    reviews?: number;
    bio?: string;
    language?: 'en' | 'ur';
    soilType?: string;
    soilMoisture?: number;
    phLevel?: number;
    currentCrop?: string;
} & DocumentData;

export type OrderStatus = 'pending' | 'accepted' | 'rejected' | 'dispatched' | 'in_warehouse' | 'out_for_delivery' | 'delivered' | 'cancelled';

export type OrderHistoryItem = {
    status: OrderStatus;
    timestamp: Timestamp | Date;
}

// Renamed to UserInfoForOrder for clarity
export type UserInfoForOrder = {
    name: string;
    avatarUrl: string;
};

export type Order = {
    id: string;
    listingId: string;
    farmerId: string;
    buyerId: string;
    cropName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    subtotal: number;
    deliveryCharge: number;
    commission: number;
    farmerEarning: number;
    totalPrice: number;
    createdAt: Timestamp;
    status: OrderStatus;
    history?: OrderHistoryItem[];
    farmerInfo: UserInfoForOrder; 
    buyerInfo: UserInfoForOrder;  
}

export type OrderDocument = {
    listingId: string;
    farmerId: string;
    buyerId: string;
    cropName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    subtotal: number;
    deliveryCharge: number;
    commission: number;
    farmerEarning: number;
    totalPrice: number;
    createdAt: Timestamp;
    status: OrderStatus;
    history?: OrderHistoryItem[];
    // ✨ ADDED: Denormalized data for efficiency
    farmerInfo: UserInfoForOrder;
    buyerInfo: UserInfoForOrder;
} & DocumentData;


export type ChatParticipant = {
  name: string;
  photoURL: string;
};

export type Chat = {
  id: string;
  participants: string[];
  participantInfo: { [key: string]: ChatParticipant };
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  unreadCounts: { [key: string]: number };
};

export type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: Timestamp;
  isBot?: boolean;
}

export type NotificationType = 'new_message' | 'order_update' | 'new_order';

export type Notification = {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link: string;
    isRead: boolean;
    createdAt: Timestamp;
};

export type ReportData = {
    dateTime: string;
    location: string;
    weatherSummary: string;
    irrigationSuggestion: string;
    fertilizerAdvice: string;
    pestAndDiseaseAlerts: string;
    cropHealthIndex: string;
    weatherAlerts: string;
    aiRecommendation: string;
}

export type DailyReport = {
    id: string;
    farmerId: string;
    reportDate: string; // YYYY-MM-DD
    content: ReportData; 
    crops: string;
    createdAt: Timestamp;
}
