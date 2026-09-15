import { describe, expect, it } from 'vitest';
import { describePurchaseError, StoreApiError } from '../../src/lib/api/store';

describe('describePurchaseError', () => {
  it('maps insufficient funds (GM006) to a friendly Spanish message', () => {
    const err = new StoreApiError('insufficient funds', 'GM006');
    expect(describePurchaseError(err)).toBe('No tienes suficientes monedas para este item.');
  });

  it('maps out of stock (GM007) to a friendly Spanish message', () => {
    const err = new StoreApiError('item is out of stock', 'GM007');
    expect(describePurchaseError(err)).toBe('Este item está agotado por ahora.');
  });

  it('falls back to the raw message for an unrecognised code', () => {
    const err = new StoreApiError('some other db error', 'XX000');
    expect(describePurchaseError(err)).toBe('some other db error');
  });

  it('falls back to a generic message for a non-StoreApiError', () => {
    expect(describePurchaseError(new Error('network down'))).toBe(
      'No se pudo completar la compra.'
    );
  });
});
