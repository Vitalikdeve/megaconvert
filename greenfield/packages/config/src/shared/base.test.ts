import { describe, expect, it } from 'vitest';

import {
  booleanStringSchema,
  commaSeparatedStringSchema,
  optionalUrlSchema,
} from './base';

describe('config parsing helpers', () => {
  it('normalizes comma separated values', () => {
    expect(commaSeparatedStringSchema.parse('a, b,,c')).toEqual(['a', 'b', 'c']);
  });

  it('allows optional urls to be omitted with blank strings', () => {
    expect(optionalUrlSchema.parse('')).toBeUndefined();
  });

  it('parses boolean-like configuration values', () => {
    expect(booleanStringSchema.parse('true')).toBe(true);
    expect(booleanStringSchema.parse('off')).toBe(false);
  });
});
