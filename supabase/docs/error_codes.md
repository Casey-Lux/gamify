# Códigos de error de dominio (RPCs)

No es un objeto de base de datos — es la referencia única de los códigos de
error tipo-SQLSTATE personalizados que usan `complete_mission` (Fase 5) y,
más adelante, `purchase_item` (Fase 6), para que el frontend tenga un
contrato estable sobre el que hacer `switch`, en vez de parsear el texto del
mensaje de error. Esto sostiene directamente la sección 36 del prompt maestro
("Errores"): cada código se corresponde con exactamente uno de los estados de
UI que pide esa sección.

| Código  | Significado                        | Estado de UI            |
|---------|-------------------------------------|--------------------------|
| `GM001` | no autenticado                      | `unauthorized`            |
| `GM002` | no autorizado sobre el recurso       | `unauthorized`            |
| `GM003` | recurso no encontrado                | `error`                   |
| `GM004` | misión ya completada                 | `already completed`       |
| `GM005` | quedan submisiones sin completar     | `validation error`        |
| `GM006` | saldo insuficiente (Fase 6)          | `insufficient funds`      |
| `GM007` | sin stock (Fase 6)                   | `out of stock`            |
| `GM008` | error de validación genérico         | `validation error`        |

PostgreSQL exige que los SQLSTATE tengan exactamente 5 caracteres en
`[A-Z0-9]`; `GM0xx` cumple ese formato y es improbable que colisione con
ningún código de error nativo de Postgres.

Uso en el cliente (ejemplo con `supabase-js`):

```ts
const { data, error } = await supabase.rpc('complete_mission', { p_mission_id });

if (error) {
  switch (error.code) {
    case 'GM004':
      // ya estaba completada -> refrescar UI en vez de mostrar error genérico
      break;
    case 'GM005':
      // faltan submisiones -> resaltar cuáles
      break;
    default:
      // error genérico
  }
}
```
