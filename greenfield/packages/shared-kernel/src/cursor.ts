import { brand, type Brand } from './brand';

export type Cursor = Brand<string, 'Cursor'>;

export function createCursor(value: string): Cursor {
  return brand<string, 'Cursor'>(value);
}
