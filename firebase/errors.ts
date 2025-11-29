export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `Firestore Permission Denied: Cannot ${context.operation} on ${context.path}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }

  toContextObject() {
    return this.context;
  }
}
