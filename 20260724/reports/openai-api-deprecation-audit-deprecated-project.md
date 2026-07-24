# OpenAI API Deprecation Audit

## Executive Summary

- Scope: `fixture/deprecated-project` audited as the existing workspace fixture.
- Mode: read-only audit. No source files in the target project were modified.
- Catalog: `.agents/skills/openai-api-deprecation-auditor/references/openai-deprecations.json` is present and populated.
- Catalog Version: `2026.07.24` (Checked At: `2026-07-24`)
- Catalog Coverage Statement: 本稽核僅涵蓋記錄於此 Catalog 內之 OpenAI API 棄用模型及項目，未包含於本 Catalog 內之模型不在此自動稽核判定範圍內。
- Scanner result: deterministic scanner exited `0` and returned 6 confirmed deprecated model usages across `.cs`, `.json`, `.yaml`, `.env`, and `.ts` files. Directories `bin/` and `obj/` were automatically excluded.
- Manual review: no unresolved dynamic model construction, wrapper indirection, or documentation-only historical references were found.

## Confirmed Deprecated Usage

| Location | Deprecated Model | Announced Date | Shutdown Date | Risk Level | Recommended Replacement | Requires Manual Verification | Confidence | Source Snippet |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fixture/deprecated-project/OpenAIService.cs:5` | `gpt-4o-audio` | `2025-01-20` | `2027-01-20` | `High` | `gpt-audio-1.5` | `false` | `High` | `private const string AudioModel = "gpt-4o-audio";` |
| `fixture/deprecated-project/appsettings.json:3` | `gpt-realtime` | `2025-01-20` | `2027-01-20` | `High` | `gpt-realtime-2.1` | `false` | `High` | `"RealtimeModel": "gpt-realtime",` |
| `fixture/deprecated-project/appsettings.json:4` | `gpt-4o-mini-transcribe-2025-03-20` | `2025-03-20` | `2027-01-20` | `High` | `gpt-4o-mini-transcribe-2025-12-15` | `false` | `High` | `"TranscriptionModel": "gpt-4o-mini-transcribe-2025-03-20"` |
| `fixture/deprecated-project/config.yaml:2` | `gpt-realtime-mini` | `2025-01-20` | `2027-01-20` | `High` | `gpt-realtime-2.1-mini` | `false` | `High` | `model: "gpt-realtime-mini"` |
| `fixture/deprecated-project/.env:2` | `gpt-4o-realtime` | `2025-01-20` | `2027-01-20` | `High` | `gpt-realtime-2.1` | `false` | `High` | `OPENAI_MODEL=gpt-4o-realtime` |
| `fixture/deprecated-project/service.ts:2` | `gpt-audio` | `2025-01-20` | `2027-01-20` | `High` | `gpt-audio-1.5` | `false` | `High` | `private readonly model: string = "gpt-audio";` |

## Confirmed Safe Usage

No confirmed safe OpenAI model usages were found in the audited project.

## Unresolved Dynamic Usage

No unresolved dynamic model construction was found.

## Documentation-Only References

No documentation-only or comment-only historical references were found.

## Recommended Migration Order

1. Replace `gpt-4o-audio` in `fixture/deprecated-project/OpenAIService.cs:5` with `gpt-audio-1.5`.
2. Replace `gpt-realtime` in `fixture/deprecated-project/appsettings.json:3` with `gpt-realtime-2.1`.
3. Replace `gpt-4o-mini-transcribe-2025-03-20` in `fixture/deprecated-project/appsettings.json:4` with `gpt-4o-mini-transcribe-2025-12-15`.
4. Replace `gpt-realtime-mini` in `fixture/deprecated-project/config.yaml:2` with `gpt-realtime-2.1-mini`.
5. Replace `gpt-4o-realtime` in `fixture/deprecated-project/.env:2` with `gpt-realtime-2.1`.
6. Replace `gpt-audio` in `fixture/deprecated-project/service.ts:2` with `gpt-audio-1.5`.

These replacements are limited to the provided deprecation catalog. No model names or migration steps were inferred outside the catalog.

## Evidence and Limitations

- Deterministic scanner command returned JSON with 6 findings and exit code `0`.
- Ignored directories (`bin/`, `obj/`, `.git`, `node_modules`, `__pycache__`, `.venv`, `venv`) were excluded from scanning.
- File read errors (if any) are logged to stderr and captured as `type: 'read_error'` findings.
- The audit is based only on files available locally and the provided catalog.

## Files Inspected

- `fixture/deprecated-project/OpenAIService.cs`
- `fixture/deprecated-project/appsettings.json`
- `fixture/deprecated-project/config.yaml`
- `fixture/deprecated-project/.env`
- `fixture/deprecated-project/service.ts`
- Ignored: `fixture/deprecated-project/bin/app.cs`, `fixture/deprecated-project/obj/app.cs`

## Verification Commands

```bash
python3 .agents/skills/openai-api-deprecation-auditor/scripts/audit.py 20260724/fixture/deprecated-project --json
find 20260724/fixture/deprecated-project -maxdepth 4 -type f | sort
```
