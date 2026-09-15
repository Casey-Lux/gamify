import { supabase } from '$lib/supabase/client';

export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarError';
  }
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
// Generous cap on the ORIGINAL upload the user picks — the file actually
// stored is always compressed under MAX_STORED_BYTES regardless of this.
const MAX_RAW_BYTES = 8 * 1024 * 1024;
/** Spec section 30: "máximo ~512 KB por avatar". */
const MAX_STORED_BYTES = 512 * 1024;
/** Square output size in px — plenty for an avatar shown at card/thumbnail sizes. */
const TARGET_SIZE = 256;
const MIN_SOURCE_DIMENSION = 32;

/** Spec section 30: "Validar: MIME type · extensión · tamaño". Dimensions
 * are validated separately in `uploadAvatar`, once the file is actually
 * decoded into an `<img>` (there is no way to read pixel dimensions from a
 * `File` without decoding it first). */
export function validateAvatarFile(file: File): void {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new AvatarError('Formato no permitido. Usa JPG, PNG o WebP.');
  }

  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new AvatarError('Extensión de archivo no permitida.');
  }

  if (file.size > MAX_RAW_BYTES) {
    throw new AvatarError('El archivo es demasiado grande (máximo 8 MB antes de comprimir).');
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new AvatarError('No se pudo leer la imagen.'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Center-crops to a square, then scales to `size`×`size` — a fixed-size
 * square output keeps every avatar consistent regardless of what aspect
 * ratio the user's original photo had. */
function drawSquareCanvas(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AvatarError('No se pudo procesar la imagen.');

  const minSide = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - minSide) / 2;
  const sy = (img.naturalHeight - minSide) / 2;
  ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
  return canvas;
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AvatarError('No se pudo generar la imagen.'))),
      'image/webp',
      quality
    );
  });
}

/** Spec section 30 recommendation: "redimensionar/comprimir antes de subir
 * · preferir WebP". Tries decreasing quality steps until the file fits
 * under the 512 KB target; a 256×256 WebP photo essentially always fits
 * well before quality gets low enough to look bad, so hitting the floor
 * below is not expected in practice. */
async function compressToLimit(canvas: HTMLCanvasElement): Promise<Blob> {
  let quality = 0.9;
  let blob = await canvasToWebp(canvas, quality);

  while (blob.size > MAX_STORED_BYTES && quality > 0.3) {
    quality -= 0.15;
    blob = await canvasToWebp(canvas, quality);
  }

  if (blob.size > MAX_STORED_BYTES) {
    throw new AvatarError('No se pudo comprimir la imagen por debajo de 512 KB.');
  }

  return blob;
}

/**
 * Validates, resizes and compresses `file`, uploads it to
 * `avatars/{userId}/avatar.webp`, and updates `profiles.avatar_path` to
 * match. Returns the stored path (what the caller should pass to
 * `getAvatarSignedUrl`).
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  validateAvatarFile(file);

  const img = await loadImage(file);
  if (img.naturalWidth < MIN_SOURCE_DIMENSION || img.naturalHeight < MIN_SOURCE_DIMENSION) {
    throw new AvatarError(
      `La imagen es demasiado pequeña (mínimo ${MIN_SOURCE_DIMENSION}×${MIN_SOURCE_DIMENSION}px).`
    );
  }

  const canvas = drawSquareCanvas(img, TARGET_SIZE);
  const blob = await compressToLimit(canvas);

  const path = `${userId}/avatar.webp`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/webp', cacheControl: '3600' });
  if (uploadError) throw new AvatarError(uploadError.message);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userId);
  if (profileError) throw new AvatarError(profileError.message);

  return path;
}

/** The `avatars` bucket is private (see 0025_avatar_storage.sql), so
 * displaying an avatar always needs a short-lived signed URL rather than a
 * public one. Returns null on any failure so callers can fall back to a
 * placeholder instead of breaking the page. */
export async function getAvatarSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}
