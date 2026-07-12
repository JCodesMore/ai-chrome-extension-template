import { describe, it, expect } from 'vitest';
import { isMsg } from './messages';

describe('isMsg', () => {
  it('accepts a well-formed ping message', () => {
    expect(isMsg({ type: 'ping' })).toBe(true);
  });

  it('rejects unknown message types', () => {
    expect(isMsg({ type: 'nope' })).toBe(false);
  });

  it('rejects values that are not objects', () => {
    expect(isMsg(null)).toBe(false);
    expect(isMsg(undefined)).toBe(false);
    expect(isMsg('ping')).toBe(false);
    expect(isMsg(42)).toBe(false);
  });

  it('rejects objects without a type field', () => {
    expect(isMsg({})).toBe(false);
    expect(isMsg({ kind: 'ping' })).toBe(false);
  });
});
