"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";
import { doc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; // Make sure db is exported from your firebase config file

// Define the interface for our context state
interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

// Initialize our context with empty default values matching the interface
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  loginWithGoogle: async () => {},
});

interface AuthContextProviderProps {
  children: ReactNode;
}

export function AuthContextProvider({ children }: AuthContextProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Sync user details to Firestore using their permanent Google UID
        const userRef = doc(db, "users", currentUser.uid);
        
        try {
          await setDoc(
            userRef,
            {
              uid: currentUser.uid,
              name: currentUser.displayName || "Anonymous User",
              email: currentUser.email,
              photoURL: currentUser.photoURL,
              role: "user", // Default security role assignment
              lastLoginAt: serverTimestamp(), // Records exact server time of active session
              loginCount: increment(1), // Increments cleanly without reading the document first
            },
            { merge: true } // Keeps existing data safe when fields update
          );
          console.log("User profile synced with database successfully.");
        } catch (error) {
          console.error("Error syncing user data to Firestore:", error);
        }
      }
      
      setLoading(false);
    });

    // Unsubscribe from the listener when the provider unmounts
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    
    // FORCE Google to show the account picker screen every single time
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Sign-In Error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to cleanly consume auth context inside components
export const useAuth = () => useContext(AuthContext);
