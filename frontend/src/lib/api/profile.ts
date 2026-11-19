import { supabase } from '$lib/supabase/client';

export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileError';
  }
}

const MAX_DISPLAY_NAME_LENGTH = 60;

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) throw new ProfileError('El nombre no puede estar vacío.');
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new ProfileError(`El nombre no puede superar ${MAX_DISPLAY_NAME_LENGTH} caracteres.`);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId);

  if (error) throw new ProfileError(error.message);
}
