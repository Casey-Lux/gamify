import { supabase } from '$lib/supabase/client';
import type { Area, Skill } from '$lib/types/domain';

export class CatalogApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'CatalogApiError';
  }
}

const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 500;

export async function createSkill(
  workspaceId: string,
  name: string,
  description: string
): Promise<Skill> {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  if (trimmedName.length === 0) throw new CatalogApiError('El nombre de la skill es obligatorio.');
  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw new CatalogApiError(`El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`);
  }
  if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
    throw new CatalogApiError(
      `La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`
    );
  }

  const { data, error } = await supabase
    .from('skills')
    .insert({
      workspace_id: workspaceId,
      name: trimmedName,
      description: trimmedDescription.length > 0 ? trimmedDescription : null
    })
    .select()
    .single();

  if (error) throw new CatalogApiError(error.message, error.code);
  return data as Skill;
}

export async function createArea(workspaceId: string, name: string): Promise<Area> {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) throw new CatalogApiError('El nombre del área es obligatorio.');
  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw new CatalogApiError(`El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`);
  }

  const { data, error } = await supabase
    .from('areas')
    .insert({ workspace_id: workspaceId, name: trimmedName })
    .select()
    .single();

  if (error) throw new CatalogApiError(error.message, error.code);
  return data as Area;
}
