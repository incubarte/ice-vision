# Pendientes de exploración

---

## Auto-update del sistema en la máquina local

**Contexto:**  
El sistema corre en una máquina física (local) con `npm run dev`. Para actualizar hay que ir físicamente a esa máquina y correr:
1. `git pull`
2. `npm install` (solo si cambiaron dependencias)
3. `npm run dev` (ya corre al inicio)

**Lo que se quiere explorar:**  
Que la máquina detecte automáticamente que hay una nueva versión en el repo y se actualice sola, sin intervención manual.

---

### Posibles enfoques a evaluar

#### 1. Script de watcher periódico (cron o loop)
Un script bash/node que cada X minutos:
- Hace `git fetch origin`
- Compara el hash local vs remoto (`git rev-parse HEAD` vs `git rev-parse origin/main`)
- Si hay diferencia: `git pull`, luego detecta si cambió `package.json` o `package-lock.json` (comparando hash del archivo antes y después) y corre `npm install` solo si hace falta
- Reinicia el proceso `npm run dev` (matar el proceso anterior y relanzar)

Puede implementarse como:
- `cron` del sistema operativo (macOS: `launchd` o `crontab`)
- Script Node.js con `setInterval`
- Script bash con `while true; do sleep 300; ...; done`

#### 2. GitHub Webhook + servidor local
- Configurar un webhook en el repo de GitHub que notifique al producirse un push a `master`
- Levantar un pequeño servidor HTTP local (express, o incluso `ngrok` para exponerlo) que reciba el webhook
- Al recibir la notificación: ejecutar el mismo flujo de pull + install + restart

**Ventaja:** Reacción inmediata al push, sin polling.  
**Desventaja:** Requiere exponer un puerto al exterior o usar un túnel (ngrok/cloudflared).

#### 3. PM2 como process manager
- Reemplazar `npm run dev` por `pm2 start` con la config de Next.js
- PM2 puede configurarse con `pm2 deploy` o scripts de `post-deploy` para automatizar el pull + restart
- `pm2 startup` para que se inicie solo con el sistema operativo
- Más robusto que un proceso suelto: restart automático si el proceso cae

**Nota:** En modo dev (`npm run dev`) puede haber diferencias con `npm run build && npm start`. Evaluar si conviene migrar a modo producción para esta máquina.

#### 4. Watchers de archivos del sistema
- `fsevents` (macOS) o `chokidar` para detectar cambios en `.git/FETCH_HEAD` o similar
- Menos recomendado: más complejo y frágil

---

### Preguntas a resolver antes de implementar

- [ ] ¿La máquina tiene acceso a internet continuo para hacer `git fetch`?
- [ ] ¿El repo es privado? ¿Tiene SSH key configurada para pull sin contraseña?
- [ ] ¿Se quiere actualizar desde `master` siempre, o desde la rama activa?
- [ ] ¿Es aceptable un downtime breve durante el restart del proceso?
- [ ] ¿Se prefiere polling (cron cada N minutos) o push (webhook)?
- [ ] ¿Conviene migrar de `npm run dev` a `pm2` para mejor gestión del proceso?

---

### Recomendación preliminar

El enfoque más simple y robusto para este caso es:

**Script bash + cron** — sin dependencias extra, sin exponer puertos:
```bash
# check-update.sh
cd /ruta/al/proyecto
git fetch origin master
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)
if [ "$LOCAL" != "$REMOTE" ]; then
  BEFORE=$(md5 package-lock.json)
  git pull origin master
  AFTER=$(md5 package-lock.json)
  if [ "$BEFORE" != "$AFTER" ]; then
    npm install
  fi
  pkill -f "next dev"
  nohup npm run dev &
fi
```

Registrado en `crontab` para correr cada 5 minutos:
```
*/5 * * * * /ruta/al/check-update.sh >> /tmp/scoreboard-update.log 2>&1
```

---

*Agregado: 2026-07-06*
