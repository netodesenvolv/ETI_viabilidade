'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { firebaseConfig } from './config';

/**
 * Inicializa as instâncias do Firebase de forma idempotente.
 * Garante que emuladores sejam usados apenas em ambiente de desenvolvimento local.
 */
export function initializeFirebase() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // PROTEÇÃO DE PRODUÇÃO: Conecta aos emuladores apenas se explicitamente configurado em DEV
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    console.warn("Ambiente de Desenvolvimento: Conectando aos Emuladores Firebase.");
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099');
  }

  return { app, db, auth };
}

// Exportações unificadas de hooks e provedores
export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
