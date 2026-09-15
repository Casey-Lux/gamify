# Fase 8 — Store UI

Añadido a lo entregado en `README_FASE1_7.md`: la vista de Tienda completa
(spec sección 23 "Store"), sobre el RPC `purchase_item` y las tablas
`store_items` / `consumable_activations` de Fase 6.

## Verificado en este entorno

Repetido desde cero (`rm -rf node_modules build .svelte-kit`, `npm install`):

- `npm run check` — **0 errores, 0 warnings**
- `npm run lint` — **sin errores**
- `npm run test:unit` — **25/25 tests pasando** (7 archivos; 9 nuevos de esta
  fase)
- `npm run build` — build de producción correcto, `src/routes/store` incluida

Un error real de tipos apareció y se corrigió: con `noUncheckedIndexedAccess`
(activado en `tsconfig.json` desde Fase 1), indexar
`PURCHASE_ERROR_MESSAGES[err.code]` da `string | undefined`, no `string` —
`svelte-check` lo marcó como error real de compilación, no solo un lint.

## Qué se agregó

```
frontend/src/lib/
├── types/domain.ts          # + PurchaseItemResult (return row del RPC)
├── api/store.ts             # fetchStoreItems, fetchActiveEffects, purchaseItem, describePurchaseError
├── stores/store.ts          # items, activeEffects, purchase flow, canAfford
├── components/store/
│   ├── StoreItemCard.svelte      # nombre, precio, stock, duración, efecto, botón Comprar, rechazo
│   └── ActiveEffectsList.svelte  # efectos activos con countdown en vivo
└── utils/format.ts          # + EFFECT_TYPE_LABEL, formatEffectValue, formatRemaining

frontend/src/routes/store/+page.svelte   # vista principal de Fase 8
frontend/src/routes/+layout.svelte       # + nav mínima Misiones/Tienda

frontend/tests/unit/
├── store-format.test.ts
└── store-error-messages.test.ts
```

## Cobertura de la sección 23 "Store" del prompt maestro

| Requisito                              | Dónde                                                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| items disponibles                      | `storeStore.load` → `fetchStoreItems` (solo `active=true`, ya filtrado también por RLS)                                                                                                                   |
| stock                                  | `StoreItemCard` — "stock/max_stock"                                                                                                                                                                       |
| precio                                 | `StoreItemCard` — cabecera                                                                                                                                                                                |
| duración                               | `StoreItemCard` — "N min"                                                                                                                                                                                 |
| tipo de efecto                         | `StoreItemCard` — `EFFECT_TYPE_LABEL` + `formatEffectValue`                                                                                                                                               |
| botón Comprar                          | `StoreItemCard`, deshabilitado si agotado/sin fondos/comprando                                                                                                                                            |
| saldo del usuario                      | cabecera de `store/+page.svelte`, leído de `auth.profile.coins`                                                                                                                                           |
| mensaje de rechazo si no tiene monedas | banner inline en la card (`insufficientFunds`) + mapeo de errores del RPC (`describePurchaseError`, por si la carrera de condición hace que el RPC rechace la compra aunque la UI la mostrara habilitada) |
| efecto activo                          | `ActiveEffectsList`                                                                                                                                                                                       |
| tiempo restante del efecto             | `ActiveEffectsList` — countdown `mm:ss`, actualizado cada segundo                                                                                                                                         |

## Decisiones secundarias documentadas

- **`describePurchaseError` mapea los `errcode` personalizados del RPC
  (`GM001`…`GM007`) a mensajes en español**: el prompt maestro pide
  "mensaje de rechazo si no tiene monedas" sin especificar el texto exacto
  ni si debe cubrir otros rechazos (agotado, item inactivo, etc.). Se
  decidió cubrir los siete códigos que `purchase_item` (0024) realmente usa,
  no solo el de saldo insuficiente, porque la UI puede mostrar el botón
  habilitado y aun así perder la carrera contra otro dispositivo/pestaña —
  en ese caso el mensaje de rechazo real viene del RPC, no de la
  comprobación optimista del cliente.
- **Dos chequeos de "no le alcanza", uno optimista (cliente) y uno real
  (servidor)**: `StoreItemCard` deshabilita el botón cuando
  `userCoins < item.price` (evita clics inútiles), pero la fuente de verdad
  sigue siendo el RPC — si la compra falla igual por una carrera de
  condición, `purchaseError` en el store muestra el mensaje real. Esto es
  el mismo patrón que "el botón Completar" de Fase 7 usa con las
  submisiones.
- **Refresco de efectos activos en dos velocidades distintas**:
  `ActiveEffectsList` corre un timer de 1 segundo puramente visual (solo
  recalcula el texto `mm:ss` con `Date.now()` local); el store `store.ts`
  hace un refresh real contra Supabase cada 30 segundos
  (`refreshActiveEffects`) para eventualmente quitar efectos que ya
  expiraron de verdad. Separar ambos evita golpear la base de datos una vez
  por segundo (el prompt maestro explícitamente pide "No utilizar un cron
  por minuto para que el sistema funcione" del lado servidor; del lado
  cliente, análogamente, no hay razón para poll agresivo cuando la
  cuenta regresiva visual no necesita datos frescos del servidor cada
  segundo) sin dejar de cumplir "la consulta de efectos activos debe
  depender de expires_at > NOW()" tomando esa comparación siempre del reloj
  de Postgres, nunca de si el timer visual del cliente llegó a 0:00.
- **`fetchActiveEffects` usa el reloj del cliente solo para construir el
  parámetro de la query (`expires_at > <ahora del cliente>`)**: documentado
  extensamente en el comentario de `api/store.ts`. Esto nunca decide si un
  efecto aplica durante una compra o una misión completada — eso ya lo
  hacen `purchase_item`/`complete_mission` comparando contra `now()` dentro
  de Postgres (Fase 5/6). El peor caso de una deriva de reloj aquí es que
  esta lista tarde unos segundos de más/menos en reflejar una expiración,
  nunca una recompensa incorrecta.
- **Nav mínima Misiones/Tienda en `+layout.svelte`**: con dos vistas ya
  existentes hacía falta alguna forma de navegar entre ellas; se agregó la
  navegación más simple posible (dos enlaces de texto). El diseño
  responsive real (sidebar en desktop, tab bar en móvil — sección 25) es
  Fase 10 y reemplazará esto.
- **`storeStore.canAfford` expuesto pero no usado todavía en la UI actual**:
  se dejó como función pura y testeable para cuando el listado quiera, por
  ejemplo, ordenar u ocultar items inasequibles — de momento
  `StoreItemCard` calcula lo mismo localmente porque ya tiene `item` y
  `userCoins` como props y no vale la pena la indirección. No se eliminó
  porque documenta la regla de negocio en un solo lugar.

## Qué sigue fuera de alcance (a propósito)

- Statistics (Chart.js) → Fase 9.
- User Card persistente / responsive real → Fase 10.
- PWA (manifest real, service worker) → Fase 11.
- Gestión de items de tienda (crear/editar/desactivar, solo OWNER) — RLS ya
  lo permite (`store_items_insert_owner`, etc.) pero no hay UI para ello
  todavía; no estaba en el alcance acordado de esta fase.
