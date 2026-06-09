'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // Log detalhado para depuração técnica
      console.error('🔥 [Firebase Permission Denied]', {
        operation: error.operation,
        path: error.path,
        timestamp: new Date().toISOString()
      });

      // Ignora o erro para 'config/parameters' silenciosamente no UI
      // Isso ocorre porque o documento pode não existir ainda e o fallback já existe no frontend.
      if (error.path.endsWith('config/parameters') && error.operation === 'get') {
        return;
      }

      toast({
        title: "Restrição de Acesso",
        description: `Seu perfil atual não permite ${error.operation} em ${error.path}.`,
        variant: "destructive",
      });

      // Removido o throw para evitar travar a interface em desenvolvimento
      // if (process.env.NODE_ENV === 'development') {
      //   const technicalError = new Error(`Permissão Negada: ${error.operation} em ${error.path}. Verifique as Firestore Rules.`);
      //   (technicalError as any).digest = 'FIREBASE_PERMISSION_DENIED';
      //   throw technicalError;
      // }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
