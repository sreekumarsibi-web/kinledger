import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const isFirebaseConfigured = Boolean(
  (process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAO5B0aSFdftAZa0HcJRwzSdYNuIDeLoG0") &&
  (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "fambud-6807f") &&
  (process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:335683916320:web:4cfab1722ed11cc09e2245")
);

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAO5B0aSFdftAZa0HcJRwzSdYNuIDeLoG0",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "fambud-6807f.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "fambud-6807f",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "fambud-6807f.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "335683916320",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:335683916320:web:4cfab1722ed11cc09e2245"
};

export let firebaseApp = null;
export let firebaseAuth = null;
let firebaseModules = null;
let authInitPromise = null;

async function loadFirebaseAuth() {
  if (!isFirebaseConfigured) return null;
  if (authInitPromise) return authInitPromise;

  authInitPromise = Promise.all([
    import("firebase/app"),
    import("firebase/auth")
  ]).then(([appModule, authModule]) => {
    firebaseModules = authModule;
    firebaseApp = firebaseApp || appModule.initializeApp(firebaseConfig);

    if (firebaseAuth) return firebaseAuth;
    if (Platform.OS === "web") {
      firebaseAuth = authModule.getAuth(firebaseApp);
      return firebaseAuth;
    }

    try {
      firebaseAuth = authModule.initializeAuth(firebaseApp, {
        persistence: authModule.getReactNativePersistence(AsyncStorage)
      });
    } catch (error) {
      firebaseAuth = authModule.getAuth(firebaseApp);
    }

    return firebaseAuth;
  });

  return authInitPromise;
}

export function subscribeToAuth(callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }

  let unsubscribe = () => {};
  let cancelled = false;
  loadFirebaseAuth()
    .then((auth) => {
      if (cancelled || !auth) return;
      unsubscribe = firebaseModules.onAuthStateChanged(auth, callback);
    })
    .catch(() => callback(null));

  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export async function loginWithEmail(email, password) {
  const auth = await loadFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured. Fill mobile/.env first.");
  return firebaseModules.signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email, password) {
  const auth = await loadFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured. Fill mobile/.env first.");
  return firebaseModules.createUserWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  const auth = await loadFirebaseAuth();
  if (!auth) return;
  return firebaseModules.signOut(auth);
}

export async function deleteCurrentFirebaseUser() {
  const auth = await loadFirebaseAuth();
  if (!auth?.currentUser) throw new Error("No signed-in Firebase user.");
  return firebaseModules.deleteUser(auth.currentUser);
}

export async function resetPassword(email) {
  const auth = await loadFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured. Fill mobile/.env first.");
  return firebaseModules.sendPasswordResetEmail(auth, email);
}
