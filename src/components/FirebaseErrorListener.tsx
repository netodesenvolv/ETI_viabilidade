'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // Surfacing a rich error for development overlays
      console.error('Firebase Permission Error:', error.context);
      
      toast({
        variant: "destructive",
        title: "Erro de Permissão",
        description: `Você não tem autorização para ${error.context.operation} em ${error.context.path}.`,
      });
      
      // In development, this will trigger the Next.js error overlay
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
