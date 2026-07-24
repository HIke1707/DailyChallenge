# OpenAI API Deprecation Audit

## Executive Summary

- Scope: `fixture/clean-project` audited as the existing workspace fixture corresponding to the requested `/fixture/clean-project`, which is not present as an absolute path in this container.
- Mode: read-only audit. No source files in the target project were modified.
- Catalog: `.agents/skills/openai-api-deprecation-auditor/references/openai-deprecations.json` is present and populated.
- Scanner result: deterministic scanner exited `0` and returned an empty JSON array.
- Manual review: no deprecated, unresolved dynamic, wrapper-indirect, or documentation-only model references were found.

## Confirmed Deprecated Usage

No confirmed deprecated OpenAI model usage was found.

## Confirmed Safe Usage

| Location | Model | Basis |
| --- | --- | --- |
| `fixture/clean-project/appsettings.json:3` | `gpt-realtime-2.1` | Present as a recommended replacement in the catalog and not listed as deprecated. |
| `fixture/clean-project/appsettings.json:4` | `gpt-audio-1.5` | Present as a recommended replacement in the catalog and not listed as deprecated. |

## Unresolved Dynamic Usage

No unresolved dynamic model construction was found.

## Documentation-Only References

No documentation-only or comment-only historical references were found.

## Recommended Migration Order

No migration is recommended for this project based on the provided deprecation catalog.

## Evidence and Limitations

- Deterministic scanner command returned `[]` and exit code `0`.
- Manual search checked OpenAI-related identifiers, model keys, environment-style names, configuration references, constants, and likely dynamic string construction markers.
- The absolute target path `/fixture/clean-project` does not exist in this environment. The audit used `fixture/clean-project`, the matching workspace fixture.
- The audit is based only on files available locally and the provided catalog.

## Files Inspected

- `fixture/clean-project/appsettings.json`

## Verification Commands

```bash
python3 .agents/skills/openai-api-deprecation-auditor/scripts/audit.py fixture/clean-project --json
find fixture/clean-project -maxdepth 4 -type f | sort
rg -n "OpenAI|openai|model|MODEL|gpt|realtime|audio|transcribe|chat\\.completions|responses|Completions|AzureOpenAI|OPENAI" fixture/clean-project
rg -n "const|static|readonly|GetSection|Configuration|IConfiguration|Environment|GetEnvironmentVariable|OPENAI|MODEL|Model|model|\\+|\\$\\\"|string\\.Concat|nameof|options|Options|deployment|Deployment" fixture/clean-project
rg -n "//|/\\*|\\*/|README|deprecated|history|legacy|example|sample" fixture/clean-project
```
