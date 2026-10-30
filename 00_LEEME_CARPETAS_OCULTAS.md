# VERIFICACIÓN DEL PAQUETE — Trustworthy QA Agent v1.3

Este ZIP incluye `.claude/`, `.cursor/` y `.github/`, carpetas que pueden estar **ocultas** por empezar con punto.

## Skills incluidas (4)

- `.claude/skills/frontend-react-engineering/SKILL.md`
- `.claude/skills/backend-typescript-engineering/SKILL.md`
- `.claude/skills/playwright-sdet-engineering/SKILL.md`
- `.claude/skills/trustworthy-ai-engineering/SKILL.md`

## Configuración de Cursor

- `.cursor/rules/tqa-repo.mdc`

## Mostrar carpetas ocultas

- **macOS / Finder:** `Command + Shift + .`
- **Windows:** Explorador de archivos > Ver > Mostrar > Elementos ocultos.
- **Samsung / Android:** Mis archivos > Ajustes > activar *Mostrar archivos ocultos* (el nombre puede variar según la versión).

## GitHub

Al extraer, copia **el contenido del ZIP a la raíz del repositorio**, conservando las rutas anteriores. GitHub no descomprime ZIP automáticamente. Crea una rama `feature/bootstrap-context` y abre un PR contra `main`.

Si tu extractor descarta las carpetas ocultas, usa otro extractor o crea los archivos directamente en GitHub mediante *Add file > Create new file*, escribiendo la ruta completa, por ejemplo `.claude/skills/frontend-react-engineering/SKILL.md`, y copiando el contenido del archivo correspondiente.

Este paquete contiene instrucciones y specs, **no incluye una app ya implementada**.
