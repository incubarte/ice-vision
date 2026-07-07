# Arquitectura de Persistencia — ScoreBoard Studio

> Última revisión: 2026-06-22

---

## 1. Los tres modos de storage

El sistema tiene un único proveedor de storage abstracto (`StorageProvider`) con tres implementaciones seleccionadas por la variable de entorno `STORAGE_PROVIDER`:

| Modo | Env var | Implementación | Escribe en | Lee de |
|------|---------|----------------|-----------|--------|
| `local` | default | `LocalFileStorageProvider` | Disco (JSON files) | Disco + cache en memoria |
| `supabase_rw` | `STORAGE_PROVIDER=supabase_rw` | `SupabaseStorageProvider('rw')` | Supabase Storage directamente | Supabase + cache en memoria |
| `supabase_ro` | `STORAGE_PROVIDER=supabase_ro` | `SupabaseStorageProvider('ro')` | **BLOQUEADO** | Supabase (sin cache para live/shots) |

**Archivos clave:**
- `src/lib/storage/providers.ts` — implementaciones de LocalFile y Supabase
- `src/lib/storage/index.ts` — factory que lee `STORAGE_PROVIDER` y expone `storageProvider` + `isReadOnlyMode()`

---

## 2. Modo LOCAL (máquina física con el software de marcador)

### Flujo de escritura:
```
UI dispatch → /api/db POST → data-access.writeConfig/writeLiveState → 
LocalFileStorageProvider.writeFile() → fs.writeFile() en disco →
updateManifestEntry() (actualiza sync-manifest.json local con MD5 nuevo)
```

### Flujo de lectura:
```
/api/db GET → server-side-store.getConfig/getGameState → 
cache en memoria (storedConfig, storedGameState, ...) →
si cache vacío: data-access.readXxx → LocalFileStorageProvider.readFile() → disco
```

### Cache en memoria (`server-side-store.ts`):
- Variables module-level: `storedConfig`, `storedGameState`, `storedTournaments`, `storedShotsMetrics`
- Se invalida con `systemEmitter.emit('sync-complete')` después de cada sync
- Persiste mientras el proceso Node.js esté vivo (apropiado para proceso largo tipo `next dev`)

### Estructura de archivos en disco:
```
storage/data/
├── config.json                          # Configuración UI
├── live.json                            # Estado del partido en vivo
├── live-shotsMetrics.json               # Tiros y cambios de arquero (separado por perf)
├── tournaments.json                     # Índice de torneos (metadata)
├── tournaments/{id}/teams.json          # Plantillas y jugadores
├── tournaments/{id}/fixture.json        # Fixture del torneo
├── tournaments/{id}/summaries/{matchId}.json  # Resúmenes por partido
├── sync-manifest.json                   # Hashes MD5 de todos los archivos (para sync)
├── sync-plan.json                       # Plan de sync temporal
├── sync-snapshots/{ts}/                 # Snapshots de conflictos
└── sync-logs.json                       # Historial de syncs
```

---

## 3. Modo SUPABASE_RO (instancia Vercel — scoreboard de solo lectura)

### Variables de entorno requeridas:
```
STORAGE_PROVIDER=supabase_ro
SUPABASE_URL=https://uuvhibznebwdbxcttufu.supabase.co
SUPABASE_BUCKET=ice-vision-sandbox
SUPABASE_ANON_KEY=...  (clave pública, solo lectura)
NEXT_PUBLIC_READ_ONLY=true  (bloquea POST en la UI y en la API)
```

### Comportamiento especial:
- **`isReadOnlyMode()` = true** → `getGameState()` y `getShotsMetrics()` NO usan cache, siempre leen fresh de Supabase
- POST a `/api/db` → 403 (bloqueado por `NEXT_PUBLIC_READ_ONLY`)
- POST a `/api/match-summary` → 403 (bloqueado por `NEXT_PUBLIC_READ_ONLY`)
- Misma estructura de archivos que en local, pero en Supabase Storage

### Supabase Storage:
- Mismo árbol de archivos que en disco local
- Bucket: `ice-vision-sandbox`
- Los archivos se actualizan cuando la máquina local hace sync (modo local → supabase)

---

## 4. Sistema de Sync (Local ↔ Supabase)

El sync es **unidireccional o bidireccional** según la configuración, siempre iniciado desde la máquina local.

### Fases:
1. **Analyze** (`/api/sync/analyze`): compara `sync-manifest.json` local vs remote, detecta qué cambió en cada lado
2. **Plan** (`/api/sync/execute-plan`): decide upload / download / conflict para cada archivo
3. **Execute**: sube o baja archivos; en conflicto guarda snapshot para resolución manual

### Detección de cambios:
- Cada archivo tiene un hash MD5 en `sync-manifest.json`
- Si el hash local ≠ hash remoto → cambió algo
- Si ambos cambiaron respecto al último sync → **conflicto**

### Triggers de sync:
- Manual (botón en UI)
- Auto-intervalo: `config.autoSyncAnalysisIntervalMinutes`
- Post-edición de resumen: `config.autoSyncAfterSummaryEdit`
- Live sync: `config.enableLiveSync` (sube `live.json` cuando para el reloj)

**Archivos clave del sync:**
- `src/lib/sync-service.ts` — lógica central (enorme, ~87KB)
- `src/lib/sync-manifest.ts` — manejo de manifests y MD5
- `src/app/api/sync/` — ~13 endpoints

---

## 5. Modo SUPABASE_RW — ya existe pero no se usa en Vercel

El código de `supabase_rw` **ya existe** en `providers.ts`:
- Usa `SUPABASE_SERVICE_KEY` (clave con permisos de escritura)
- `writeFile()` hace `supabase.storage.from(bucket).upload(filePath, content, { upsert: true })`
- `readFile()` hace `supabase.storage.from(bucket).download(filePath)`

**Diferencia con `supabase_ro`:** la misma clase, diferente key y sin bloqueo de escritura.

**Problema de cache en RW:** `isReadOnlyMode()` solo retorna `true` para `supabase_ro`. 
En `supabase_rw`, el cache se comporta como en `local` (cache en memoria reutilizado).
En Vercel (serverless), esto es problemático: múltiples instancias lambda con caches divergentes.

---

## 6. Variables de entorno completas

```bash
# Storage mode
STORAGE_PROVIDER=local|supabase_rw|supabase_ro

# Supabase (requerido para supabase_rw y supabase_ro)
SUPABASE_URL=https://uuvhibznebwdbxcttufu.supabase.co
SUPABASE_BUCKET=ice-vision-sandbox
SUPABASE_ANON_KEY=...   # Solo lectura (supabase_ro)
SUPABASE_SERVICE_KEY=... # Lectura+escritura (supabase_rw)

# UI / API
NEXT_PUBLIC_READ_ONLY=true|false  # Bloquea POST en API si es true
NEXT_PUBLIC_SHOW_PLAYER_STATS=true|false

# Storage path (solo para modo local)
STORAGE_PATH=./storage

# Opcional
GROQ_API_KEY=...  # Speech-to-text en voz
```

---

## 7. Endpoints relevantes para escritura

| Endpoint | Método | Qué hace | Bloqueado por READ_ONLY |
|----------|--------|----------|------------------------|
| `/api/db` | POST | Guarda config y/o live state | Sí |
| `/api/match-summary` | POST | Guarda resumen de un partido | Sí |
| `/api/tournaments/[id]` | POST | Guarda torneo completo | Probablemente sí |
| `/api/sync/*` | varios | Operaciones de sync | No (solo local) |

---

## 8. PLAN: Habilitar escritura directa desde Vercel

Ver sección siguiente.
