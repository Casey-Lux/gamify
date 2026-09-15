# Gamify — Fase 1 + Fase 7: scaffolding y UI de Misiones

Esta carpeta (`frontend/`) contiene lo correspondiente a **Fase 1** y **Fase 7**
del orden de implementación del prompt maestro (sección 54):

> Fase 1: scaffolding · configuración · TypeScript · lint · format · testing
> Fase 7: missions UI · filtros · ordenamiento · paginación

Se apoya directamente en el schema/RLS/RPCs de `../supabase` (Fase 2 a 6),
leídos migration por migration para que los tipos y las queries del frontend
coincidan exactamente con lo que la base de datos expone.

## Verificado en este entorno

Contra Node 22 / npm 10, con `npm install` desde cero:

- `npx svelte-kit sync` — OK
- `npm run check` (svelte-check, TypeScript strict) — **0 errores, 0 warnings**
- `npm run lint` (eslint + prettier --check) — **sin errores**
- `npm run test:unit` (vitest) — **16/16 tests pasando**, 3 archivos
- `npm run build` (`vite build` con `adapter-static`) — genera `build/`
  correctamente como sitio estático

`npm run test:e2e` (Playwright) tiene configuración y un smoke test del auth
guard, pero la suite completa de aceptación (sección 44/54 Fase 12) necesita
un proyecto Supabase real o local con datos — se añade en Fase 12.

## Estructura

```
frontend/
├── src/
│   ├── app.html, app.d.ts
│   ├── lib/
│   │   ├── supabase/client.ts          # cliente único, solo env públicas
│   │   ├── types/
│   │   │   ├── domain.ts               # tipos = schema de supabase/migrations
│   │   │   └── mission-query.ts        # filtros/orden/paginación (Fase 7)
│   │   ├── api/
│   │   │   ├── missions.ts             # fetchMissionsPage, completeMission, setSubtaskCompleted
│   │   │   └── level.ts                # llama a calculate_level_progress (nunca reimplementa la fórmula)
│   │   ├── stores/
│   │   │   ├── auth.ts, workspace.ts, catalog.ts, missions.ts
│   │   ├── components/missions/
│   │   │   ├── MissionCard.svelte, SubtaskList.svelte
│   │   │   ├── MissionFiltersPanel.svelte, MissionSortControl.svelte
│   │   └── utils/format.ts
│   └── routes/
│       ├── +layout.svelte (+layout.ts)  # auth guard, SPA (ssr=false)
│       ├── +page.svelte                 # redirige a /missions
│       ├── login/+page.svelte
│       └── missions/+page.svelte        # vista principal de Fase 7
├── tests/
│   ├── unit/  (vitest)
│   └── e2e/   (playwright)
├── static/manifest.webmanifest, favicon.svg  # placeholders — PWA real es Fase 11
├── svelte.config.js   # adapter-static, fallback SPA
├── vite.config.ts, tsconfig.json (strict), eslint.config.js, .prettierrc
├── playwright.config.ts
└── .env.example        # solo PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

## Cómo correrlo

```bash
cd frontend
npm install
cp .env.example .env   # y rellenar con tu proyecto Supabase real
npm run dev
```

```bash
npm run check   # type checking
npm run lint    # eslint + prettier --check
npm run test:unit
npm run build   # sitio estático en build/, listo para Cloudflare Pages
```

## Decisiones secundarias documentadas (no especificadas explícitamente)

- **Import de `sveltekit()` desde `@sveltejs/kit/vite`**: en las versiones
  actuales de `@sveltejs/kit`/`@sveltejs/vite-plugin-svelte` el plugin de Vite
  se exporta desde `@sveltejs/kit/vite`, no desde
  `@sveltejs/vite-plugin-svelte` como en versiones más antiguas. Se detectó
  al correr `svelte-kit sync` de verdad (falló con "no provee un export
  llamado 'sveltekit'"), no al leer el código — el mismo principio de
  "probar, no solo revisar" que sigue `README_FASE2.md`.
- **Sin SSR, SPA pura (`ssr = false` en `+layout.ts`)**: coincide con la
  sección 50 del prompt maestro ("No utilizar SSR inicialmente... no
  necesita SEO"), y es coherente con `adapter-static` + `fallback:
'index.html'`.
- **Paginación por `range()` (offset) en vez de cursor real (Fase 7,
  sección 22)**: el prompt maestro permite "paginación/cursor pagination"
  como alternativas. Para el volumen de datos esperado en el MVP (misiones
  de una persona o de un equipo pequeño), la paginación por offset es más
  simple de razonar, sigue acotando las filas cargadas por request
  ("no cargar miles de filas al frontend"), y compone trivialmente con
  cualquier combinación de filtro + campo de orden. Ver el comentario en
  `src/lib/api/missions.ts` para el razonamiento completo. Si el volumen de
  datos de un workspace crece lo suficiente como para que el costo de
  `OFFSET` importe, es un cambio aislado a esa única función.
- **`due_at` NULL siempre al final, sea cual sea la dirección de orden**: el
  prompt maestro exige que el comportamiento sea "determinista y
  documentado" (sección 22) sin especificar cuál. Se decidió que una misión
  "sin fecha límite" se trata como "más lejana" que cualquier misión con
  fecha, en ambas direcciones — así el usuario siempre encuentra las
  misiones sin fecha agrupadas al final de la lista, sin importar si ordena
  ascendente o descendente. Implementado con `nullsFirst: false` explícito
  solo para ese campo.
- **Orden secundario determinista por `id`**: aplicado siempre, en todas las
  queries, independientemente del campo de orden principal elegido por el
  usuario (sección 22: "Usar orden secundario determinista por id.").
- **Workspace activo (Fase 7 necesita alguno para poblar filtros)**: se
  elige automáticamente el workspace personal del usuario si existe, si no
  el primero de sus membresías. No hay selector de workspace en esta fase
  (no estaba en el alcance acordado); cambiarlo es aditivo sobre
  `workspace.ts`.
- **Filtros combinables y removibles individualmente (sección 21)**:
  `MissionFiltersPanel` muestra un chip por cada filtro activo (distinto de
  su valor por defecto) con su propio botón de cierre, además del botón
  "Limpiar todos los filtros" — cumple explícitamente "Permitir limpiar
  filtros individualmente y todos a la vez."
- **`store/catalog.ts` expone stores individuales, no un objeto contenedor**:
  detectado por `svelte-check` real (no por revisión visual): un objeto que
  solo _contiene_ stores de Svelte no es él mismo "subscribable" con la
  sintaxis `$store` en el template. Se exportan `skills`, `areas` y
  `catalogLoading` como stores de nivel superior en vez de
  `catalogStore.skills`.
- **La fórmula de nivel nunca se reimplementa en TypeScript**: `level.ts`
  solo llama al RPC `calculate_level_progress` (Fase 4). El frontend no
  tiene ninguna constante ni cálculo de XP-por-nivel propio.
- **`.env` local con valores de ejemplo, gitignorado**: necesario para que
  `$env/static/public` (que SvelteKit resuelve en tiempo de build/sync) no
  rompa `svelte-check`/`vite build` en este entorno de desarrollo. No se
  commitea (`.gitignore`); el repositorio solo trae `.env.example` con las
  dos variables públicas, tal como exige la sección 49.
- **`seed.sql` bypassa las RPCs cliente-facing (`create_workspace`,
  `complete_mission`)**: esas RPCs leen `auth.uid()`, que no existe fuera de
  una request autenticada real. `seed.sql` corre como el rol dueño del
  schema (vía `supabase db reset` o `psql` directo), así que inserta
  directamente en las tablas — documentado explícitamente en el propio
  archivo. Es idempotente (cada bloque verifica existencia antes de
  insertar), así que correrlo dos veces no duplica datos.
- **Placeholder de manifest/favicon en Fase 1/7**: `static/manifest.webmanifest`
  existe únicamente porque `app.html` lo referencia; su contenido completo
  (íconos reales, service worker) es explícitamente Fase 11 según la sección
  54 del prompt maestro, igual que se pospuso en `README_FASE2.md`.

## Qué queda fuera de Fase 1/7 (a propósito)

Siguiendo el orden de implementación del prompt maestro (sección 54):

- User Card persistente (sección 24) → Fase 10.
- Store UI, efectos activos, countdown (sección 23 "Store") → Fase 8.
- Statistics / Chart.js (sección 23 "Statistics") → Fase 9. `chart.js` ya
  está en `package.json` como dependencia pero no se importa en ningún
  archivo todavía — se cargará solo cuando la vista Statistics esté activa,
  como exige la sección 23.
- Responsive/mobile real, navegación inferior en Android (sección 25) →
  Fase 10.
- PWA real: manifest completo, service worker, íconos, IndexedDB cache
  (secciones 26-27) → Fase 11.
- Formularios de creación/edición de misiones, skills y áreas (la Fase 7 del
  prompt maestro lista explícitamente "missions UI · filters · sorting ·
  pagination" — CRUD completo de misión no estaba en esa lista ni en el
  alcance acordado para este turno; `missions_insert`/`update`/`delete` ya
  están listos en RLS para cuando se construya).
- Suite E2E completa de aceptación (sección 44/54 Fase 12) — necesita un
  proyecto Supabase real/local con datos.

Nada de lo anterior falta por omisión: se pospone deliberadamente para
seguir el orden de fases del propio documento, igual que en `README_FASE2.md`.
