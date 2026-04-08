'use client';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  path: string;
  operation: string;

  constructor(context: SecurityRuleContext) {
    super(`Missing or insufficient permissions: ${context.operation} at ${context.path}`);
    this.name = 'FirestorePermissionError';
    this.path = context.path;
    this.operation = context.operation;
  }

  // Helper para obter o contexto original se necessário
  get context(): SecurityRuleContext {
    return {
      path: this.path,
      operation: this.operation as any,
    };
  }
}
