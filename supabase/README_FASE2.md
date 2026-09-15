# Gamify — Fase 2 a 6: schema, Auth, workspaces, niveles, misiones, tienda

Esta carpeta contiene lo correspondiente a **Fase 2** a **Fase 6** del orden
de implementación del prompt maestro:

> Fase 2: Supabase · migrations · enums · tables · constraints · indexes · RLS
> Fase 3: Auth · profiles · workspaces · memberships
> Fase 4: skills · player_skills · level calculation
> Fase 5: RPC complete_mission
> Fase 6: RPC purchase_item

Todo se ha validado ejecutando las migrations, en orden, contra un
PostgreSQL 16 limpio (con un `auth.users` / `auth.uid()` de prueba que imita
el esquema `auth` de Supabase), y corriendo
`supabase/tests/level_calculation_test.sql` (Fase 4).

Se ha probado activamente el flujo completo de Fase 3:

- que al insertar una fila en `auth.users` se crea automáticamente el
  `profiles` correspondiente (con `display_name` desde los metadatos de
  signup, o desde el email, o un valor por defecto),
- que `create_workspace` crea el workspace **y** la membresía `OWNER` de
  forma atómica,
- que un usuario no puede tener dos workspaces personales
  (`workspaces_one_personal_per_creator_idx`),
- que `add_workspace_member` solo funciona si quien llama es `OWNER`, falla
  si el email no existe, y falla si el usuario ya es miembro,
- que `update_workspace_member_role` y `remove_workspace_member` impiden
  quedarse sin ningún `OWNER` en el workspace (incluso bajo condiciones de
  carrera, gracias al `FOR UPDATE` sobre la fila objetivo),
- que un `MEMBER` puede abandonar el workspace por sí mismo, pero no puede
  añadir ni expulsar a otros.

Y de Fase 4, mediante `supabase/tests/level_calculation_test.sql`:

- `xp_for_level(1) = 0` y `calculate_level(0) = 1`,
- `calculate_level` es exacto en cada umbral (ni un XP antes, ni un XP
  después, del nivel esperado) para los niveles 1–25,
- `xp_for_level` es estrictamente creciente, y el coste de cada nivel es
  mayor que el del anterior (niveles 1–50),
- `calculate_level` nunca decrece al aumentar el XP,
- `calculate_level_progress` es internamente consistente (nivel, XP dentro
  del nivel, XP para el siguiente, y porcentaje siempre en [0, 100]),
- el trigger que sincroniza `profiles.level` (y por el mismo código,
  `player_skills.level`) con la XP realmente se dispara y calcula bien.

Y de Fase 5, ejecutando `complete_mission` de verdad (no solo revisado a
ojo) contra Postgres:

- **camino feliz**: XP, monedas, nivel de jugador y nivel de skill se
  actualizan correctamente y `*_leveled_up` refleja el cambio real,
- **GM005**: rechaza completar si quedan submisiones sin marcar,
- **GM004**: rechaza completar una misión ya completada,
- **GM002**: rechaza si quien llama no es el `assigned_to`,
- **GM001**: rechaza si no hay usuario autenticado,
- **GM003**: rechaza si la misión no existe,
- **condición de carrera real**: 10 llamadas verdaderamente concurrentes
  (10 conexiones `psql` en paralelo) a `complete_mission` sobre la MISMA
  misión → exactamente 1 tuvo éxito, las otras 9 recibieron GM004, y el
  saldo final confirma que no hubo doble recompensa (una sola fila en
  `mission_completions`, una sola en `wallet_transactions`),
- **efectos**: un `XP_MULTIPLIER` activo se combina correctamente con un
  `XP_FLAT_BONUS` activo simultáneo (multiplicar primero, sumar después);
  un efecto ya expirado (`expires_at` en el pasado) se ignora aunque exista
  una fila más antigua del mismo tipo,
- **misión sin submisiones**: se completa directamente, sin bloqueo,
- **misión sin recompensa en monedas**: no genera una fila en
  `wallet_transactions` (el constraint `amount <> 0` lo hace innecesario).

Y de Fase 6, con `purchase_item` corrido de verdad:

- **ciclo económico exacto de la sección 19**: precio 20, 5 compras
  → stock 4,3,2,1,**reset a 5 y precio 22**; siguiente ciclo de 5 compras a
  22 → stock 4,3,2,1,**reset a 5 y precio 24** — idéntico al ejemplo del
  prompt maestro, número por número,
- **reemplazo de efectos**: comprar 11 veces el mismo `XP_MULTIPLIER`
  consecutivamente deja **exactamente 1** activación activa en todo
  momento (las 10 anteriores quedan `EXPIRED`), nunca acumulación,
- **GM006 / GM007 / GM003 / GM002**: saldo insuficiente, sin stock, item
  inactivo, y comprador que no es miembro del workspace del item, todos
  correctamente rechazados,
- **condición de carrera de fondos**: 10 compras verdaderamente
  concurrentes del mismo usuario, con saldo exacto para solo 1 → exactamente
  1 tuvo éxito, las otras 9 recibieron "insufficient funds", saldo final
  nunca negativo,
- **condición de carrera de stock**: 5 compradores distintos, todos con
  saldo de sobra, disparados en paralelo contra el mismo item → las 5
  transacciones se serializaron correctamente sobre el lock de fila
  (`stock`/`price` terminan exactamente donde deberían tras 5 decrementos +
  1 reset intermedio, sin pérdidas ni duplicados),
- **sanity check global**: tras toda la sesión de pruebas, cero filas con
  `stock`, `coins` o `price` negativos o fuera de rango en toda la base,
- **defensa en profundidad**: un `MEMBER` no puede escribir `store_items`
  ni `purchases` directamente, aunque `purchase_item` no existiera.

## Estructura

```
supabase/
├── migrations/
│   ├── 0001_extensions.sql
│   ├── 0002_enums.sql
│   ├── 0003_helper_functions.sql
│   ├── 0004_profiles.sql
│   ├── 0005_workspaces.sql
│   ├── 0006_skills.sql
│   ├── 0007_areas_missions.sql
│   ├── 0008_mission_subtasks.sql
│   ├── 0009_mission_completions.sql
│   ├── 0010_wallet_transactions.sql
│   ├── 0011_store_items.sql
│   ├── 0012_consumable_activations.sql
│   ├── 0013_purchases.sql
│   ├── 0014_indexes.sql
│   ├── 0015_column_privileges.sql
│   ├── 0016_rls_policies.sql
│   ├── 0017_workspaces_personal_constraint.sql   (Fase 3)
│   ├── 0018_auth_profile_provisioning.sql        (Fase 3)
│   ├── 0019_workspace_membership_rpcs.sql        (Fase 3)
│   ├── 0020_level_calculation.sql                (Fase 4)
│   ├── 0021_level_sync_triggers.sql              (Fase 4)
│   ├── 0022_mission_completions_flat_bonus_columns.sql  (Fase 5)
│   ├── 0023_complete_mission_rpc.sql             (Fase 5)
│   └── 0024_purchase_item_rpc.sql                (Fase 6)
├── tests/
│   └── level_calculation_test.sql                (Fase 4)
├── docs/
│   └── error_codes.md                            (Fase 5, reused Fase 6)
└── README_FASE2.md   (este archivo)
```

Cada archivo tiene un único propósito, referencia la sección del prompt
maestro que implementa, y puede leerse/revisarse de forma independiente.

Para correr los tests de Fase 4 contra una base de datos con las migrations
ya aplicadas:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/level_calculation_test.sql
```

## Cómo aplicarlo

```bash
supabase init                 # si el proyecto aún no tiene carpeta supabase/
supabase start                # levanta Postgres local
supabase db reset             # aplica todas las migrations desde cero
```

En producción, las mismas migrations se aplican con `supabase db push` (o
mediante el pipeline de CI que se documentará en una fase posterior),
nunca editando el schema manualmente desde el Dashboard.

## Modelo de seguridad (doble capa)

1. **Privilegios a nivel de columna** (`0015_column_privileges.sql`): el rol
   `authenticated` directamente **no tiene permiso SQL** para escribir
   columnas económicas (`profiles.total_xp/level/coins`,
   `player_skills.xp/level`, `missions.completed_at`,
   `store_items.stock`, etc.), sin importar lo que diga RLS.
2. **Row Level Security** (`0016_rls_policies.sql`): controla *qué filas*
   puede tocar un rol con los privilegios que sí tiene (p. ej. un `MEMBER`
   solo ve sus propias misiones; solo un `OWNER` puede gestionar skills,
   áreas y la tienda de su workspace).

Las futuras RPCs `complete_mission` (Fase 5) y `purchase_item` (Fase 6) se
crearán como `SECURITY DEFINER`, por lo que se ejecutan con los privilegios
de su propietario y **sí** pueden escribir esas columnas — son el único
camino legítimo para hacerlo, como exige la sección 53 del prompt maestro.

## Decisiones secundarias documentadas (no especificadas explícitamente)

- **Ownership de workspace**: se modela únicamente vía
  `workspace_members.role = 'OWNER'`, no con una columna `workspaces.owner_id`
  duplicada — una sola fuente de verdad.
- **Creación de workspace**: no se expone `INSERT` directo sobre
  `workspaces` ni `workspace_members` al cliente; se hará vía una RPC
  `SECURITY DEFINER` en Fase 3, para que el workspace y su primera membresía
  `OWNER` se creen atómicamente.
- **Borrado de workspace**: no se expone en la API de cliente del MVP
  (evita cascadas destructivas sobre historial económico).
- **Nombres únicos** de `skills`/`areas` por workspace: `UNIQUE(workspace_id,
  name)`, para evitar duplicados confusos en la UI.
- **`wallet_transactions.amount`**: entero con signo (positivo = ingreso,
  negativo = gasto), en vez de un importe sin signo + columna de dirección.
- **Visibilidad de `missions`**: un `MEMBER` ve las misiones que creó o que
  tiene asignadas; el `OWNER` ve todas las del workspace. Es un modelo de
  "tablero personal dentro de un workspace compartido", no "todos ven todo".
- **Visibilidad de `player_skills`**: solo el propio usuario (por defecto
  conservador). Ampliar esto a "el OWNER ve el progreso de su equipo" es un
  cambio de policy, no de schema, si se pide más adelante.
- **`store_items.price`**: el `OWNER` puede editarlo directamente (gestión de
  tienda); `stock` en cambio nunca es editable por el cliente — es un
  contador derivado que solo escribe la RPC `purchase_item` (Fase 6).
- **Alta de miembros (Fase 3)**: `add_workspace_member` busca por email a un
  usuario ya registrado; no existe sistema de invitación por enlace/email.
  El prompt maestro no describe un flujo de invitación y pide explícitamente
  evitar proveedores de email externos (sección 51), así que esta es la vía
  más simple que cumple "OWNER gestiona miembros". Añadir invitaciones por
  enlace más adelante es un cambio aditivo (tabla + RPC nuevas), no un
  rediseño de lo existente.
- **Workspace personal único (Fase 3)**: `Un usuario puede tener un workspace
  personal` se interpreta como "como mucho uno", enforced con un índice único
  parcial (`workspaces_one_personal_per_creator_idx`) en vez de lógica de
  aplicación.
- **display_name por defecto (Fase 3)**: al registrarse, se usa
  `raw_user_meta_data.display_name` si el cliente lo envía en el `signUp()`;
  si no, la parte local del email; si tampoco hay email, `'Player'`. No hay
  restricción de unicidad sobre `display_name` — dos jugadores pueden
  llamarse igual sin problema.
- **Último OWNER protegido (Fase 3)**: tanto `update_workspace_member_role`
  como `remove_workspace_member` bloquean quedarse sin ningún `OWNER`,
  usando `SELECT ... FOR UPDATE` sobre la fila objetivo para que dos
  degradaciones/expulsiones concurrentes no puedan dejar el workspace sin
  dueño (probado explícitamente, ver arriba).
- **Fórmula de nivel (Fase 4)**: el prompt maestro pide "progresión sencilla"
  con nivel 1 = 0 XP y cada nivel posterior más caro que el anterior, sin fijar
  la fórmula exacta. Se eligió `xp_for_level(L) = 50 * (L-1) * L` (número
  triangular): el coste de cada escalón de nivel crece linealmente
  (100, 200, 300, 400, ... XP por nivel), es fácil de explicar, fácil de
  testear, y se invierte con aritmética entera exacta (sin riesgo de
  redondeo en los umbrales, a diferencia de una fórmula cerrada con raíz
  cuadrada). Cambiar el balance del juego más adelante es editar una sola
  constante en un único archivo (`0020_level_calculation.sql`).
- **`level` como columna sincronizada, no calculada al vuelo (Fase 4)**: el
  propio prompt maestro define `level` como columna en `profiles` y
  `player_skills`, así que se mantiene como tal — pero un trigger
  (`0021_level_sync_triggers.sql`) la recalcula desde `xp`/`total_xp` en
  cada escritura, así que estructuralmente no puede desincronizarse,
  sin importar qué RPC futura toque esas filas.
- **Autorización de `complete_mission` (Fase 5)**: solo el `assigned_to`
  puede completar su propia misión. Ni el creador ni el `OWNER` del
  workspace pueden completarla en su nombre — completar es un acto personal
  de "hice la tarea". Se re-verifica también que siga siendo miembro del
  workspace por si se le expulsó después de asignársela.
- **Combinación de multiplicador + bonus plano (Fase 5)**: el prompt maestro
  prohíbe explícitamente acumular dos efectos del MISMO `effect_type`
  (sección 17), pero no dice qué pasa si un `XP_MULTIPLIER` y un
  `XP_FLAT_BONUS` están activos a la vez (son tipos distintos). Se decidió:
  multiplicar la base primero, sumar el bonus plano después —
  `xp_awarded = round(base_xp * xp_multiplier) + xp_flat_bonus`. Probado
  explícitamente (ver arriba).
- **Columnas `xp_flat_bonus`/`coin_flat_bonus` en `mission_completions`
  (Fase 5)**: el ejemplo de la sección 34 solo muestra `xp_multiplier`, pero
  omitir el desglose del bonus plano rompería la misma garantía de
  auditabilidad que esa sección exige para el multiplicador. Se añadieron
  como columna adicional (migration aditiva `0022`), sin tocar la tabla
  original de Fase 2.
- **Selección de efecto activo (Fase 5)**: por robustez, si por algún motivo
  hubiera más de una activación no expirada del mismo `effect_type` (no
  debería ocurrir una vez exista `purchase_item` en Fase 6, que reemplaza en
  vez de apilar), `complete_mission` toma la más recientemente activada, no
  falla ni suma ambas.
- **Reemplazo de efecto en el momento de compra (Fase 6)**: en vez de
  esperar a que un futuro query "decida" cuál activación es la vigente,
  `purchase_item` termina inmediatamente (`status = 'EXPIRED'`,
  `expires_at = LEAST(expires_at, NOW())`) cualquier activación activa del
  mismo `effect_type` para ese usuario, antes de insertar la nueva. Así
  nunca hay ambigüedad sobre cuál es "la" activación vigente de un tipo,
  en ningún punto en el tiempo.
- **Orden de locks (Fase 6)**: `purchase_item` bloquea `store_items` y
  luego `profiles`, en ese orden — el mismo orden relativo que
  `complete_mission` (`missions` y luego `profiles`). Mantener un orden de
  bloqueo consistente entre RPCs evita interbloqueos (deadlocks) si algún
  día se llaman de forma anidada o casi simultánea para el mismo usuario.
- **Autorización de compra (Fase 6)**: aunque no está en la lista explícita
  de 14 pasos de la sección 18, `purchase_item` re-verifica que quien
  compra sea miembro del workspace del item — sin este chequeo, al ser
  `SECURITY DEFINER`, cualquier usuario autenticado podría comprar items de
  cualquier workspace ajeno saltándose RLS. Probado explícitamente.

## Un detalle técnico real, detectado probando (no solo revisando código)

Al ejecutar `complete_mission` contra Postgres de verdad, salieron dos
errores de "columna ambigua" que una revisión visual del SQL no habría
detectado: en PL/pgSQL, los nombres de columna de un `RETURNS TABLE` se
convierten en variables implícitas visibles en toda la función, y chocan
con columnas reales del mismo nombre usadas en las queries internas
(`mission_subtasks.mission_id`, `player_skills.skill_id`, y de forma más
seria, dentro de una lista de `ON CONFLICT (...)`, que no admite
cualificación de tabla en SQL estándar). La solución correcta e idiomática
es la directiva `#variable_conflict use_column` al inicio del cuerpo de la
función, documentada así mismo dentro de `0023_complete_mission_rpc.sql`.
Se deja esta nota aquí porque es exactamente el tipo de bug que "parece
correcto al leerlo" pero solo aparece al ejecutarlo — por eso cada fase de
este proyecto se valida corriendo las migrations y las RPCs contra un
Postgres real, no solo redactando SQL.

## Qué queda fuera de Fase 2 a 6 (a propósito)

Siguiendo el orden de implementación del propio prompt maestro (sección 54):

- Políticas de Supabase Storage para `avatars/{user_id}/avatar.webp` → Fase 10.
- Configuración de Supabase Auth (plantillas de email, recuperación de
  contraseña, etc.) → documentación de despliegue, Fase 13.
- `seed.sql` → ahora que ya existen `create_workspace`, `complete_mission` y
  `purchase_item`, se generará en la fase de scaffolding del frontend
  (Fase 7+), para poblar un escenario de ejemplo completo end-to-end.
- Job de mantenimiento que marque `consumable_activations.status = 'EXPIRED'`
  para activaciones ya vencidas por tiempo → explícitamente no requerido
  por el prompt maestro ("no utilizar un cron por minuto para que el
  sistema funcione", sección 16); `expires_at > NOW()` ya es la autoridad
  real en todo momento, el `status` es solo cosmético.

Nada de lo anterior falta por omisión: se pospone deliberadamente para
seguir el orden de fases del propio documento.
