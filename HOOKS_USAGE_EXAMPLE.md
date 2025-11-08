# 🎯 Guía de Uso de Hooks Personalizados

Los hooks personalizados encapsulan la lógica de diferentes áreas del juego para facilitar el desarrollo y reducir el acoplamiento con el estado global.

## 📦 Hooks Disponibles

### 1. `useGoals` - Manejo de Goles

```typescript
import { useGoals } from '@/hooks/use-game';

function GoalsPanel() {
  const {
    goals,           // Estado de goles { home: [], away: [] }
    score,           // Score actual { home: number, away: number }
    addGoal,         // Función para agregar gol
    editGoal,        // Función para editar gol
    deleteGoal,      // Función para eliminar gol
    getAllGoals,     // Obtener todos los goles ordenados
    getGoalById,     // Buscar gol por ID
  } = useGoals();

  const handleAddGoal = () => {
    addGoal({
      team: 'home',
      time: 12034,  // tiempo en centésimas
      scorer: 'John Doe',
      playerNumber: '10',
    });
  };

  return (
    <div>
      <h2>Score: {score.home} - {score.away}</h2>
      <button onClick={handleAddGoal}>Add Goal</button>
      {getAllGoals().map(goal => (
        <div key={goal.id}>{goal.scorer}</div>
      ))}
    </div>
  );
}
```

### 2. `useClock` - Manejo del Reloj

```typescript
import { useClock } from '@/hooks/use-game';

function ClockControls() {
  const {
    currentTime,        // Tiempo actual en centésimas
    currentPeriod,      // Período actual
    isRunning,          // Si el reloj está corriendo
    toggleClock,        // Iniciar/pausar reloj
    setTime,            // Establecer tiempo específico
    adjustTime,         // Ajustar tiempo (agregar/quitar)
    setPeriod,          // Cambiar período
    getFormattedTime,   // Obtener tiempo formateado
  } = useClock();

  const formattedTime = getFormattedTime({
    showTenths: currentTime < 6000,
    includeMinutesForTenths: true
  });

  return (
    <div>
      <h1>{formattedTime}</h1>
      <p>Period: {currentPeriod}</p>
      <button onClick={toggleClock}>
        {isRunning ? 'Pause' : 'Start'}
      </button>
      <button onClick={() => setTime(20, 0)}>
        Set to 20:00
      </button>
      <button onClick={() => adjustTime(100)}>
        +1 second
      </button>
    </div>
  );
}
```

### 3. `usePenalties` - Manejo de Penaltis

```typescript
import { usePenalties } from '@/hooks/use-game';

function PenaltiesPanel() {
  const {
    penalties,              // Estado de penaltis { home: [], away: [] }
    addPenalty,             // Agregar penalti
    deletePenalty,          // Eliminar penalti
    editPenalty,            // Editar penalti
    clearPenalty,           // Limpiar penalti (marcar como completado)
    getActivePenalties,     // Obtener penaltis activos
    getPlayersOnIce,        // Obtener jugadores en hielo
  } = usePenalties();

  const handleAddPenalty = () => {
    addPenalty({
      team: 'away',
      playerNumber: '5',
      playerName: 'Jane Smith',
      penaltyTypeId: 'minor-2',
      reducesPlayerCount: true,
      clearsOnGoal: true,
      isBenchPenalty: false,
    });
  };

  const homePlayersOnIce = getPlayersOnIce('home');
  const activePenalties = getActivePenalties('home');

  return (
    <div>
      <p>Home players on ice: {homePlayersOnIce}</p>
      <p>Active penalties: {activePenalties.length}</p>
      <button onClick={handleAddPenalty}>Add Penalty</button>
      {penalties.home.map(penalty => (
        <div key={penalty.id}>
          #{penalty.playerNumber} - {penalty.playerName}
          <button onClick={() => deletePenalty('home', penalty.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

## 🎨 Ejemplo Completo: Componente de Control del Juego

```typescript
import { useGoals, useClock, usePenalties } from '@/hooks/use-game';

function GameControls() {
  const { score, addGoal } = useGoals();
  const { currentTime, isRunning, toggleClock, getFormattedTime } = useClock();
  const { getPlayersOnIce } = usePenalties();

  const homeOnIce = getPlayersOnIce('home');
  const awayOnIce = getPlayersOnIce('away');

  return (
    <div className="game-controls">
      {/* Scoreboard */}
      <div className="scoreboard">
        <div>
          <h3>HOME</h3>
          <p className="score">{score.home}</p>
          <p>{homeOnIce} on ice</p>
          <button onClick={() => addGoal({ team: 'home' })}>
            Goal
          </button>
        </div>

        <div className="clock">
          <h1>{getFormattedTime()}</h1>
          <button onClick={toggleClock}>
            {isRunning ? '⏸ Pause' : '▶️ Start'}
          </button>
        </div>

        <div>
          <h3>AWAY</h3>
          <p className="score">{score.away}</p>
          <p>{awayOnIce} on ice</p>
          <button onClick={() => addGoal({ team: 'away' })}>
            Goal
          </button>
        </div>
      </div>
    </div>
  );
}
```

## 📊 Ventajas de los Hooks Personalizados

### ✅ Antes (usando el context directamente)
```typescript
function MyComponent() {
  const { state, dispatch } = useGameState();

  // Lógica mezclada con el componente
  const addGoal = () => {
    dispatch({
      type: 'ADD_GOAL',
      payload: {
        team: 'home',
        // ... muchos más campos
      }
    });
  };

  // Acceso complicado al estado
  const homeGoals = state.live.goals.home;
  const homeScore = homeGoals.length;
}
```

### ✅ Ahora (usando hooks personalizados)
```typescript
function MyComponent() {
  const { addGoal, score, goals } = useGoals();

  // API limpia y simple
  const handleGoal = () => {
    addGoal({ team: 'home' });
  };

  // Acceso directo a lo que necesitas
  const homeGoals = goals.home;
  const homeScore = score.home;
}
```

## 🚀 Beneficios

1. **Código más limpio**: No necesitas saber la estructura interna del estado
2. **TypeScript friendly**: Autocompletado completo en tu IDE
3. **Reutilizable**: Usa los mismos hooks en múltiples componentes
4. **Testeable**: Puedes mockear los hooks fácilmente en tests
5. **Mantenible**: Si cambia la estructura del estado, solo actualizas el hook
6. **Performance**: Los hooks están optimizados con `useCallback`

## 📝 Notas

- Todos los hooks usan `useCallback` para evitar re-renders innecesarios
- Los hooks acceden al mismo estado global, no crean estados separados
- Puedes combinar múltiples hooks en un mismo componente
- Los hooks son compatibles con el sistema actual (no rompen nada)

### 4. `useShootout` - Manejo de Shootouts

```typescript
import { useShootout } from '@/hooks/use-game';

function ShootoutPanel() {
  const {
    shootout,              // Estado completo del shootout
    isActive,              // Si el shootout está activo
    rounds,                // Número de rondas
    startShootout,         // Iniciar shootout
    endShootout,           // Finalizar shootout
    recordShootoutAttempt, // Registrar intento
    getShootoutScore,      // Obtener score del shootout
    getShootoutAttempts,   // Obtener intentos
  } = useShootout();

  const score = getShootoutScore();

  const handleStartShootout = () => {
    startShootout();
  };

  const handleAttempt = (scored: boolean) => {
    recordShootoutAttempt('home', {
      playerNumber: '10',
      playerName: 'John Doe',
      scored,
    });
  };

  if (!isActive) {
    return <button onClick={handleStartShootout}>Start Shootout</button>;
  }

  return (
    <div>
      <h2>Shootout: {score.home} - {score.away}</h2>
      <button onClick={() => handleAttempt(true)}>Goal</button>
      <button onClick={() => handleAttempt(false)}>Miss</button>
      <button onClick={endShootout}>End Shootout</button>
    </div>
  );
}
```

### 5. `useTeams` - Manejo de Equipos

```typescript
import { useTeams } from '@/hooks/use-game';

function TeamsPanel() {
  const {
    homeTeamName,      // Nombre del equipo local
    awayTeamName,      // Nombre del equipo visitante
    homeTeamSubName,   // Subnombre del equipo local
    awayTeamSubName,   // Subnombre del equipo visitante
    setTeamName,       // Establecer nombre de equipo
    setTeamSubName,    // Establecer subnombre
    swapTeams,         // Intercambiar equipos
    getTeamData,       // Obtener datos completos del equipo
  } = useTeams();

  const handleSwap = () => {
    swapTeams();
  };

  const handleSetHome = (name: string) => {
    setTeamName('home', name);
  };

  const homeData = getTeamData('home');

  return (
    <div>
      <h3>{homeTeamName} vs {awayTeamName}</h3>
      <button onClick={handleSwap}>Swap Teams</button>
      <input 
        value={homeTeamName} 
        onChange={(e) => handleSetHome(e.target.value)} 
      />
      {homeData && <p>Logo: {homeData.logoUrl}</p>}
    </div>
  );
}
```

## 📝 Lista Completa de Hooks

| Hook | Propósito | Casos de Uso |
|------|-----------|--------------|
| `useGoals` | Manejo de goles | Agregar, editar, eliminar goles. Ver score. |
| `useClock` | Manejo del reloj | Controlar tiempo, períodos, pausas. |
| `usePenalties` | Manejo de penaltis | Agregar, editar penaltis. Ver jugadores en hielo. |
| `useShootout` | Manejo de shootouts | Iniciar, registrar intentos, terminar shootout. |
| `useTeams` | Manejo de equipos | Cambiar nombres, intercambiar equipos. |

