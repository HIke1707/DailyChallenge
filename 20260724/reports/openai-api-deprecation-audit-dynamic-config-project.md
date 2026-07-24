# OpenAI API Deprecation Audit

## Executive Summary

- Scope: `fixture/dynamic-config-project` audited as the existing workspace fixture.
- Mode: read-only audit. No source files in the target project were modified.
- Catalog: `.agents/skills/openai-api-deprecation-auditor/references/openai-deprecations.json` is present and populated.
- Catalog Version: `2026.07.24` (Checked At: `2026-07-24`)
- Catalog Coverage Statement: 本稽核僅涵蓋記錄於此 Catalog 內之 OpenAI API 棄用模型及項目，未包含於本 Catalog 內之模型不在此自動稽核判定範圍內。
- Scanner result: deterministic scanner exited `0` and returned an empty JSON array.
- Manual review: one unresolved dynamic model construction was found. No confirmed deprecated, confirmed safe, or documentation-only references were found.

## Confirmed Deprecated Usage

No confirmed deprecated OpenAI model usage was found.

## Confirmed Safe Usage

No confirmed safe OpenAI model usage was found.

## Unresolved Dynamic Usage

| Location | Dynamic Construct | Risk / Required Action | Requires Manual Verification | Confidence |
| --- | --- | --- | --- | --- |
| `fixture/dynamic-config-project/OpenAIService.cs:7` | `var model = "gpt-" + configuration["OpenAI:Mode"];` | The final model ID depends on runtime configuration and cannot be matched against the catalog from local source alone. Resolve `OpenAI:Mode`, then compare against catalog. | `true` | `Medium` |

## Documentation-Only References

No documentation-only or comment-only historical references were found.

## Recommended Migration Order

No catalog-backed migration can be recommended until the runtime value of `OpenAI:Mode` is known. The deterministic scanner found no direct deprecated model IDs.

## Evidence and Limitations

- Deterministic scanner command returned `[]` and exit code `0`.
- Manual search checked OpenAI-related identifiers, model keys, environment-style names, configuration references, constants, and likely dynamic string construction markers.
- `OpenAI:Mode` is referenced, but no local configuration file defining that key was present in `fixture/dynamic-config-project`.
- The audit is based only on files available locally and the provided catalog.

## Files Inspected

- `fixture/dynamic-config-project/OpenAIService.cs`

## Verification Commands

```bash
python3 .agents/skills/openai-api-deprecation-auditor/scripts/audit.py 20260724/fixture/dynamic-config-project --json
find 20260724/fixture/dynamic-config-project -maxdepth 5 -type f | sort
```
