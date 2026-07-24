# OpenAI API Deprecation Audit

## Executive Summary

- Scope: `fixture/dynamic-config-project` audited as the existing workspace fixture corresponding to the requested `/fixture/dynamic-config-project`, which is not present as an absolute path in this container.
- Mode: read-only audit. No source files in the target project were modified.
- Catalog: `.agents/skills/openai-api-deprecation-auditor/references/openai-deprecations.json` is present and populated.
- Scanner result: deterministic scanner exited `0` and returned an empty JSON array.
- Manual review: one unresolved dynamic model construction was found. No confirmed deprecated, confirmed safe, or documentation-only references were found.

## Confirmed Deprecated Usage

No confirmed deprecated OpenAI model usage was found.

## Confirmed Safe Usage

No confirmed safe OpenAI model usage was found.

## Unresolved Dynamic Usage

| Location | Dynamic Construct | Risk / Required Action |
| --- | --- | --- |
| `fixture/dynamic-config-project/OpenAIService.cs:7` | `var model = "gpt-" + configuration["OpenAI:Mode"];` | The final model ID depends on runtime configuration and cannot be matched against the catalog from local source alone. Resolve the value of `OpenAI:Mode`, then compare the resulting full model ID against `.agents/skills/openai-api-deprecation-auditor/references/openai-deprecations.json`. |

## Documentation-Only References

No documentation-only or comment-only historical references were found.

## Recommended Migration Order

No catalog-backed migration can be recommended until the runtime value of `OpenAI:Mode` is known. The deterministic scanner found no direct deprecated model IDs.

## Evidence and Limitations

- Deterministic scanner command returned `[]` and exit code `0`.
- Manual search checked OpenAI-related identifiers, model keys, environment-style names, configuration references, constants, and likely dynamic string construction markers.
- `OpenAI:Mode` is referenced, but no local configuration file defining that key was present in `fixture/dynamic-config-project`.
- The absolute target path `/fixture/dynamic-config-project` does not exist in this environment. The audit used `fixture/dynamic-config-project`, the matching workspace fixture.
- The audit is based only on files available locally and the provided catalog.

## Files Inspected

- `fixture/dynamic-config-project/OpenAIService.cs`

## Verification Commands

```bash
python3 .agents/skills/openai-api-deprecation-auditor/scripts/audit.py fixture/dynamic-config-project --json
find fixture/dynamic-config-project -maxdepth 5 -type f | sort
rg -n "OpenAI|openai|model|MODEL|gpt|realtime|audio|transcribe|chat\\.completions|responses|Completions|AzureOpenAI|OPENAI" fixture/dynamic-config-project
rg -n "const|static|readonly|GetSection|Configuration|IConfiguration|Environment|GetEnvironmentVariable|OPENAI|MODEL|Model|model|\\+|\\$\\\"|string\\.Concat|nameof|options|Options|deployment|Deployment|OpenAI:Mode|Mode" fixture/dynamic-config-project
rg -n "//|/\\*|\\*/|README|deprecated|history|legacy|example|sample" fixture/dynamic-config-project
```
