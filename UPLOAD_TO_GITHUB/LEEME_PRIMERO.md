# Carga en GitHub desde navegador — sin carpetas ocultas

El directorio `UPLOAD_TO_GITHUB` **no tiene carpetas ni archivos que empiecen por punto**. Se creó a partir del Cloud Starter v1.3 y contiene todas las skills originales.

1. Extrae el ZIP en tu equipo o celular. En GitHub, cambia a una rama `feature/bootstrap-context` (no a `main`).
2. Abre **Add file → Upload files** y ARRASTRA la carpeta `UPLOAD_TO_GITHUB` completa. Si tu dispositivo no permite arrastrar carpetas, usa GitHub en escritorio o `github.dev` para subir/copiar los archivos. **No subas el ZIP como un solo archivo**, porque GitHub no lo descomprime.
3. Haz commit en la rama y abre Cursor Cloud seleccionando esa rama.
4. En Cursor, pide ejecutar en el entorno remoto:

   `python3 UPLOAD_TO_GITHUB/install_into_repo.py --verify-only`

   y, si no hay conflictos:

   `python3 UPLOAD_TO_GITHUB/install_into_repo.py`

5. Comprueba que existen `.claude/skills/`, `.cursor/rules/`, `.github/` y los documentos.
6. Pide a Cursor eliminar `UPLOAD_TO_GITHUB` DESPUÉS de confirmar la instalación; que ejecute `git status` y abra un PR para integrar la rama.

El script **no sobrescribe archivos existentes diferentes**: se detiene para revisión. No modifica `main`, no realiza commits ni borra el directorio de carga.

## Prompt para Cursor

```text
The repository contains UPLOAD_TO_GITHUB staging files for the Trustworthy QA Agent Cloud Starter v1.3.
Work ONLY on feature/bootstrap-context, never directly on main.
Inspect LEEME_PRIMERO.md, manifest.json and install_into_repo.py.
Verify the checksums and destinations. Run the installer with --verify-only first, then run it without flags only if there are no conflicts.
Confirm these files exist: AGENTS.md, CLAUDE.md, .claude/skills/*/SKILL.md (four skills), .cursor/rules/tqa-repo.mdc, .github/pull_request_template.md, docs/spec.md.
Do not overwrite conflicts; report them.
After confirming content, remove UPLOAD_TO_GITHUB staging, run git status and create a PR to main for manual review.
Do not implement application code yet. Do not merge the PR.
```
