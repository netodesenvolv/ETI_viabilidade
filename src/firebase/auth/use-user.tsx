
'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, Auth } from 'firebase/auth';

/**
 * Hook para monitorar o estado de autenticação do Firebase.
 * Retorna o usuário atual e o estado de carregamento inicial.
 */
export function useUser(auth: Auth | null) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // O onAuthStateChanged é a única fonte de verdade para a sessão
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
}
