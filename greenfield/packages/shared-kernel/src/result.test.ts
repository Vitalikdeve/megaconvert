import { describe, expect, it } from 'vitest';

import { err, ok } from './result';

describe('result helpers', () => {
  it('creates success results', () => {
    expect(ok('value')).toEqual({
      ok: true,
      value: 'value',
    });
  });

  it('creates error results', () => {
    expect(err('failure')).toEqual({
      error: 'failure',
      ok: false,
    });
  });
});
