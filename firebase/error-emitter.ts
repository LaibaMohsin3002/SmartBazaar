import { EventEmitter } from 'events';
import type { FirestorePermissionError } from './errors';

type Events = {
  'permission-error': (error: FirestorePermissionError) => void;
};

// We need to extend the EventEmitter to have typed events
declare interface TypedEventEmitter {
  on<E extends keyof Events>(event: E, listener: Events[E]): this;
  off<E extends keyof Events>(event: E, listener: Events[E]): this;
  emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): boolean;
}

class TypedEventEmitter extends EventEmitter {}

export const errorEmitter = new TypedEventEmitter();
