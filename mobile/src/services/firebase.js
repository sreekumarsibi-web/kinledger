import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { Platform } from "react-native";

export const isFirebaseConfigured = Boolean(
  (process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAO5B0aSFdftAZa0HcJRwzSdYNuIDeLoG0") &&
  (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "fambud-6807f") &&
  (process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:335683916320:web:4cfab1722ed11cc09e2245")
);

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAO5B0aSFdftAZa0HcJRwzSdYNuIDeLoG0",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "fambud-6807f.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "fambud-6807f",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "fambud-6807f.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "335683916320",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:335683916320:web:4cfab1722ed11cc09e2245"
};

export const firebaseApp = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const firebaseAuth = firebaseApp ? createFirebaseAuth() : null;

function createFirebaseAuth() {
  if (Platform.OS === "web") {
    return getAuth(firebaseApp);
  }

  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error) {
    return getAuth(firebaseApp);
  }
}

export function subscribeToAuth(callback) {
  if (!firebaseAuth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, callback);
}

export function loginWithEmail(email, password) {
  if (!firebaseAuth) throw new Error("Firebase is not configured. Fill mobile/.env first.");
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

export function registerWithEmail(email, password) {
  if (!firebaseAuth) throw new Error("Firebase is not configured. Fill mobile/.env first.");
  return createUserWithEmailAndPassword(firebaseAuth, email, password);
}

export function logout() {
  if (!firebaseAuth) return Promise.resolve();
  return signOut(firebaseAuth);
}

export function deleteCurrentFirebaseUser() {
  if (!firebaseAuth?.currentUser) throw new Error("No signed-in Firebase user.");
  return deleteUser(firebaseAuth.currentUser);
}

export function resetPassword(email) {
  if (!firebaseAuth) throw new Error("Firebase is not configured. Fill mobile/.env first.");
  return sendPasswordResetEmail(firebaseAuth, email);
}
