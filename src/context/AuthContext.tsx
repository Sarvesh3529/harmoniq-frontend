"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, User, signInAnonymously, linkWithPopup } from "firebase/auth";
import { doc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { auth, db } from "../lib/firebase"; // Make sure db is exported from your firebase config file

// --- Supabase client (frontend, anon key only) ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let supabaseClient: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

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
      if (currentUser) {
        setUser(currentUser);

        // 1. Sync user details to Firestore (existing behaviour)
        const userRef = doc(db, "users", currentUser.uid);
        try {
          await setDoc(
            userRef,
            {
              uid: currentUser.uid,
              name: currentUser.displayName || "Anonymous User",
              email: currentUser.email || null,
              photoURL: currentUser.photoURL || null,
              role: "user",
              lastLoginAt: serverTimestamp(),
              loginCount: increment(1),
            },
            { merge: true }
          );
          console.log("User profile synced with Firestore successfully.");
        } catch (error) {
          console.error("Error syncing user data to Firestore:", error);
        }

        // 2. Upsert the same profile into Supabase public.users
        if (supabaseClient) {
          try {
            let currentCount = 0;
            const { data: existingUser } = await supabaseClient
              .from("users")
              .select("login_count, loginCount")
              .eq("uid", currentUser.uid)
              .maybeSingle();

            if (existingUser) {
              currentCount = existingUser.login_count ?? existingUser.loginCount ?? 0;
            }

            const { error: sbErr } = await supabaseClient
              .from("users")
              .upsert(
                {
                  uid: currentUser.uid,
                  name: currentUser.displayName || "Anonymous User",
                  email: currentUser.email ?? null,
                  photo_url: currentUser.photoURL ?? null,
                  role: "user",
                  last_login_at: new Date().toISOString(),
                  login_count: currentCount + 1,
                },
                { onConflict: "uid" }
              );
            if (sbErr) {
              console.warn("Supabase user profile upsert failed:", sbErr.message);
            } else {
              console.log("User profile synced with Supabase successfully.");
            }
          } catch (err) {
            console.warn("Supabase user profile sync error:", err);
          }
        }

        setLoading(false);
      } else {
        // Sign in anonymously if there is no current user session
        try {
          console.log("No current user session. Signing in anonymously...");
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous Sign-In Error:", error);
          setLoading(false);
        }
      }
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
      console.log("User signed in successfully with Google.");
    } catch (error: any) {
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
