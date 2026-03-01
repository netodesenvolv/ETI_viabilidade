'use client';

/**
 * Ponto de entrada unificado para o Firebase.
 * Re-exporta todas as funcionalidades do diretório src/firebase/index.ts
 * para garantir compatibilidade com as rotas de importação @/firebase.
 */
import { 
  initializeFirebase,
  FirebaseProvider,
  FirebaseClientProvider,
  useCollection,
  useDoc,
  useUser,
  useFirebase,
  useFirebaseApp,
  useFirestore,
  useAuth
} from './firebase/index';

export {
  initializeFirebase,
  FirebaseProvider,
  FirebaseClientProvider,
  useCollection,
  useDoc,
  useUser,
  useFirebase,
  useFirebaseApp,
  useFirestore,
  useAuth
};
