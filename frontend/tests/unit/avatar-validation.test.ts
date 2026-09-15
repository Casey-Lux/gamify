import { describe, expect, it } from 'vitest';
import { AvatarError, validateAvatarFile } from '../../src/lib/api/avatar';

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('validateAvatarFile', () => {
  it('accepts a small JPEG', () => {
    expect(() => validateAvatarFile(makeFile('photo.jpg', 'image/jpeg', 1024))).not.toThrow();
  });

  it('accepts a small PNG and WebP too', () => {
    expect(() => validateAvatarFile(makeFile('photo.png', 'image/png', 1024))).not.toThrow();
    expect(() => validateAvatarFile(makeFile('photo.webp', 'image/webp', 1024))).not.toThrow();
  });

  it('rejects an unsupported MIME type', () => {
    expect(() => validateAvatarFile(makeFile('photo.gif', 'image/gif', 1024))).toThrow(AvatarError);
  });

  it('rejects a mismatched/unsupported extension even with an allowed MIME type', () => {
    // Spoofed extension: browsers set `.type` from content sniffing, but a
    // malicious/renamed file could still carry a disallowed extension.
    expect(() => validateAvatarFile(makeFile('photo.exe', 'image/jpeg', 1024))).toThrow(
      AvatarError
    );
  });

  it('rejects a file with no extension at all', () => {
    expect(() => validateAvatarFile(makeFile('photo', 'image/jpeg', 1024))).toThrow(AvatarError);
  });

  it('rejects a file above the raw upload size cap', () => {
    const tooBig = 9 * 1024 * 1024;
    expect(() => validateAvatarFile(makeFile('huge.jpg', 'image/jpeg', tooBig))).toThrow(
      AvatarError
    );
  });

  it('is case-insensitive about the extension', () => {
    expect(() => validateAvatarFile(makeFile('photo.JPG', 'image/jpeg', 1024))).not.toThrow();
  });
});
