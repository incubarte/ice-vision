# Playoffs 5to-8vo y Relegation — Implementado

## Estado: ✅ Completo

---

## Resumen

Se agregaron dos nuevas fases de torneo, **mutuamente excluyentes por categoría**:

| Fase | Nombre en UI | Mínimo equipos | Descripción |
|------|-------------|----------------|-------------|
| `playoffs` | Playoffs | — | Bracket existente para equipos 1°-4° (sin cambios) |
| `playoffs-5-8` | Playoffs 5to-8vo | **8 equipos** | Mini-torneo eliminatorio para 5°-8°, con nombre propio (ej. "Copa Plata") |
| `relegation` | Relegation | **6 equipos** | Liga entre equipos del 5° en adelante, con tabla propia desde el puesto 5° |

---

## Comportamiento implementado

### Playoffs 5to-8vo (`playoffs-5-8`)

- 4 partidos: Semi 1 (5vs8), Semi 2 (6vs7), Final, 3er Puesto
- Nombre del mini-torneo definido al crear el primer partido → queda bloqueado
- Equipos opcionales (se resuelven automáticamente desde standings de clasificación)
- Aparece debajo del bracket de ganadores en la tab Playoffs
- Solo disponible si la categoría tiene ≥ 8 equipos

### Relegation (`relegation`)

- Liga (round-robin), partidos normales con ambos equipos requeridos
- Tabla de posiciones con puestos desde el **5°** en adelante (`positionOffset = 4`)
- Solo disponible si la categoría tiene ≥ 6 equipos

### Exclusión mutua por categoría

Una vez creado el primer partido de `playoffs-5-8` o `relegation` en una categoría, la otra opción queda deshabilitada en el dialog para esa categoría. La detección es automática (basada en partidos existentes).

### Filtrado de equipos en el dialog

Cuando hay datos de clasificación (al menos un partido jugado), los equipos se filtran:

| Fase | Equipos mostrados |
|------|------------------|
| Clasificación | Todos |
| Playoffs (ganadores) | Top 4 del ranking |
| Playoffs 5-8 | Posiciones 5° a 8° |
| Relegation | Posición 5° en adelante |

Si no hay partidos de clasificación jugados aún, muestra todos los equipos sin filtrar.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | `MatchPhase` extendido; nuevos tipos `Playoff58MatchType`, `Playoff58Matchup`; campos `playoff58Type`, `playoff58Matchup`, `playoff58Name` en `MatchData` |
| `src/components/fixture/add-edit-match-dialog.tsx` | Selector de fase con condiciones de equipos mínimos, lock de nombre, filtrado de equipos por standings, validaciones de límites |
| `src/components/fixture/fixture-list-view.tsx` | `getMatchupDisplay` para nuevas fases, badges naranja/rojo, WhatsApp share actualizado |
| `src/hooks/use-standings.ts` | `computeStandings` interno reutilizable; nuevo `useRelegationStandings(positionOffset=4)`; `TeamStats` exportado |
| `src/components/tournaments/standings-tab.tsx` | `getSecondaryPhaseInfo` helper; componentes `Playoff58Bracket` y `RelegationTable`; tab Playoffs actualizado |
| `src/lib/game-state-reducer.ts` | Sin cambios (spread del objeto completo propaga campos nuevos) |

---

## Reglas de negocio clave

- La tabla de clasificación (`useStandings`) filtra **solo** `phase === 'clasificacion'` — los partidos de playoff-5-8 y relegation no la afectan
- `useRelegationStandings` filtra **solo** `phase === 'relegation'` — aislado completamente
- Playoffs 5-8: mínimo **8 equipos** en la categoría
- Relegation: mínimo **6 equipos** en la categoría
- Ambas fases secundarias son mutuamente excluyentes por categoría
- Dos categorías distintas pueden usar modalidades diferentes

---

*Implementado: 2026-07-06*
