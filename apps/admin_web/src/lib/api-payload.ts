import { isRecord } from './type-guards';

export type ApiDataWrapper<TPayload> = {
  data: TPayload;
};

export function unwrapPayload<TPayload>(payload: TPayload | ApiDataWrapper<TPayload>): TPayload {
  if (isRecord(payload) && 'data' in payload) {
    return payload.data as TPayload;
  }
  return payload;
}

export function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
