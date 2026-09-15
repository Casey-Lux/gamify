-- =============================================================================
-- 0017_workspaces_personal_constraint.sql
-- spec section 4: "Un usuario puede tener un workspace personal" — se lee como
-- "como mucho uno", no "puede tener varios". Se modela con un índice único
-- parcial en vez de una columna booleana + trigger, que es la forma más simple
-- y declarativa de expresar "a lo sumo una fila con is_personal = true por
-- created_by".
-- =============================================================================

create unique index workspaces_one_personal_per_creator_idx
  on public.workspaces (created_by)
  where is_personal;
