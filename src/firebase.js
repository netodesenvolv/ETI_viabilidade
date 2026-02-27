import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, collection, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Retorna a instância do auth diretamente (para signInWithEmailAndPassword etc.)
export function useAuth() {
  return auth;
}

export function useFirestore() { return db; }

// Retorna o usuário logado atual
export function useUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    return auth.onAuthStateChanged(setUser);
  }, []);
  return { user };
}

export function useDoc(ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ref) { setLoading(false); return; }
    const unsub = onSnapshot(ref, snap => {
      setData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    return unsub;
  }, [ref]);
  return { data, loading };
}

export function useCollection(ref) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ref) { setLoading(false); return; }
    const unsub = onSnapshot(ref, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [ref]);
  return { data, loading };
}

export default app;
