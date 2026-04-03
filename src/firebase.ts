import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAsGdzCjWTdaAnyB5kJohu_xLGBjwtCEuk",
  authDomain: "the-hub-ae1b5.firebaseapp.com",
  projectId: "the-hub-ae1b5",
  storageBucket: "the-hub-ae1b5.firebasestorage.app",
  messagingSenderId: "794984923709",
  appId: "1:794984923709:web:d6157f083f875e89b52054",
  measurementId: "G-NYVJ26M8CV"
};

// Initialize Firebase only if it hasn't been initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
