import { randomUUID } from 'node:crypto';

export interface RequestState {
  requestId: string;
  invocationCount: number;
  serverInstanceId: string;
}

export function createRequestState(): RequestState {
  return {
    requestId: randomUUID(),
    invocationCount: 0,
    serverInstanceId: randomUUID(),
  };
}
