import { AsyncLocalStorage } from 'node:async_hooks';

type CorrelationStore = { correlationId: string };

const storage = new AsyncLocalStorage<CorrelationStore>();

export const CorrelationContext = {
  run<T>(correlationId: string, callback: () => T): T {
    return storage.run({ correlationId }, callback);
  },

  getId(): string | undefined {
    return storage.getStore()?.correlationId;
  },
};
