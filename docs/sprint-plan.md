# PLAN OPERATIVO DEL DEVELOPMENT ORCHESTRATOR — 54 H + 9 H RESERVA

## Calendario vigente
**IMPORTANT:** This document records the initial 28 Oct–17 Nov sprint baseline. As of packaging on 30 Oct 2026, NO task completion is assumed. Before implementation inspect the repo and actual progress; rebase remaining unstarted tasks to the first available workday without exceeding 54 planned + 9 contingency hours and without moving the 25 Nov meetup. If starting on 30 Oct and nothing was previously done, a fresh 21-day calendar is 30 Oct–19 Nov (3h every day: Mon–Fri 3h, Sat 3h, Sun 3h). Reserve 20–24 Nov for rehearsals/fixes if capacity allows. Adjust actual dates in a short documented plan, not by pretending past work was completed.

Historical reference schedule follows (for traceability only).

## Presupuesto inmutable por epic
EP-01 — App + fault injection + arquitectura: 13 h
EP-02 — Playwright: 3 h
EP-03 — Collector y tools: 6 h
EP-04 — Single AI Investigation Agent: 6 h
EP-05 — Independent Validator + Gate: 6 h
EP-06 — Dataset + evals + regression: 9 h
EP-07 — Speaker package, slides, demo fallback, docs: 11 h
TOTAL PLANIFICADO 54 h; RESERVA 9 h; CAPACIDAD 63 h.

## Dependency graph
EP-01 -> EP-02 -> EP-03 -> EP-04 -> EP-05 -> EP-06.
EP-07 parcialmente paralelo (abstract + headshot al inicio; presentación final tras resultados), pero no usar métricas no observadas.
Mínima ruta crítica: mini-store + ghost failure -> Playwright -> evidence -> agent -> validator -> gate -> eval -> demo.

## Semana 1 | 28 oct–3 nov | 18 h plan + 3 h reserva
W1-D1 MIÉ 28 | 3 h | QA-01 (Architect): repo pnpm, tipos, ADR, SQLite schema; salida: `pnpm build` base y docs/architecture.md inicial.
W1-D2 JUE 29 | 3 h | QA-02 (Web): API products/checkout/order con DB real; integración happy path básica.
W1-D3 VIE 30 | 3 h | QA-03 (Web 1h + Speaker 2h): UI scaffolding; propuesta/agenda en inglés, speaker bio y headshot listos para enviar por usuario (no enviar sin autorización).
W1-D4 SÁB 31 | 3 h | QA-04 (Web): catálogo + carrito + checkout + confirmación accesible.
W1-D5 DOM 01 | 3 h | QA-05 (Web): NORMAL/GHOST_SUCCESS/VERIFICATION_UNAVAILABLE; reset con aislamiento; verificaciones API/DB.
W1-D6 LUN 02 | 3 h | QA-06 (SDET): Playwright UI superficial + oracle independiente + trace JSON; demostración del false PASS.
W1-D7 MAR 03 | 3 h RESERVA | QA-R1: integración, estabilidad, corregir defectos, 5 repeticiones; no crear funcionalidades nuevas.
Gate M1 03-nov: script de demo NORMAL y GHOST_SUCCESS funcional, con persistencia distinta comprobada; inconclusive distinguible de missing.

## Semana 2 | 4–10 nov | 18 h plan + 3 h reserva
W2-D1 MIÉ 04 | 3 h | QA-07 (SDET/Agent): EvidenceRecord schema, collector y correlación runId/orderId.
W2-D2 JUE 05 | 3 h | QA-08 (Agent): 5 tools read-only, validación entradas, redacción, error states, limit/timeout.
W2-D3 VIE 06 | 3 h | QA-09 (Agent): LLM adapter con provider configurable, actor loop acotado, primera investigación.
W2-D4 SÁB 07 | 3 h | QA-10 (Agent): diagnosis Zod, claims/evidenceIds, unknown logic, unit tests.
W2-D5 DOM 08 | 3 h | QA-11 (SDET/Security): validator read-only independiente, estados CONFIRMED/DEFECT/UNKNOWN, pruebas de contrato.
W2-D6 LUN 09 | 3 h | QA-12 (SDET/Security): deterministic gate ALLOW/BLOCK/HOLD, política/versionado, tests.
W2-D7 MAR 10 | 3 h RESERVA | QA-R2: e2e agent pipeline, pruebas de confusión 404/503, integración y revisión de seguridad.
Gate M2 10-nov: `demo:all` genera diagnóstico y decisiones sin confiar en el LLM como juez final.

## Semana 3 | 11–17 nov | 18 h plan + 3 h reserva
W3-D1 MIÉ 11 | 3 h | QA-13 (Eval): gold dataset 12 casos (4/4/4) con expectedDiagnosis/expectedGate y procedencia de etiquetas.
W3-D2 JUE 12 | 3 h | QA-14 (Eval): runner + clasificación + evidence coverage + abstention + gate consistency; reportes.
W3-D3 VIE 13 | 3 h | QA-15 (SDET): 5 corridas de regression, análisis de fallos, baseline real, freeze funcional.
W3-D4 SÁB 14 | 3 h | QA-16 (Speaker): slides 12–14, narrativa y capturas reales; diagramas y fuentes.
W3-D5 DOM 15 | 3 h | QA-17 (Speaker/SDET): scripts demo normal/ghost/unknown, grabación explícita como respaldo, rehearsal del demo.
W3-D6 LUN 16 | 3 h | QA-18 (Speaker): README, notas EN, ensayo charla, recursos entregables.
W3-D7 MAR 17 | 3 h RESERVA | QA-R3: tests, mejoras críticas, no features nuevos; preparar release candidate.
Gate M3 17-nov: repo reproducible y presentación listos; demo en <=12 min con plan B y sin métricas fabricadas.

## Gate checklist por hito
M1: checkout + SQLite + 3 escenarios + test superficial pass vs falla backend + aislamiento + trace.
M2: collector, tools, agente, schema, validator independiente, gate determinista, auditoría básica y manejo 503.
M3: dataset 12, eval runner, métricas reales, 5 ejecuciones, deck inglés, guion, runbook, README, fallback.

## Sprint reporting contract
Cada día agregar a `docs/progress/DATE.md`:
- Fecha, ID, responsable, plan de horas, tiempo real, status y evidencias.
- Archivos modificados; comandos de build/test ejecutados y resultados (sin inventar output).
- Bugs, decisiones ADR, blockers y desviación de alcance.
- Horas gastadas por EP y reserva acumulada; progreso hacia siguiente gate.
- Siguiente tarea con dependencias y acceptance criteria.

## Enforcement
- No abrir PR si no pasan checks del alcance de la tarea.
- No merged changes con nuevas librerías sin justificación de mantenimiento/bundle.
- No acceso de escritura del runtime AI Agent a DB/commands/quality gate.
- Si no puede obtenerse el proveedor LLM, mocks exclusivamente para tests; no venderlos como demo real de IA.
- Proteger las rutas de fault injection y no publicarlas en un entorno expuesto.
- No añadir MCP, Jev, multiagents de runtime, dashboard, avanzado CI/CD salvo change request explícito y actualización del presupuesto.
- Nunca iniciar una tarea que exceda las horas del día sin dividirla en sub-tareas con cortes verificables.

## Prompt corto para activar ejecución diaria
"Usa AGENTS.md, docs/intent.md, docs/spec.md y este sprint-plan.md como políticas. Inspecciona el repositorio y los reportes existentes. Ejecuta SOLAMENTE la tarea pendiente del día actual o la de mayor prioridad que esté desbloqueada, hasta 3 horas de presupuesto. Implementa código, corre pruebas, documenta evidencia y genera el siguiente TASK PACK. Si no puedes ejecutar código en este entorno, entrega cambios propuestos y comandos de verificación, sin declarar tests ejecutados. No modifiques el baseline 54+9 h."
