import { describe, expect, it } from 'vitest';
import { ProfileError, updateDisplayName } from '../../src/lib/api/profile';

describe('updateDisplayName validation', () => {
  it('rejects an empty name without ever calling the network', async () => {
    await expect(updateDisplayName('user-1', '   ')).rejects.toThrow(ProfileError);
  });

  it('rejects a name over 60 characters', async () => {
    const tooLong = 'a'.repeat(61);
    await expect(updateDisplayName('user-1', tooLong)).rejects.toThrow(ProfileError);
  });
});
