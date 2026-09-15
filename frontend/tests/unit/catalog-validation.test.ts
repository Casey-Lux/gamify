import { describe, expect, it } from 'vitest';
import { CatalogApiError, createArea, createSkill } from '../../src/lib/api/catalog';

describe('createSkill validation', () => {
  it('rejects an empty name without ever calling the network', async () => {
    await expect(createSkill('workspace-1', '   ', '')).rejects.toThrow(CatalogApiError);
  });

  it('rejects a name over 60 characters', async () => {
    await expect(createSkill('workspace-1', 'a'.repeat(61), '')).rejects.toThrow(CatalogApiError);
  });

  it('rejects a description over 500 characters', async () => {
    await expect(createSkill('workspace-1', 'Cocina', 'a'.repeat(501))).rejects.toThrow(
      CatalogApiError
    );
  });
});

describe('createArea validation', () => {
  it('rejects an empty name without ever calling the network', async () => {
    await expect(createArea('workspace-1', '   ')).rejects.toThrow(CatalogApiError);
  });

  it('rejects a name over 60 characters', async () => {
    await expect(createArea('workspace-1', 'a'.repeat(61))).rejects.toThrow(CatalogApiError);
  });
});
