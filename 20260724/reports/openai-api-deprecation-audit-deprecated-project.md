# OpenAI API Deprecation Audit

## Executive Summary

- Scope: `fixture/deprecated-project` audited as the existing workspace fixture corresponding to the requested `/fixture/deprecated-project`, which is not present as an absolute path in this container.
- Mode: read-only audit. No source files in the target project were modified.
- Catalog: `.agents/skills/openai-api-deprecation-auditor/references/openai-deprecations.json` is present and populated.
- Scanner result: deterministic scanner exited `0` and returned 3 confirmed deprecated model usages.
- Manual review: no unresolved dynamic model construction, wrapper indirection, or documentation-only historical references were found.

## Confirmed Deprecated Usage

| Location | Deprecated Model | Shutdown Date | Recommended Replacement | Source Snippet |
| --- | --- | --- | --- | --- |
| `fixture/deprecated-project/OpenAIService.cs:5` | `gpt-4o-audio` | `2027-01-20` | `gpt-audio-1.5` | `private const string AudioModel = "gpt-4o-audio";` |
| `fixture/deprecated-project/appsettings.json:3` | `gpt-realtime` | `2027-01-20` | `gpt-realtime-2.1` | `"RealtimeModel": "gpt-realtime",` |
| `fixture/deprecated-project/appsettings.json:4` | `gpt-4o-mini-transcribe-2025-03-20` | `2027-01-20` | `gpt-4o-mini-transcribe-2025-12-15` | `"TranscriptionModel": "gpt-4o-mini-transcribe-2025-03-20"` |

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

These replacements are limited to the provided deprecation catalog. No model names or migration steps were inferred outside the catalog.

## Evidence and Limitations

- Deterministic scanner command returned JSON with 3 findings and exit code `0`.
- Manual search checked OpenAI-related identifiers, model keys, environment-style names, configuration references, constants, and likely dynamic string construction markers.
- The absolute target path `/fixture/deprecated-project` does not exist in this environment. The audit used `fixture/deprecated-project`, the matching workspace fixture.
- The audit is based only on files available locally and the provided catalog.

## Files Inspected

- `fixture/deprecated-project/OpenAIService.cs`
- `fixture/deprecated-project/appsettings.json`

## Verification Commands

```bash
python3 .agents/skills/openai-api-deprecation-auditor/scripts/audit.py fixture/deprecated-project --json
find fixture/deprecated-project -maxdepth 4 -type f | sort
rg -n "OpenAI|openai|model|MODEL|gpt|realtime|audio|transcribe|chat\\.completions|responses|Completions|AzureOpenAI|OPENAI" fixture/deprecated-project
rg -n "const|static|readonly|GetSection|Configuration|IConfiguration|Environment|GetEnvironmentVariable|OPENAI|MODEL|Model|model|\\+|\\$\\\"|string\\.Concat|nameof|options|Options|deployment|Deployment" fixture/deprecated-project
rg -n "//|/\\*|\\*/|README|deprecated|history|legacy|example|sample" fixture/deprecated-project
```
