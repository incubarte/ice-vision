# Última Sesión — 2026-07-06

## Qué se hizo

### Feature: Playoffs 5to-8vo y Relegation ✅

Se implementaron dos nuevas fases de torneo opcionales por categoría.

**Reglas:**
- `playoffs-5-8`: bracket eliminatorio para equipos 5°-8°. Requiere **≥ 8 equipos**. Tiene nombre propio (ej. "Copa Plata") que se define al crear el primer partido y queda bloqueado. 4 partidos: 5vs8, 6vs7, final y 3er puesto.
- `relegation`: liga entre equipos del 5° en adelante. Requiere **≥ 6 equipos**. Tabla de posiciones propia mostrando desde el puesto 5°.
- Las dos son **mutuamente excluyentes** por categoría. Una vez que se crea el primer partido de una, la otra queda deshabilitada para esa categoría.
- La tabla de **clasificación no se ve afectada** por partidos de estas fases.

**Archivos modificados:**
- `src/types/index.ts` — nuevos tipos `Playoff58MatchType`, `Playoff58Matchup`; `MatchPhase` extendido; campos nuevos en `MatchData`
- `src/components/fixture/add-edit-match-dialog.tsx` — selector de fase con condiciones mínimas, filtrado de equipos por standings, lock del nombre del mini-torneo
- `src/components/fixture/fixture-list-view.tsx` — display y badges para nuevas fases
- `src/hooks/use-standings.ts` — nuevo `useRelegationStandings` con positionOffset
- `src/components/tournaments/standings-tab.tsx` — nuevos componentes `Playoff58Bracket` y `RelegationTable`

---

## Qué quedó pendiente

- `PENDIENTES.md` — explorar auto-update del sistema en la máquina local (git pull + npm install + restart automático)
- Admin mode para ediciones desde Vercel — ver `PLAN_SUPABASE_WRITES.md`
- Integración de staff en el wizard de setup
