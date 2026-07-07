# Plan: Escritura directa desde Vercel (supabase_rw) + Admin Mode UI

> Estado: BORRADOR — revisar antes de implementar  
> Fecha: 2026-06-22

---

## Scope definido

| Operación | Estado |
|-----------|--------|
| Editar resúmenes de partidos | ✅ Prioritario |
| Editar fixture | ✅ Segunda etapa |
| Editar equipos / jugadores | ✅ Tercera etapa (si no es complejo) |
| Estado live / shots / config / reloj | ❌ Nunca desde Vercel |

`NEXT_PUBLIC_READ_ONLY=true` se **mantiene en Vercel** → protege live, shots y config sin tocar ese flujo.

---

## Por qué fallaron los intentos anteriores (4 bloqueos)

### Bloqueo 1 — API bloqueada
`NEXT_PUBLIC_READ_ONLY=true` retorna 403 en todos los POST antes de llegar al storage. Es el primer firewall y el más probable de haberse ignorado.

### Bloqueo 2 — Storage provider incorrecto
`supabase_ro` bloquea `writeFile()` explícitamente. Requiere `supabase_rw` + `SUPABASE_SERVICE_KEY`.

### Bloqueo 3 — Cache stale en múltiples lambdas
En `supabase_rw`, el cache en memoria se comporta igual que en `local`. En Vercel hay múltiples instancias lambda en paralelo con caches independientes → un GET en otra lambda devuelve datos viejos después de un write → "no guardó".

### Bloqueo 4 — Sync manifest no actualizado
`writeSingleMatchSummary()` llama a `updateManifestEntry()` que escribe en el filesystem local con `fs`. En Vercel ese filesystem es efímero. El `sync-manifest.json` en Supabase queda con hash viejo → la máquina local al sincronizar no detecta el cambio → puede pisar el resumen editado desde Vercel.

---

## La solución: Admin Mode con bypass por header

### Idea central
- `NEXT_PUBLIC_READ_ONLY=true` se mantiene en Vercel para todos los endpoints
- Los endpoints de escritura aceptan un **header de admin** que bypasea el bloqueo
- La UI muestra los controles de edición solo cuando el usuario desbloqueó con la clave

---

## Parte 1 — Backend

### Cambio A: Variable de entorno de auth (Vercel)
```
ADMIN_WRITE_SECRET=<clave-secreta>        # server-side, nunca llega al browser
STORAGE_PROVIDER=supabase_rw              # cambiar de supabase_ro
SUPABASE_SERVICE_KEY=<service role key>   # agregar
# NEXT_PUBLIC_READ_ONLY=true              # MANTENER
```

### Cambio B: Nuevo endpoint `/api/admin/verify`
Endpoint mínimo para que el cliente valide si una clave es correcta antes de guardarlo en localStorage:

```ts
// src/app/api/admin/verify/route.ts
export async function POST(request: Request) {
    const { secret } = await request.json();
    const valid = !!process.env.ADMIN_WRITE_SECRET 
               && secret === process.env.ADMIN_WRITE_SECRET;
    return NextResponse.json({ valid });
}
```

Sin rate limiting por ahora — la clave es larga, el riesgo es bajo para este uso.

### Cambio C: Bypass de auth en los endpoints de escritura

**`/api/match-summary/route.ts`** — reemplazar el bloqueo por:
```ts
const adminSecret = request.headers.get('x-admin-secret');
const isAdminRequest = !!process.env.ADMIN_WRITE_SECRET 
                    && adminSecret === process.env.ADMIN_WRITE_SECRET;

if (process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminRequest) {
    return NextResponse.json({ success: false, message: 'Solo lectura.' }, { status: 403 });
}
```

**`/api/tournaments/[id]/route.ts`** — mismo cambio en el POST handler.  
También: quitar el llamado al `sync-trigger` cuando `STORAGE_PROVIDER === 'supabase_rw'` (no tiene sentido en Vercel).

### Cambio D: Cache bypass para `supabase_rw`

**`src/lib/storage/index.ts`** — agregar:
```ts
export function isSupabaseMode(): boolean {
    const p = process.env.STORAGE_PROVIDER || 'local';
    return p === 'supabase_ro' || p === 'supabase_rw';
}
```

**`src/lib/server-side-store.ts`** — en los 4 getters (`getConfig`, `getTournaments`, `getGameState`, `getShotsMetrics`), extender el bypass de cache:
```ts
// Antes: if (isReadOnlyMode())
// Después: if (isReadOnlyMode() || isSupabaseMode())
```
En Vercel con múltiples lambdas, siempre leer fresh de Supabase es lo correcto.

### Cambio E: Actualizar sync-manifest en Supabase al escribir (el más delicado)

**Problema:** `writeSingleMatchSummary()` y `writeTournament()` llaman a `updateManifestEntry()` que usa `fs` (filesystem local). En Vercel ese FS es efímero.

**Fix en `src/lib/data-access.ts`**: detectar el modo y bifurcar:

```ts
// En writeSingleMatchSummary():
await storageProvider.writeFile(summaryKey, summaryContent);

if (process.env.STORAGE_PROVIDER === 'supabase_rw') {
    await updateRemoteManifestEntry(summaryKey, summaryContent);
} else {
    await updateManifestEntry(summaryKey, summaryContent);
}
```

`updateRemoteManifestEntry()` (nueva función en `data-access.ts` o en un helper):
1. Lee `sync-manifest.json` de Supabase via `storageProvider.readFile('sync-manifest.json')`  
2. Calcula MD5 del contenido (reutiliza `hashContent()` de `sync-manifest.ts`)  
3. Actualiza la entrada del archivo en el objeto  
4. Sube el manifest actualizado via `storageProvider.writeFile('sync-manifest.json', ...)`

Riesgo de race condition: mínimo para correcciones manuales. Mitigación: si el manifest read falla (no existe), crear uno vacío y continuar.

---

## Parte 2 — Frontend (Admin Mode)

### Flujo de usuario
1. Usuario entra a Vercel (`NEXT_PUBLIC_READ_ONLY=true`) → ve la app normal, sin controles de edición
2. Hace click en un **ícono de candado** en el header
3. Aparece un dialog con input de contraseña
4. Submit → llama `/api/admin/verify` → si válido, guarda en `localStorage('adminSecret')`
5. La UI re-renderiza con controles de edición visibles (el `isReadOnly` ahora es `false` para el usuario)
6. Cuando guarda un resumen, el fetch incluye `x-admin-secret: <secret>` en el header

### Nuevo hook `useAdminMode`

```ts
// src/hooks/use-admin-mode.ts
export function useAdminMode() {
    const [adminSecret, setAdminSecret] = useState<string | null>(null);
    
    useEffect(() => {
        setAdminSecret(localStorage.getItem('adminSecret'));
    }, []);
    
    const login = async (secret: string): Promise<boolean> => {
        const res = await fetch('/api/admin/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret })
        });
        const { valid } = await res.json();
        if (valid) {
            localStorage.setItem('adminSecret', secret);
            setAdminSecret(secret);
        }
        return valid;
    };
    
    const logout = () => {
        localStorage.removeItem('adminSecret');
        setAdminSecret(null);
    };
    
    const isAdminMode = !!adminSecret;
    const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true' && !isAdminMode;
    
    return { isAdminMode, isReadOnly, adminSecret, login, logout };
}
```

### Dónde inyectar el header en el reducer

El reducer hace el fetch directamente en `SAVE_MATCH_SUMMARY`. No tiene acceso a context ni localStorage. La solución más limpia: **pasar el `adminSecret` en el payload del action**.

```ts
// En fixture-match-summary-dialog.tsx:
const { adminSecret } = useAdminMode();
// ...
dispatch({ type: 'SAVE_MATCH_SUMMARY', payload: { matchId: match.id, summary: localSummary, adminSecret } });
```

```ts
// En game-state-reducer.ts, case 'SAVE_MATCH_SUMMARY':
const { matchId, summary, adminSecret } = action.payload;
fetch('/api/match-summary', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        ...(adminSecret ? { 'x-admin-secret': adminSecret } : {})
    },
    body: JSON.stringify({ tournamentId, matchId, summary })
})
```

También hay que actualizar el tipo de la action en `src/types/index.ts`:
```ts
| { type: 'SAVE_MATCH_SUMMARY'; payload: { matchId: string; summary: GameSummary; adminSecret?: string } }
```

### Componentes a modificar para respetar admin mode

Para el **scope de resúmenes**, solo:
- `fixture-match-summary-dialog.tsx`: reemplazar `const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true'` por `const { isReadOnly } = useAdminMode()`

El header y el resto de la nav pueden quedarse con el `isReadOnly` estático → en Vercel el usuario admin no ve el menú de Controls ni Config (que está bien, no los necesita).

### UI del candado en el header

En `header.tsx`, cuando `NEXT_PUBLIC_READ_ONLY === 'true'`:
- Mostrar un ícono de candado (`Lock` / `Unlock` de lucide)
- Click → abre un pequeño dialog con input de contraseña
- El dialog es parte del header component, sin depender del context

---

## Archivos a tocar (resumen)

| Archivo | Cambio |
|---------|--------|
| `src/app/api/admin/verify/route.ts` | **NUEVO** — validación de clave |
| `src/app/api/match-summary/route.ts` | Bypass auth + mantener bloqueo para no-admin |
| `src/app/api/tournaments/[id]/route.ts` | Bypass auth + skip sync-trigger en supabase_rw |
| `src/lib/storage/index.ts` | Agregar `isSupabaseMode()` |
| `src/lib/server-side-store.ts` | Cache bypass para todos los modos supabase |
| `src/lib/data-access.ts` | Bifurcar `updateManifestEntry` local vs supabase |
| `src/hooks/use-admin-mode.ts` | **NUEVO** — hook de admin mode |
| `src/components/layout/header.tsx` | Agregar ícono de candado + dialog |
| `src/components/fixture/fixture-match-summary-dialog.tsx` | Usar `useAdminMode()` en vez del env var estático |
| `src/lib/game-state-reducer.ts` | Pasar `adminSecret` en el fetch de `SAVE_MATCH_SUMMARY` |
| `src/types/index.ts` | Agregar `adminSecret?` al tipo de la action |
| Vercel env vars | `STORAGE_PROVIDER`, `SUPABASE_SERVICE_KEY`, `ADMIN_WRITE_SECRET` |

Total: **9 archivos modificados + 2 nuevos**. Ninguno toca la lógica de sync, live, ni shots.

---

## Lo que NO cambia

- `sync-service.ts`, `sync-manifest.ts` — no se tocan
- `/api/db` POST — sigue bloqueado (live + config protegidos)
- El sistema de sync desde la máquina local — sigue igual
- Todo el flujo de partidos en curso — intacto

---

## Orden de implementación sugerido

**Fase 1 — Backend (testeable en local)**
1. `isSupabaseMode()` + cache bypass
2. `/api/admin/verify` endpoint
3. Bypass auth en `match-summary` y `tournaments/[id]`
4. `updateRemoteManifestEntry` en data-access

**Fase 2 — Frontend**
5. `useAdminMode` hook
6. Candado en header + dialog
7. `fixture-match-summary-dialog` con admin mode
8. Pasar `adminSecret` por el reducer

**Fase 3 — Deploy**
9. Actualizar env vars en Vercel
10. Verificar que una corrección desde Vercel sea descargada por la máquina local en el próximo sync

---

## Pendiente / Decisiones antes de arrancar

- [ ] ¿Queremos mostrar el candado siempre en READ_ONLY=true, o solo cuando hay `ADMIN_WRITE_SECRET` configurado? (si usamos `NEXT_PUBLIC_ADMIN_ENABLED=true` como hint, el usuario sabe que existe la opción)
- [ ] ¿El admin mode desbloquea solo resúmenes, o también el tab de Fixture (editar partidos del calendario)?
- [ ] Para fixture: ¿`SAVE_TOURNAMENT` también necesita el adminSecret en el payload? (mismo patrón)
