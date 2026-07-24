# OpenAI API Deprecation Audit

## Executive Summary

- Scope: `fixture/clean-project` audited as the existing workspace fixture.
- Mode: read-only audit. No source files in the target project were modified.
- Catalog: `.agents/skills/openai-api-deprecation-auditor/references/openai-deprecations.json` is present and populated.
- Scanner result: deterministic scanner exited `0` and returned an empty JSON array across `.cs`, `.json`, `.yaml`, `.env.example`, and `.ts` files.
- Manual review: no deprecated, unresolved dynamic, wrapper-indirect, or documentation-only model references were found.

## Confirmed Deprecated Usage

No confirmed deprecated OpenAI model usage was found.

## Confirmed Safe Usage

| Location | Model | Basis |
| --- | --- | --- |
| `fixture/clean-project/appsettings.json:3` | `gpt-realtime-2.1` | Listed as `recommended_replacement` in `openai-deprecations.json`. |
| `fixture/clean-project/appsettings.json:4` | `gpt-audio-1.5` | Listed as `recommended_replacement` in `openai-deprecations.json`. |
| `fixture/clean-project/service.ts:2` | `gpt-audio-1.5` | Listed as `recommended_replacement` in `openai-deprecations.json`. |
| `fixture/clean-project/config.yaml:2` | `gpt-realtime-2.1-mini` | Listed as `recommended_replacement` in `openai-deprecations.json`. |
| `fixture/clean-project/.env.example:2` | `gpt-4o-mini-transcribe-2025-12-15` | Listed as `recommended_replacement` in `openai-deprecations.json`. |

## Unresolved Dynamic Usage

No unresolved dynamic model construction was found.

## Documentation-Only References

No documentation-only or comment-only historical references were found.

## Recommended Migration Order

No migration is recommended for this project based on the provided deprecation catalog.

## Evidence and Limitations

- Deterministic scanner command returned `[]` and exit code `0`.
- Ignored directories (`bin/`, `obj/`, `.git`, `node_modules`, `__pycache__`, `.venv`, `venv`) were excluded from scanning.
- File read errors (if any) are logged to stderr and captured as `type: 'read_error'` findings.
- The audit is based only on files available locally and the provided catalog.

## Files Inspected

- `fixture/clean-project/appsettings.json`
- `fixture/clean-project/service.ts`
- `fixture/clean-project/config.yaml`
- `fixture/clean-project/.env.example`

## Verification Commands

```bash
python3 .agents/skills/openai-api-deprecation-auditor/scripts/audit.py 20260724/fixture/clean-project --json
find 20260724/fixture/clean-project -maxdepth 4 -type f | sort
```
