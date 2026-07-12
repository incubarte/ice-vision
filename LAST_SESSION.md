# Última Sesión — 2026-07-12

## Branch activo
`summaries-v2` → remote `incubarte/ice-vision`
Push: `GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_2" git push origin summaries-v2`

---

## Qué se hizo

### Fix: Cross-contamination en brackets de playoffs ✅
Equipos del bracket 1-4 aparecían en el 5-8 y viceversa antes de que se jugaran los partidos.
- `standings-tab.tsx` — `getSemiTeamNames` y `getSemi58Teams`: si el partido no tiene summary, derivar equipos siempre desde `playoffMatchup`/`playoff58Matchup` + standings, nunca desde IDs explícitos.

### Feature: Tab "Equipos" en Estadísticas ✅
Estadísticas por equipo visibles para todos (no solo admin).
- `src/hooks/use-team-stats.ts` (nuevo) — agrega PJ, GF, GC, Dif, penalidades hechas/recibidas, T.PK, T.PP, promedio de jugadores (sin arqueros)
- `src/components/tournaments/player-stats-tab.tsx` — nuevo tab "Equipos", 4to tab visible para todos

### Feature: Columnas ordenables en todas las tablas de estadísticas ✅
Click en header de cualquier columna ordena asc/desc.
- `SortHead` component + `sortData<T>` helper en `player-stats-tab.tsx`
- Sort state por tabla: jugadores, arqueros (pill buttons), árbitros, mesa, equipos

### Fix: Responsive mobile en estadísticas y menú del torneo ✅
- Menú principal del torneo: `flex overflow-x-auto` (scroll horizontal, siempre 1 fila)
- Tabs internos de estadísticas: idem
- "Tabla de Posiciones" → "Posiciones" en mobile
- Filtro de categoría: apila verticalmente en mobile
- Tabla de jugadores: `overflow-x-auto`
- Dialog de detalle: `w-[calc(100vw-2rem)]`

### Feature: Sistema de Disciplina ✅
Sanciones disciplinarias por jugador, con cálculo automático de reincorporación y validación en asistencia.

**Tipos nuevos** (`src/types/index.ts`):
- `DisciplinarySanction` — id, jugador (denormalizado), equipo, categoría, motivo, fecha inicio, tipo (`calendar_days | matches | pending_review`), valor, notas
- `SummarySanctionedPlayer` — snapshot en el summary del partido
- `Tournament.disciplinarySanctions[]`, `GameSummary.sanctionedPlayers[]`

**Lógica** (`src/lib/discipline-helpers.ts`):
- `calculateReinstatementDate` — días calendario: suma días; fechas: encuentra el Nth partido del equipo en fixture, día siguiente
- `isSanctionActive(sanction, matches, referenceDate)` — activa si hoy < reincorporación (o si no se puede calcular → asume activa)
- `getSanctionMatchNumber` — posición 1-based del partido actual dentro de la sanción

**Reducer** (`src/lib/game-state-reducer.ts`):
- `ADD/UPDATE/REMOVE_SANCTION_TO_TOURNAMENT`

**Tab "Disciplina"** (`src/components/tournaments/discipline-tab.tsx`):
- Tabla: Jugador, Equipo, Categoría, Motivo, Inicio, Sanción, Reincorporación (calculada / TBD / En Revisión), Estado (badge)
- CRUD en dialog para admin (local y remoto); vista de solo lectura para todos
- Filtro por categoría

**Integración en partido:**
- `players-control-card.tsx` — jugadores con sanción activa: borde rojo + ícono `ShieldAlert`. No impide marcarlos presentes, solo advierte.
- `summary-generator.ts` — al generar el summary registra `sanctionedPlayers`: qué jugadores tenían sanción, si jugaron o no, número de fecha dentro de la sanción.

### Feature: Detalle de faltas por árbitro (solo admin) ✅
Nueva sección en el tab Staff de estadísticas.
- `src/hooks/use-staff-stats.ts` — nuevo `useRefereeMatchBreakdown`: una fila por árbitro por partido con `penaltiesHome` y `penaltiesAway`
- `player-stats-tab.tsx` — card "Detalle de Faltas por Árbitro" (visible solo en admin):
  - Tabla: Árbitro, Rol (1°/2°/3°), Categoría, Equipo A, Equipo B, Pen. A, Pen. B
  - Filtro por árbitro (cuando se filtra, los totales son solo de ese árbitro)
  - Fila de totales: suma Pen. A, suma Pen. B, partidos únicos. Nota cuando no hay filtro (un partido con 2 árbitros puede contar doble).

---

## Archivos clave modificados esta sesión
- `src/types/index.ts`
- `src/lib/discipline-helpers.ts` (nuevo)
- `src/lib/game-state-reducer.ts`
- `src/lib/summary-generator.ts`
- `src/hooks/use-team-stats.ts` (nuevo)
- `src/hooks/use-staff-stats.ts`
- `src/components/tournaments/player-stats-tab.tsx`
- `src/components/tournaments/discipline-tab.tsx` (nuevo)
- `src/components/tournaments/standings-tab.tsx`
- `src/components/controls/players-control-card.tsx`
- `src/app/tournaments/[tournamentId]/page.tsx`
- `IDEAS.md` (nuevo) — 9 funcionalidades pendientes priorizadas

---

## Pendientes / Ideas
Ver `IDEAS.md` para lista priorizada. Top 3:
1. PDF/resumen exportable de partido (jsPDF ya instalado)
2. Vista pública del torneo en tiempo real
3. Undo/deshacer acciones en controles durante el partido
