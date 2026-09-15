# Fase 11 — PWA: manifest, service worker, caché IndexedDB

Añadido sobre `README_FASE1_7.md`, `README_FASE8.md`, `README_FASE9.md` y
`README_FASE10.md`: la app se puede instalar (spec sección 26 "PWA") y sigue
mostrando algo útil sin conexión gracias a una caché de lectura en IndexedDB
(spec sección 27 "Caché").

## Verificado en este entorno

Repetido desde cero (`npm install`, sin `node_modules` previo):

- `npm run check` — **0 errores, 0 warnings**
- `npm run lint` — **sin errores**
- `npm run test:unit` — **59/59 tests pasando** (10 archivos; 1 nuevo de
  esta fase, `cache-keys.test.ts`, más 5 casos nuevos agregados a
  `format.test.ts` para `formatCacheAge`)
- `npm run build` — build de producción correcto. Verificado además, **en
  el output real, no solo por diseño**:
  - `build/service-worker.js` existe (2.9 KB) y es alcanzable en la raíz
    del sitio estático.
  - `build/index.html` contiene el script de auto-registro que SvelteKit
    inyecta cuando existe `src/service-worker.ts` y
    `kit.serviceWorker.register` está en su valor por defecto (`true`):
    ```js
    if ('serviceWorker' in navigator) {
      /* ... */ addEventListener('load', function () {
        navigator.serviceWorker.register(sanitised);
      });
    }
    ```
    Es decir: no hace falta ningún registro manual en `+layout.svelte`; se
    dejó el comportamiento por defecto de SvelteKit en vez de reemplazarlo
    por código propio (sección 56, "elegir la alternativa más simple que
    cumpla el requisito").
  - Repetida la comprobación de aislamiento del chunk de Chart.js (Fase 9):
    `CpL4W96M.js` (208 KB) sigue apareciendo **solo** dentro del import
    dinámico de `ChartCanvas.svelte` (nodo de `/statistics`) — cero
    referencias en el entry point, en `/missions`, `/profile`, `/store` o
    `/login`.
  - Íconos generados a partir del color/glifo ya existentes en
    `favicon.svg` (`#4c6ef5`, letra "G"), no un diseño nuevo: 192/512 con
    esquinas redondeadas + variantes `maskable` (fondo sólido, glifo dentro
    de la zona segura del 80%) + `apple-touch-icon.png` de 180×180.

## Qué se agregó

```
frontend/static/
├── manifest.webmanifest          # reescrito: icons reales, id, scope, display standalone
└── icons/
    ├── icon-192.png / icon-512.png
    ├── icon-maskable-192.png / icon-maskable-512.png
    └── apple-touch-icon.png

frontend/src/
├── service-worker.ts              # $service-worker nativo de SvelteKit — ver "Decisiones"
├── app.html                       # + apple-touch-icon y meta apple-mobile-web-app-*
│
├── lib/cache/
│   ├── db.ts                      # wrapper sobre idb: 6 object stores, get/set best-effort
│   └── keys.ts                    # claves deterministas (misiones/estadísticas/catálogo) — testeadas
│
├── lib/pwa/
│   └── install-prompt.ts          # captura beforeinstallprompt para el botón "Instalar" de Profile
│
├── lib/stores/
│   ├── network.ts                 # navigator.onLine + eventos online/offline
│   ├── auth.ts                    # + fallback a caché de `profile`
│   ├── catalog.ts                 # + fallback a caché de `catalog` (skills+areas por workspace)
│   ├── missions.ts                # + fallback a caché de `missions` (por filtros+orden+página exactos)
│   ├── statistics.ts              # + fallback a caché de `statistics` (por granularidad)
│   ├── user-skills.ts             # + fallback a caché de `user-skills`
│   └── workspace.ts               # + `activeWorkspaceId` cacheado como "configuración"
│
└── lib/components/layout/
    ├── OfflineBanner.svelte       # aviso persistente y no invasivo mientras !navigator.onLine
    └── CachedNotice.svelte        # "Datos guardados hace N minutos…" reusado en 3 vistas

frontend/tests/unit/
└── cache-keys.test.ts             # claves de caché deterministas y distintas entre sí
```

`eslint.config.js` gana un override para `src/service-worker.ts`
(`globals.serviceworker`: `caches`, `clients`, `skipWaiting`… no están en
`globals.browser`). `.env` local y `frontend/.gitignore` (no existía —
ver "Decisiones") se agregaron para que las herramientas (`svelte-check`,
`vite`) puedan resolver `$env/static/public` en este entorno de verificación.

## Cobertura de las secciones 26 y 27 del prompt maestro

| Requisito                                                    | Dónde                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Manifest con nombre, íconos, `display: standalone`           | `manifest.webmanifest`                                                                        |
| Instalable en Android y navegadores desktop compatibles      | manifest + `install-prompt.ts` (botón explícito en Profile, Chromium)                         |
| iOS: se puede añadir a pantalla de inicio en modo standalone | `app.html` — `apple-mobile-web-app-capable`/`-title`/`-status-bar-style` + `apple-touch-icon` |
| No requiere build nativo de Android/iOS                      | sigue siendo la misma SPA; nada de Capacitor/Cordova                                          |
| Service worker                                               | `src/service-worker.ts`                                                                       |
| Cachear perfil                                               | `stores/auth.ts` → object store `profile`, clave = `user_id`                                  |
| Cachear skills                                               | `stores/catalog.ts` (catálogo, clave = `workspace_id`) y `stores/user-skills.ts` (progreso)   |
| Cachear misiones recientes                                   | `stores/missions.ts` → object store `missions`, clave = filtros+orden+página exactos          |
| Cachear configuración                                        | `stores/workspace.ts` → `activeWorkspaceId` en object store `settings`                        |
| Cachear estadísticas recientes                               | `stores/statistics.ts` → object store `statistics`, clave = granularidad                      |
| La base de datos remota siempre es la autoridad              | todo store intenta la red primero **siempre**; la caché solo se lee si esa llamada falla      |
| Permitir lectura de datos cacheados sin conexión             | `getCached` en cada store, tras el `catch`/`error` de la llamada de red                       |
| Dejar claro cuándo los datos pueden estar desactualizados    | `OfflineBanner.svelte` (global) + `CachedNotice.svelte` (por vista, con `formatCacheAge`)     |

## Decisiones secundarias documentadas

- **Store items / tienda deliberadamente NO se cachean.** Las secciones 26/27
  piden cachear perfil, skills, misiones recientes, configuración y
  estadísticas — la tienda no está en esa lista, y por buena razón: precio,
  stock y el saldo de monedas del usuario cambian con cada compra, y una
  compra solo puede resolverla el servidor (`purchase_item`, spec sección
  18). Cachear el listado de la tienda sería mostrar precios/stock que
  podrían ya no ser reales, y comprar offline es imposible de todos modos
  (no hay forma de garantizar la validación server-side sin red) — cachearla
  sería una funcionalidad no pedida (sección 2) que además induciría a
  error.
- **Ninguna escritura offline, ni cola de sincronización.** La sección 27
  no pide "modo offline completo", solo lectura de lo último visto. No se
  implementó ninguna cola de mutaciones pendientes ni resolución de
  conflictos — completar una misión o comprar un item siguen exigiendo red
  en este MVP, tal como antes de esta fase.
- **Caché de IndexedDB con `idb` (ya era dependencia desde Fase 1), un
  wrapper propio en vez de una librería de sync más grande** (ej.
  Dexie/RxDB): solo se necesita get/set por clave con un timestamp, no
  queries, índices ni reactividad — `idb` es la envoltura mínima sobre la
  API nativa que evita escribir el boilerplate de callbacks a mano.
- **`getCached`/`setCached` nunca lanzan.** Cualquier fallo (Safari en
  privado, cuota excedida, navegador sin soporte) se traga silenciosamente
  y se trata como "no hay caché todavía" — la app no debe romperse por no
  poder cachear, ni por no poder leer la caché.
- **Clave de caché de misiones = filtros + orden + página exactos, en vez
  de un único slot "últimas misiones".** Guardar una sola foto fija sería
  más simple, pero mostraría datos de un filtro distinto al que el usuario
  tiene puesto en pantalla si vuelve a entrar offline con otro filtro
  activo. Con la clave exacta, un cache hit solo ocurre para una vista que
  el usuario ya cargó con conexión — lo cual es exactamente el caso
  realista de "se cortó la luz mientras miraba esto".
- **Sin fusión parcial de una respuesta fresca con una cacheada.** Si
  `skills` responde bien pero `areas` falla (o viceversa) en
  `loadCatalog`, se descarta todo y se usa la caché completa anterior en
  vez de mezclar una mitad fresca con una mitad vieja — dos observaciones
  de la base de datos en momentos distintos combinadas nunca representan
  un estado real y consistente.
- **`cachedAt` es el reloj del cliente, y solo se usa para mostrarle al
  usuario "hace cuánto"**, nunca para decidir si algo expiró o sigue
  siendo válido. Esa autoridad (vencimiento de misiones, activaciones de
  consumibles, etc.) sigue siendo exclusivamente de `NOW()` en Postgres
  (spec sección 33) — igual que antes de esta fase.
- **El service worker nunca intercepta Supabase (otro origen) ni ninguna
  request que no sea GET.** Es una precaución explícita, no solo una
  optimización: si alguna vez interceptara una llamada de escritura, una
  mutación podría "parecer" exitosa desde una caché sin haber llegado
  realmente al servidor — exactamente lo que la sección 27 excluye del
  MVP.
- **`src/service-worker.ts` usa el soporte nativo `$service-worker` de
  SvelteKit** (en vez de una librería como `vite-plugin-pwa`): el proyecto
  no tenía ninguna dependencia de PWA hasta ahora, y SvelteKit ya resuelve
  exactamente lo necesario (lista de build, lista de `static/`, versión de
  build para invalidar cachés viejas) sin agregar una dependencia nueva.
- **`register` se dejó en su valor por defecto (`true`)** en vez de
  desactivarlo y registrar el service worker a mano desde
  `+layout.svelte`: el comportamiento por defecto ya hace exactamente lo
  necesario (registrar tras `load`) y se verificó en el build real (ver
  arriba) — añadir código de registro propio solo duplicaría lo que
  SvelteKit ya hace.
- **El propio service worker se neutraliza a sí mismo en `npm run dev`.**
  `build`/`files` (los arrays de `$service-worker`) vienen vacíos durante
  el desarrollo porque todavía no existe un manifest de producción que
  precachear; si `build.length === 0`, el `install` no cachea nada y el
  `fetch` no intercepta nada, así que registrarse en dev es inofensivo (no
  interfiere con HMR) en vez de necesitar una bandera aparte para
  desactivarlo.
- **Estrategia de `fetch`: network-first + shell cacheado para
  navegaciones, cache-first para el resto de assets same-origin.** Una
  navegación (`request.mode === 'navigate'`) siempre prueba la red primero
  — para un usuario logueado, "la página más reciente" importa más que
  "la más rápida" — y solo cae al shell cacheado (`${base}/`, el mismo
  `index.html` de `fallback` de adapter-static) si la red falla. Los
  bundles JS/CSS con hash en el nombre son, en cambio, inmutables para una
  `version` dada, así que cache-first es seguro y evita ida y vuelta a la
  red en cada carga.
- **El "shell" que cachea el service worker es distinto de la caché en
  IndexedDB.** El primero es el HTML/JS/CSS de la aplicación (para que la
  app _abra_ offline); el segundo son los datos de negocio (para que, ya
  abierta, _muestre algo_ offline). Son necesarios los dos: sin el
  service worker, abrir la PWA sin conexión ni siquiera cargaría el
  bundle; sin IndexedDB, cargaría un shell vacío sin nada que mostrar.
- **`beforeinstallprompt` capturado globalmente en `+layout.svelte`, pero
  consumido solo en `/profile`.** El evento lo dispara el navegador una
  única vez por sesión y en un momento que no se puede predecir, así que
  el listener tiene que estar activo desde el arranque de la app aunque el
  botón de instalar solo se muestre en la vista de Perfil (junto con
  "Editar nombre"/"Avatar", que es donde ya vive el resto de ajustes del
  usuario).
- **Sin botón de instalar en Firefox/Safari.** `beforeinstallprompt` es
  una API exclusiva de navegadores Chromium; no existe equivalente
  estándar para disparar el instalador nativo desde la página en otros
  navegadores. En iOS, el camino sigue siendo el "Compartir → Añadir a
  pantalla de inicio" manual de Safari, ya habilitado por las meta tags de
  `app.html`.
- **`OfflineBanner` es una franja de texto fija, no un toast/modal**
  (sección 37, "sin UI invasiva"): aparece mientras `!navigator.onLine` y
  desaparece solo, sin que el usuario tenga que descartarlo — es
  información de estado, no una alerta que reclame una acción.
- **`CachedNotice` se reutiliza igual en Missions, Statistics y la User
  Card**, en vez de tener un mensaje distinto por vista: una sola función
  (`formatCacheAge`, testeada) decide el texto relativo ("hace 5 minutos"),
  así la regla de "cómo se ve una fecha relativa" vive en un solo lugar
  (sección 40, "no duplicar reglas").
- **`fetchLevelProgress` (Fase 1, RPC `calculate_level_progress`) no se
  cachea ni se reimplementa client-side.** Offline, la barra de progreso de
  XP dentro del nivel actual simplemente no se actualiza (queda con el
  último valor calculado) mientras el resto de la User Card —
  nivel/monedas/nombre, que sí vienen de `profiles`, cacheado — se sigue
  viendo. Cachear ese cálculo habría significado duplicar en el cliente
  una fórmula que la sección 7 exige mantener centralizada en Postgres.
  Se aprovechó el cambio para envolver esa llamada en un `.catch(() => {})`
  explícito — antes de esta fase, un fallo ahí (poco probable sin este
  escenario offline) habría quedado como una promesa rechazada sin
  manejar.
- **Se agregó `frontend/.gitignore`, que no existía en el zip recibido**
  (a pesar de estar mencionado como entregable en fases previas): con
  `node_modules/`, `.env` y `build/` reales presentes en este entorno de
  verificación por primera vez, dejarlos sin ignorar habría sido
  arriesgado de cara a un commit real. Se agregó también un `.env` local
  (a partir de `.env.example`) únicamente para que `svelte-check`/`vite`
  pudieran resolver `$env/static/public` en este entorno — no contiene
  credenciales reales.

## Qué sigue fuera de alcance (a propósito)

- Tests unitarios/DB/RLS/E2E completos → Fase 12. Los tests E2E existentes
  (`tests/e2e/auth-guard.spec.ts`, Fase 1) no cubren todavía el
  comportamiento offline; probar un service worker de extremo a extremo
  necesita un runner con soporte real de Service Worker API (Playwright sí
  lo tiene) y contexto de red simulada — se dejó explícitamente para la
  fase dedicada a testing en vez de mezclarlo aquí.
- Build de producción y despliegue (Cloudflare Pages, `_redirects` para el
  fallback SPA, `.env` de producción real) → Fase 13.
- Selector de workspace visible en la UI — sigue fuera de alcance desde
  Fase 7/10; `workspace.ts` gana caché de `activeWorkspaceId` en esta fase
  únicamente para que ese id sobreviva un reinicio offline, no como parte
  de una UI nueva.
