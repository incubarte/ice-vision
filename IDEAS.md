# IDEAS — Funcionalidades Pendientes

Ordenadas por impacto / prioridad estimada.

---

## 1. Exportación de resumen de partido (PDF / imagen compartible)
Generar un documento oficial después de cada partido con: resultado, goles (quién/cuándo/asistencias), penalidades, tiros al arco, asistencia de jugadores y staff asignado.
- `jsPDF` + `jspdf-autotable` ya están instalados
- Útil para registros oficiales y para compartir por WhatsApp
- Podría generarse desde la vista del partido finalizado o desde el fixture

---

## 2. Vista pública del torneo en tiempo real
URL pública donde padres, fanáticos y equipos puedan ver desde su teléfono: score en vivo, tabla de posiciones, resultados y stats — sin acceso admin.
- El scoreboard actual está pensado para TV en el recinto, no para consumo remoto
- Podría ser una ruta `/public/[tournamentId]` de solo lectura
- Funcionalidad más pedida en torneos juveniles

---

## 3. Undo / deshacer acciones en controles durante el partido
Si un operador borra un gol por error o agrega una penalidad equivocada no hay forma de revertirlo.
- Historial de las últimas N acciones con opción de deshacer
- Crítico para operación en vivo donde los errores de tipeo son frecuentes

---

## 4. Reglas de desempate configurables en la tabla de posiciones
Cuando dos equipos tienen los mismos puntos, ¿qué criterio aplica?
- Opciones: diferencia de goles, head-to-head, goles a favor, goles en contra, etc.
- Configurable por torneo (cada competencia tiene sus propias reglas)
- Afecta clasificación y pasaje a playoffs

---

## 5. Estadísticas acumuladas entre torneos (carrera del jugador/equipo)
Hoy las stats existen solo dentro de cada torneo. No hay forma de ver el historial de un jugador o equipo a lo largo de la temporada.
- La data ya está, falta agregarla cross-torneo
- Vista de "perfil de jugador" con stats de todos los torneos en que participó
- Útil para scouting y para reconocimiento de jugadores destacados

---

## 6. Gestión de series en playoffs (best-of-N)
Los playoffs son partido único. No hay soporte para series al mejor de 3 o 5.
- Seguimiento de victorias por equipo dentro de la serie
- Avance automático del ganador de la serie al siguiente cruce
- Visualización del estado de la serie en la tabla de llaves

---

## 7. Disciplina / sanciones post-partido
No hay forma de registrar sanciones que apliquen a partidos futuros (expulsiones, conducta grave, acumulación de penalidades).
- Las penalidades del partido desaparecen al terminar
- Sistema de fair play: acumulación de minutos/faltas → suspensión automática
- Panel de disciplina por torneo con historial de incidentes

---

## 8. PWA / modo offline instalable
En recintos de hockey el WiFi suele ser malo o inexistente.
- Service worker para que el control del partido funcione sin conexión
- Sincronización automática cuando vuelve la señal
- Instalable como app desde el navegador (Android/iOS)

---

## 9. Gráficos de evolución / rendimiento
`recharts` ya está instalado pero se usa poco.
- Evolución de la tabla de posiciones semana a semana
- Goles por partido a lo largo del torneo (por equipo o jugador)
- Distribución de penalidades por período (¿en qué momento se cometen más?)
- Comparativa de tiros vs goles por partido

---
