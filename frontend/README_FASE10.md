# Fase 10 — Profile, avatar, responsive/mobile interface

Añadido sobre `README_FASE1_7.md`, `README_FASE8.md` y `README_FASE9.md`:
perfil editable, subida de avatar (spec sección 30 "Storage"), la User Card
persistente/compacta (sección 24) y el shell responsive (sección 25).

## Verificado en este entorno

Repetido desde cero (`rm -rf node_modules build .svelte-kit`, `npm install`):

- `npm run check` — **0 errores, 0 warnings**
- `npm run lint` — **sin errores**
- `npm run test:unit` — **48/48 tests pasando** (9 archivos; 9 nuevos de
  esta fase: validación de avatar y de nombre de perfil)
- `npm run build` — build de producción correcto
- Se repitió la verificación de aislamiento del chunk de Chart.js (Fase 9)
  tras los cambios de esta fase: sigue apareciendo **solo** en el nodo de
  `/statistics`, cero veces en el entry point o en cualquier otro nodo — las
  rutas nuevas (`/profile`) no lo arrastran.

## Qué se agregó

```
supabase/migrations/0025_avatar_storage.sql   # bucket 'avatars' + políticas RLS de Storage

frontend/src/lib/
├── api/avatar.ts       # validar, recortar a cuadrado, comprimir a WebP, subir, URL firmada
├── api/profile.ts      # updateDisplayName
├── stores/user-skills.ts   # skills del usuario para la User Card (reusa fetchSkillProgress de Fase 9)
└── components/layout/
    ├── UserCard.svelte     # variant="full" (desktop) | "compact" (mobile, colapsable) — mismo componente
    ├── Sidebar.svelte      # nav + UserCard full, visible solo ≥860px
    └── BottomNav.svelte    # nav inferior, visible solo <860px, touch targets de 56px

frontend/src/routes/
├── +layout.svelte      # reescrito: app shell responsive (Sidebar + BottomNav + UserCard compacta)
├── profile/+page.svelte    # vista principal de Fase 10
└── missions/+page.svelte   # + refresca userSkillsStore tras completar misión

frontend/tests/unit/
├── avatar-validation.test.ts
└── profile-validation.test.ts
```

## Cobertura de las secciones 5, 24, 25 y 30 del prompt maestro

| Requisito                                                                                          | Dónde                                                                                                                                     |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| bucket `avatars`, ruta `{user_id}/avatar.webp`                                                     | `0025_avatar_storage.sql`                                                                                                                 |
| validar MIME/extensión/tamaño                                                                      | `avatar.ts` → `validateAvatarFile` (testeado, 7 casos)                                                                                    |
| validar dimensiones                                                                                | `avatar.ts` → `uploadAvatar`, tras decodificar la imagen                                                                                  |
| redimensionar/comprimir antes de subir, preferir WebP                                              | `avatar.ts` → recorte a cuadrado 256×256 + compresión iterativa a WebP bajo 512 KB                                                        |
| políticas para que solo el dueño modifique su avatar                                               | `0025_avatar_storage.sql` — INSERT/UPDATE/DELETE atadas a `(storage.foldername(name))[1] = auth.uid()`                                    |
| nunca permitir que el cliente modifique total_xp/level/coins                                       | ya garantizado desde Fase 2 (`0015_column_privileges.sql`); `profile.ts` solo toca `display_name`                                         |
| User Card: avatar, nombre, nivel, XP, progreso, monedas, skills                                    | `UserCard.svelte`                                                                                                                         |
| User Card refleja inmediatamente: completar misión / comprar item / subir nivel / actualizar skill | ver "Decisiones" abajo                                                                                                                    |
| Desktop: sidebar + User Card persistente + contenido                                               | `Sidebar.svelte` (`display:flex` en `@media (min-width:860px)`)                                                                           |
| Android: navegación inferior + User Card compacta + touch targets + sin hover                      | `BottomNav.svelte` + `UserCard` variant compact                                                                                           |
| mismo código funcional para ambos dispositivos                                                     | un solo árbol de componentes en `+layout.svelte`; la visibilidad la deciden media queries en cada componente, no ramas de JS por viewport |
| no build de Android nativo                                                                         | no se agregó ninguno; sigue siendo la misma SPA                                                                                           |

## Decisiones secundarias documentadas

- **Bucket `avatars` privado, no público**: `profiles_select` (Fase 2) ya
  permite que un compañero de workspace vea el `display_name`/`avatar_path`
  de otro. Se decidió que la imagen del avatar siga la misma regla de
  visibilidad — dueño o compañero de workspace — en vez de hacer el bucket
  público (que expondría avatares a cualquiera con la URL, sin relación con
  el workspace). La política `avatars_select_self_or_teammate` reutiliza
  literalmente `public.shares_workspace_with`, la misma función que ya
  gobierna `profiles_select`.
- **La extensión del path es siempre `.webp`, forzada por el propio
  cliente**: en vez de aceptar cualquier extensión en Storage, el frontend
  convierte toda imagen a WebP antes de subirla, así que
  `{user_id}/avatar.webp` puede ser una ruta fija en vez de necesitar
  lógica adicional para "cuál extensión tiene este usuario". Documentado en
  el encabezado de `0025_avatar_storage.sql`.
- **Recorte a cuadrado + tamaño fijo 256×256**: el prompt maestro no fija
  dimensiones de salida, solo el límite de tamaño en bytes. Un tamaño fijo
  y cuadrado evita tener que lidiar con proporciones distintas en cada
  lugar donde se muestra el avatar (User Card completa, compacta, perfil).
- **Compresión iterativa de calidad (0.9 → 0.3 en pasos de 0.15) en vez de
  una sola pasada**: la spec solo pide "máximo ~512 KB"; una imagen de
  256×256 casi siempre entra bien por debajo de ese límite incluso a
  calidad alta, así que el bucle prácticamente nunca necesita bajar de
  calidad ~0.75 en la práctica — el piso de 0.3 es solo una salvaguarda
  documentada, no el caso esperado.
- **Validación de dimensiones ocurre después de decodificar la imagen, no
  antes**: no hay forma de leer el ancho/alto de un `File` sin decodificarlo
  primero (a diferencia de MIME/extensión/tamaño en bytes, que sí vienen en
  los metadatos del propio `File`). `uploadAvatar` valida el tamaño mínimo
  de origen (32×32) justo después de `loadImage`, antes de gastar tiempo
  recortando/comprimiendo una imagen que de todos modos se va a rechazar.
- **Signed URLs para mostrar el avatar, no `getPublicUrl`**: consecuencia
  directa de que el bucket es privado. `getAvatarSignedUrl` devuelve `null`
  ante cualquier error para que la UI caiga a un placeholder (inicial del
  nombre) en vez de romperse.
- **La User Card nunca reimplementa la fórmula de nivel**: igual que
  `api/level.ts` desde Fase 1, `UserCard.svelte` llama a
  `calculate_level_progress` cada vez que cambia `total_xp` — nunca calcula
  el porcentaje de progreso por su cuenta.
- **Solo `completar misión` y `comprar item` disparan un refresh explícito
  desde las páginas; `subir nivel` y `actualizar skill` son consecuencia,
  no un evento aparte**: los cuatro disparadores de la sección 24 en
  realidad tocan dos piezas de estado distintas. Completar una misión
  cambia XP/nivel/monedas del perfil **y** el nivel/XP de una skill, así
  que `missions/+page.svelte` refresca `auth.profile` **y**
  `userSkillsStore` tras el RPC. Comprar un item solo cambia monedas
  (nunca skills), así que `store/+page.svelte` solo refresca
  `auth.profile` — agregar un refresh de skills ahí sería una llamada de
  red sin ningún dato nuevo que mostrar. "Subir de nivel" y "actualizar
  skill" no son un quinto y sexto evento independientes: son lo que ya
  queda reflejado en esos dos refreshes, porque el nivel/skill siempre se
  derivan de `total_xp`/`xp` en el mismo momento en que esos cambian.
- **Una sola `UserCard.svelte` con una prop `variant`, no dos
  componentes**: cumple literalmente "usar el mismo código funcional para
  ambos dispositivos" (sección 25) — la única diferencia entre "persistente
  en desktop" y "compacta/colapsable en mobile" es si `expanded` empieza
  fijo en `true` (full) o parte de `false` y se puede alternar tocando la
  barra resumen (compact).
- **Visibilidad de Sidebar/BottomNav/UserCard-compacta decidida por CSS
  (media queries por componente), no por JS leyendo el ancho de la
  ventana**: los tres se renderizan siempre en el DOM; cada uno se oculta a
  sí mismo con `display: none` fuera de su breakpoint. Evita cualquier
  lógica de "¿soy mobile o desktop?" en JavaScript y cualquier parpadeo de
  layout al cambiar el tamaño de la ventana — el navegador ya resuelve eso
  de forma nativa con CSS.
- **Breakpoint único a 860px** para las tres piezas responsive, elegido
  para que quepan cómodamente el sidebar (240px) + el contenido principal
  en una laptop pequeña sin sentirse apretado; no hay un tercer breakpoint
  "tablet" en este MVP (la spec solo pide "Desktop" y "Android").
- **Touch targets de 56px en BottomNav** (por encima del mínimo de 44px que
  ya se usa en botones sueltos desde Fase 7): al ser la navegación
  principal en móvil, se le dio más margen táctil que a un botón secundario
  cualquiera.
- **Sin ningún `:hover` del que dependa una funcionalidad**: ya era cierto
  desde fases anteriores (los botones no revelan nada solo con hover); esta
  fase lo hace explícito en los comentarios de `Sidebar.svelte` porque es la
  primera vez que el prompt maestro lo pide como requisito textual.

## Qué sigue fuera de alcance (a propósito)

- PWA (manifest real con íconos, service worker, caché offline en
  IndexedDB) → Fase 11. `static/manifest.webmanifest` sigue siendo el
  placeholder de Fase 1.
- Selector de workspace visible en la UI (sigue eligiéndose automáticamente
  el personal/el primero, como desde Fase 7) — no estaba en el alcance
  acordado para Fase 10.
- Lista de miembros del workspace / avatares de compañeros — la política de
  Storage ya lo permite (`avatars_select_self_or_teammate`), pero no hay
  ninguna vista que muestre avatares de otros usuarios todavía.
