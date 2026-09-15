# Fase 9 — Statistics

Añadido sobre `README_FASE1_7.md` y `README_FASE8.md`: la vista de
Estadísticas (spec sección 23 "Statistics" + sección 35 "Estadísticas"),
consultando `mission_completions`, `wallet_transactions` y `player_skills`
directamente — sin tablas de agregados.

## Verificado en este entorno

Repetido desde cero (`rm -rf node_modules build .svelte-kit`, `npm install`):

- `npm run check` — **0 errores, 0 warnings** (un warning real de
  accesibilidad de svelte-check apareció y se corrigió — ver más abajo)
- `npm run lint` — **sin errores**
- `npm run test:unit` — **39/39 tests pasando** (7 archivos; 14 nuevos de
  esta fase)
- `npm run build` — build de producción correcto
- **Verificación explícita de code-splitting**: se inspeccionó
  `.svelte-kit/output/client/.vite/manifest.json` y se confirmó con `grep`
  que el chunk de Chart.js (`chart.js/auto`, ~208 KB) solo aparece
  referenciado desde el chunk de la ruta `/statistics`
  (`nodes/5.mMC6y009.js`) — **cero** apariciones en el entry point
  (`entry/app.*.js`, `entry/start.*.js`) ni en los chunks de
  Missions/Store/login. Esto confirma en la práctica, no solo por diseño del
  código, el requisito literal "Cargar la librería de gráficos únicamente
  cuando Statistics esté activa".

## Qué se agregó

```
frontend/src/lib/
├── types/statistics.ts             # StatGranularity, CompletionWithContext, SkillProgress, StatBucket
├── api/statistics.ts               # fetchCompletions, fetchWalletTransactions, fetchSkillProgress
├── stores/statistics.ts            # granularity + carga de las 3 queries
├── chart/load-chartjs.ts           # import() dinámico y cacheado de chart.js/auto
├── utils/date-buckets.ts           # generateBuckets, findBucketIndex, windowStartIso
├── utils/statistics-aggregate.ts   # countByBucket, sumByBucket, groupCount
└── components/statistics/
    ├── ChartCanvas.svelte          # wrapper genérico: crea/actualiza/destruye el Chart.js
    └── StatSummaryCards.svelte     # misiones acumuladas + XP acumulada

frontend/src/routes/statistics/+page.svelte   # vista principal de Fase 9
frontend/src/routes/+layout.svelte            # + enlace "Estadísticas" en la nav

frontend/tests/unit/
├── date-buckets.test.ts
└── statistics-aggregate.test.ts
```

## Cobertura de las secciones 23 y 35 del prompt maestro

| Requisito                                                                          | Dónde                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| misiones acumuladas                                                                | `StatSummaryCards` — `missionsCompleted` (longitud de `completions` en la ventana)                                                                                                                                                                             |
| XP acumulada                                                                       | `StatSummaryCards` — `xpAccumulated` (suma de `xp_awarded` en la ventana)                                                                                                                                                                                      |
| actividad por día/semana/mes                                                       | toggle de granularidad en la cabecera; recalcula `buckets` vía `generateBuckets`                                                                                                                                                                               |
| gráfico de misiones completadas                                                    | `ChartCanvas` de barras, `completionsPerBucket`                                                                                                                                                                                                                |
| gráfico de XP                                                                      | `ChartCanvas` de línea, `xpPerBucket`                                                                                                                                                                                                                          |
| gráfico de monedas                                                                 | `ChartCanvas` de barras agrupadas: ganadas (`amount > 0`) vs gastadas (`amount < 0`)                                                                                                                                                                           |
| radar chart de skills                                                              | `ChartCanvas` tipo `radar`, un eje por skill, valor = nivel actual                                                                                                                                                                                             |
| actividad por skill                                                                | `ChartCanvas` de barras horizontales, `groupCount` por `skill_name`                                                                                                                                                                                            |
| actividad por área                                                                 | `ChartCanvas` de barras horizontales, `groupCount` por `area_name` (con "Sin área" para misiones sin área asignada)                                                                                                                                            |
| "usar mission_completions/wallet_transactions/consumable_activations como fuentes" | `api/statistics.ts` consulta las tablas de historial directamente, sin agregados; `consumable_activations` no se necesitó para ninguna de las 6 consultas explícitamente pedidas, así que no se usó ("No incluir más tipos de estadísticas de los necesarios") |
| "Cargar la librería de gráficos únicamente cuando Statistics esté activa"          | `chart/load-chartjs.ts`, verificado con inspección del bundle (ver arriba)                                                                                                                                                                                     |
| "No incluir más tipos de estadísticas de los necesarios"                           | exactamente 6 gráficos + 2 números resumen, ninguno extra                                                                                                                                                                                                      |

## Decisiones secundarias documentadas

- **`actividad por área` requiere un join hasta `missions`**:
  `mission_completions` no tiene `area_id` propio (el área vive en la
  misión que se completó, no en el registro de historial — ver
  `0009_mission_completions.sql`). `fetchCompletions` hace
  `mission:missions(area_id, area:areas(name))` para poder agrupar por área
  sin duplicar esa columna en la tabla de historial.
- **Ventanas de tiempo fijas por granularidad (30 días / 12 semanas /
  12 meses)**: el prompt maestro pide "actividad por día/semana/mes" sin
  fijar cuánto histórico mostrar. Se decidió un lookback fijo y documentado
  por granularidad — suficiente para ver una tendencia sin cargar historial
  sin límite. Ver el comentario en `date-buckets.ts`.
- **Clave de "semana" = fecha del lunes de esa semana, no el número de
  semana ISO**: evita los casos borde de la numeración ISO en los límites
  de año (el 31 de diciembre a veces pertenece a la semana 1 del año
  siguiente), sin perder unicidad ni orden.
- **Buckets vacíos se incluyen igual, con conteo/suma en cero**: un gráfico
  que salta silenciosamente los días sin actividad confundiría "no hubo
  actividad ese día" con "ese día no existe". `generateBuckets` siempre
  genera la ventana completa; `countByBucket`/`sumByBucket` dejan en 0 los
  buckets sin filas.
- **Agregación de los buckets se hace en el cliente, no en SQL**: coherente
  con "no duplicar datos históricos en tablas de agregados" — las queries
  a Supabase traen las filas crudas ya acotadas por fecha
  (`gte('completed_at', sinceIso)`, nunca "todo el historial"), y el
  bucketing/agrupamiento por skill o área se hace en TypeScript sobre ese
  conjunto ya pequeño y acotado. Si el volumen creciera lo suficiente como
  para que esto importe, el prompt maestro ya prevé la salida: "permitir
  posteriormente vistas materializadas/agregaciones sin cambiar el modelo
  principal" — sería un cambio aislado a `api/statistics.ts`.
- **Radar de skills usa `level`, no `xp`, como valor del eje**: los niveles
  de distintas skills son directamente comparables entre sí en una misma
  escala; el XP acumulado no lo es (una skill iniciada hace poco
  naturalmente tiene menos XP total, sin que eso signifique menos
  "progreso relativo"). El radar es una instantánea del estado actual
  (como la futura User Card), no una consulta con ventana de tiempo — por
  eso `fetchSkillProgress` no toma un rango de fechas.
- **`chart.js/auto` en vez de registrar manualmente cada controlador**: la
  página necesita tres tipos (`bar`, `line`, `radar`); registrar cada
  escala/elemento a mano no vale la pena para una sola página. El costo (un
  chunk más grande) queda contenido exactamente donde el prompt maestro
  pide que quede: solo se descarga cuando Statistics está activa.
- **Un solo `ChartCanvas` genérico reutilizado seis veces**, en vez de seis
  componentes de gráfico distintos: cada instancia de Chart.js se crea una
  vez en `onMount` y se actualiza in-place (`chart.update()`) cuando cambia
  la granularidad, en vez de destruir y recrear — más barato y evita el
  parpadeo del canvas al cambiar el toggle.
- **Warning real de accesibilidad detectado y corregido**: `svelte-check`
  marcó que un `<canvas>` no puede tener `role="img"` directamente
  (`a11y_no_interactive_element_to_noninteractive_role`). Se movió el
  `role="img"`/`aria-label` al `<div>` contenedor y se dejó el `<canvas>`
  sin rol propio.

## Qué sigue fuera de alcance (a propósito)

- User Card persistente / responsive real → Fase 10.
- PWA (manifest real, service worker, caché offline de estadísticas) →
  Fase 11.
- Filtro de fecha personalizado o por workspace en Statistics — el prompt
  maestro no lo pide explícitamente para esta vista y las RLS ya acotan
  todo a los propios datos del usuario; añadirlo sería "más tipos de
  estadísticas de los necesarios".
