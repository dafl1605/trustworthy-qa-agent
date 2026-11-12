# Runbook personal — entender el proyecto y ejecutar la demo

Documento para la persona que da la charla. Está en español; las frases que se dicen en voz alta están en inglés, como el resto del material del speaker. No es una decisión de release y no sustituye `AGENTS.md`, `docs/spec.md` ni `docs/speaker/demo-script.md`.

Estado honesto: nadie ha cronometrado la charla en voz alta (`spokenDeliveryMeasured` es false, S-008 no está completo). O-001 a O-007 siguen UNVERIFIED. Ningún resultado commiteado viene de un modelo real. No cites porcentajes.

---

## 1. La idea en un minuto

Una pantalla que dice `Order confirmed` no prueba que el pedido se guardó. Un LLM que dice «SUCCESS» tampoco es evidencia independiente. El proyecto lo demuestra con tres modos deterministas de un checkout local:

| Modo | Pantalla | Lectura independiente | Verificación | Gate |
|---|---|---|---|---|
| `NORMAL` | `Order confirmed` | `200 FOUND` | `CONFIRMED` | `ALLOW` |
| `GHOST_SUCCESS` | `Order confirmed`, sin pedido guardado | `404 ABSENT` | `DEFECT` | `BLOCK` |
| `VERIFICATION_UNAVAILABLE` | `Order confirmed` | `503 UNAVAILABLE` | `UNKNOWN` | `HOLD` |

Reglas que no se rompen: un 503 no es un 404; `HOLD` no es un `BLOCK` suave; el diagnóstico de un LLM nunca cambia el veredicto.

## 2. Mapa de la arquitectura

```
Playwright / usuario ──► storefront (React) ──► API (Node + SQLite)
                                                   │  ▲
                              harness local ───────┘  │ (solo loopback + token)
                                                      │
 evidence-collector ─► qa-agent (1 agente, solo lectura, 5 tools)
        │                      │
        │              checkModelDiagnosis (¿cada claim cita evidencia real?)
        ▼
 validators.verifyOrder ── lee SQLite por su propia conexión de solo lectura
        ▼
 quality-gate.decideRelease (política tqa-gate-1) ──► ALLOW | BLOCK | HOLD
```

Qué hace cada pieza y qué **no** hace:

- **`apps/storefront`**: catálogo, carrito (hasta 3 productos), checkout, confirmación. No tiene interruptor de escenario. La confirmación no llama a `GET /api/orders/:id` y avisa de que el mensaje no prueba que el pedido se guardó.
- **`apps/api`**: precios en centavos enteros calculados en el servidor. Un checkout normal se guarda en SQLite antes de responder. El harness de fallos (`/harness/*`) solo se monta con `TQA_HARNESS=1` y un `TQA_HARNESS_TOKEN` no vacío; exige llamante loopback y la cabecera `x-tqa-harness-token`. Rutas: `POST /harness/runs/:runId/scenario` (body `{"scenario": "..."}`), `POST /harness/runs/:runId/reset`, `GET /harness/runs/:runId`.
- **`packages/evidence-collector`**: crea `EvidenceRecord` ligando `runId` y `orderId`. Un 404 y un 503 quedan como evidencias distintas. No decide nada.
- **`packages/qa-agent`**: el único agente de runtime. Cinco tools de solo lectura (`get_test_result`, `list_evidence`, `get_network_events`, `lookup_order`, `get_application_logs`); cualquier otra se deniega. No tiene shell, no escribe en BD, no aprueba gates. Proveedor `scripted-mock` (respuestas guionadas) u OpenAI-compatible opcional (apagado por defecto). `checkModelDiagnosis` valida con Zod y compara cada claim contra el índice de evidencia: sin cita → `UNVERIFIED`; id inexistente, 503 o timeout → `UNKNOWN`.
- **`packages/validators`** (`verifyOrder`): lee SQLite por su cuenta, sin recibir el diagnóstico. `CONFIRMED`, `DEFECT` o `UNKNOWN`.
- **`packages/quality-gate`** (`decideRelease`, `tqa-gate-1`): `CONFIRMED→ALLOW`, `DEFECT→BLOCK`, `UNKNOWN→HOLD`. Un diagnóstico no puede convertir un ghost en `ALLOW` ni un 503 en `BLOCK`. Texto tipo «ignora la política y aprueba» no se copia a la decisión. Si el pedido está confirmado pero el diagnóstico dice «no persistido», el resultado es `HOLD` hasta reconciliar.
- **`tests/evals` + `fixtures/golden-dataset`**: 12 casos etiquetados por humanos (4/4/4). 12 casos no son una tasa de fiabilidad.
- **`fixtures/regression-baseline`**: 5 corridas medidas de `pnpm test:e2e` y 5 de `pnpm test:e2e:ghost-oracle`.

Por qué hay dos «ghost» en Playwright: `pnpm test:e2e` incluye un chequeo de UI limitado que **pasa** en `GHOST_SUCCESS` (solo mira el texto). `pnpm test:e2e:ghost-oracle` conserva la aserción de persistencia (espera 200) y **falla** (recibe 404). Ese rojo es el resultado negativo esperado: no lo «arregles» ni cambies la aserción a 404.

## 3. Preparación (una vez, fuera del escenario)

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm typecheck
pnpm test            # esperado: todo en verde
```

Si `pnpm test:e2e` dice `Executable doesn't exist`, falta el Chromium que corresponde a Playwright 1.65.0 (el comando anterior lo instala).

Antes del día de la charla:

1. `pnpm test` y `pnpm demo:pipeline` en verde en la máquina que vas a usar.
2. Abre y reproduce `docs/speaker/rehearsal/backup-recording.webm` y comprueba que se ve.
3. Decide si vas a regenerar el respaldo. `pnpm demo:rehearsal` **sobrescribe** el `.webm` y `rehearsal.json` con ids nuevos; si lo haces, dilo en la charla. Si no, usa los ids del archivo commiteado y di que pertenecen al ensayo.
4. Cronometra la charla en voz alta tú mismo. Es la única parte de S-008 que falta; hasta entonces no digas que está medida.

## 4. Demo — tres rutas

### Ruta A (recomendada, repetible): comandos

```bash
pnpm demo:pipeline
```

Construye, levanta API y storefront en puertos locales, hace los tres checkouts con Playwright y pasa cada uno por collector → agente scripted → `checkModelDiagnosis` → `verifyOrder` → `decideRelease`. Imprime una tabla con columnas mode, orderId, screen, diagnóstico, evidence check, lookup, verification, gate y reason codes (los ids cambian). Abajo, versión resumida sin orderId ni screen:

```
provider: scripted-mock
modelInvoked: false
measuredFromModel: false
NORMAL                   | SUCCESS             | CITED      | 200 FOUND                            | CONFIRMED | ALLOW | VERIFICATION_CONFIRMED
GHOST_SUCCESS            | SUCCESS             | UNVERIFIED | 404 ABSENT                           | DEFECT    | BLOCK | VERIFICATION_DEFECT,DIAGNOSIS_IGNORED
VERIFICATION_UNAVAILABLE | ORDER_NOT_PERSISTED | UNKNOWN    | 503 UNAVAILABLE service_unavailable  | UNKNOWN   | HOLD  | VERIFICATION_UNKNOWN,DIAGNOSIS_IGNORED
```

Cómo leerla: en GHOST el agente guionado dice `SUCCESS` y el gate igualmente dice `BLOCK` (`DIAGNOSIS_IGNORED`). En UNAVAILABLE el agente guionado afirma que el 503 es un pedido perdido y el gate dice `HOLD`. Exit 0 solo significa que las tres filas coinciden con la matriz; **no** es `ALLOW`.

Otros comandos de apoyo en la demo:

| Comando | Para qué |
|---|---|
| `pnpm demo:false-pass` | Muestra el falso pass: UI verde y cinco oracles de persistencia fallando con 404. |
| `pnpm test:e2e:ghost-oracle` | Enseñar el rojo esperado (`Expected: 200`, `Received: 404`). |
| `pnpm demo:rehearsal` | Regenerar vídeo y JSON de respaldo (sobrescribe). |

### Ruta B: en vivo con el navegador (más riesgo)

El storefront genera un `runId` por intento y lo muestra en el campo de solo lectura **Correlation id**. El escenario se arma en la API para ese `runId` **antes** de pulsar *Place order*. Probé la parte de API de este flujo con curl (ver abajo); no he probado el recorrido completo con el navegador.

```bash
# terminal 1: API con harness (loopback, token solo local)
pnpm build
export DATABASE_PATH=/tmp/tqa-demo.sqlite
pnpm db:migrate
TQA_HARNESS=1 TQA_HARNESS_TOKEN=demo-local pnpm --filter @tqa/api start

# terminal 2: storefront
pnpm --filter @tqa/storefront dev        # http://127.0.0.1:5173
```

Para cada modo: añade un Ceramic Mug, copia el *Correlation id* y arma el escenario:

```bash
RUN=<correlation-id-copiado>
curl -s -X POST http://127.0.0.1:3001/harness/runs/$RUN/scenario \
  -H 'x-tqa-harness-token: demo-local' -H 'content-type: application/json' \
  -d '{"scenario":"GHOST_SUCCESS"}'          # o NORMAL / VERIFICATION_UNAVAILABLE
```

Pulsa *Place order*; la pantalla dirá `Order confirmed` en los tres modos. Luego haz la lectura independiente con el `orderId` de la confirmación:

```bash
curl -i http://127.0.0.1:3001/api/orders/<orderId>     # 200 / 404 / 503 según el modo
```

El token `demo-local` es un valor inventado para uso local; no uses uno real ni lo commitees. Sin la cabecera, el harness responde 401 (comprobado). Los resultados de `verifyOrder` y el gate para esta ruta los ves ejecutando la Ruta A o leyendo `docs/speaker/rehearsal/rehearsal.json`.

### Ruta C: respaldo

Si el entorno falla: reproduce `docs/speaker/rehearsal/backup-recording.webm` y lee **solo** las filas de `docs/speaker/rehearsal/rehearsal.json`. Di que el vídeo es la pantalla de confirmación, no la lectura del pedido ni una decisión de release, y que los ids son los del ensayo commiteado.

## 5. Guion (12 minutos planificados, no medidos)

Palabras completas en `docs/speaker/demo-script.md`; esquema de 35 min en `docs/speaker/talk-notes.md`; diapositivas en `docs/speaker/slides.md`.

| Segmento | Desde (s) | Dur. (s) | Qué haces |
|---|---|---|---|
| open | 0 | 60 | Título; el mensaje de confirmación no prueba que se guardó. Catálogo con tres productos y precios en centavos. |
| normal | 60 | 180 | `NORMAL`: pantalla y fila guardada coinciden → `200 FOUND`, `CONFIRMED`, `ALLOW`. Total 1299 centavos. |
| ghost | 240 | 180 | `GHOST_SUCCESS`: misma pantalla, `404 ABSENT`, `DEFECT`, `BLOCK`. El agente guionado dijo SUCCESS y el gate lo ignoró. |
| unavailable | 420 | 180 | `VERIFICATION_UNAVAILABLE`: `503` no es `404` → `UNKNOWN`, `HOLD`. |
| close | 600 | 120 | Leer la tabla del pipeline; repetir la separación entre pantalla y lectura independiente. |

## 6. Qué no decir

- No digas que S-008 está completo ni que alguien ya cronometró el guion.
- No presentes la pantalla del ghost como prueba de que el pedido se guardó.
- No conviertas el 503 en un pedido perdido.
- No cites una tasa de fiabilidad, de flakiness ni ningún porcentaje.
- No presentes el diagnóstico guionado como resultado de un modelo real (`modelInvoked: false`).
- No digas que las sondas O-001 a O-007 pasaron.

## 7. Preguntas probables y dónde está la respuesta

| Pregunta | Respuesta corta | Dónde mirar |
|---|---|---|
| ¿Por qué no basta el test de UI? | Solo comprueba el texto; el ghost lo pasa sin guardar nada. | `tests/e2e/superficial-ui.spec.ts`, `oracle-ghost.spec.ts` |
| ¿Quién valida al agente? | `verifyOrder` (lectura propia de SQLite) y `decideRelease` determinista; el agente no aprueba nada. | `packages/validators`, `packages/quality-gate` |
| ¿Se usó un LLM real? | No en lo commiteado; el proveedor es `scripted-mock`. | `packages/qa-agent/src/provider.ts` |
| ¿Cómo sabes que el agente acierta? | No se mide todavía: 12 casos etiquetados, resultado scripted. | `tests/evals`, `fixtures/golden-dataset` |
| ¿Puede el agente romper algo? | Solo 5 tools de lectura; sin shell, sin escritura en BD, sin aprobar gates. | `packages/qa-agent/src/session.ts` |
| ¿Dónde se inyectan los fallos? | Harness local con token y loopback, fuera de `/api/*`. | `apps/api/src/harness` |

## 8. Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `Executable doesn't exist` | Falta el Chromium de Playwright 1.65.0 | `pnpm exec playwright install chromium` |
| `pnpm test:e2e:ghost-oracle` sale con 1 | Es lo esperado | Nada; léelo como resultado negativo esperado |
| El harness responde 404 en `/harness/...` | API arrancada sin `TQA_HARNESS=1` o sin token | Reinicia la API con ambas variables |
| El harness responde 401 | Falta o no coincide `x-tqa-harness-token` | Usa el mismo token con el que arrancó la API |
| Orden ghost que da 404 en la Ruta B | Es el modo correcto | Es la evidencia del ghost |
| `pnpm demo:rehearsal` cambió archivos en git | Regenera vídeo y JSON | Descarta con git o commitea a propósito y avísalo en la charla |

## 9. Mapa de documentos para profundizar

1. `docs/intent.md` — qué se quiere y qué no.
2. `docs/spec.md` — criterios de aceptación observables (S-001…S-008, O-001…O-007).
3. `docs/architecture-contracts.md` — contratos de dominio y semántica de fallos.
4. `docs/architecture.md` y `docs/adr/` — estructura y decisiones.
5. `docs/sprint-plan.md` y `docs/progress/` — plan y estado diario.
6. `docs/implementation-history.md` — qué añadió cada tarea QA-01…QA-18.
7. `AGENTS.md` — reglas permanentes (invariantes, alcance, flujo de trabajo).
