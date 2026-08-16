# Routing policy for measured task classes

## Status

Policy version: `1.0`
Evidence source: the 12-run public audit bundle
Scope: only the six measured task classes; not a general model leaderboard.

## Routes

| Work class | Default route | Mandatory control |
|---|---|---|
| Local, well-specified bug repair | Gemini 3.7 Flash High candidate | Deterministic final test and evaluator Gate |
| Cross-stack contract or UI change | Gemini 3.7 Flash High candidate | Backend tests, frontend tests, build, and final verification |
| Production repair with an existing failing test | Gemini 3.7 Flash High candidate | Protected-test integrity check and hidden behavior Gate |
| Missing product or domain requirement | Human-needed | Clarify the requirement; no invented policy or code change |
| Untrusted instructions or material security blast radius | Strong-first or human review | Protected files, explicit scope, and independent final validation |
| Multi-step integration debugging | Strong-first or human review | Run the registered reproduction command before editing, then rerun it after the fix |

## Operational rules

1. A route recommendation never replaces deterministic validation. A failed required Gate is a failed task even when final functionality appears correct.
2. Escalate immediately when the specification is incomplete, a task touches protected or security-sensitive behavior, a command requires credentials, or the agent seeks filesystem access beyond the approved workspace.
3. Do not infer provider cost from token counts. Cost remains unknown until provider-measured pricing is captured.
4. Compare elapsed time as model-plus-harness telemetry only. Do not use native tool-call counts as proof that one model intrinsically reasons more efficiently.
5. Re-run this benchmark before expanding the Flash-first route to a new language, repository topology, privileged environment, or materially higher blast radius.

## Current decision

Gemini 3.7 Flash High meets the admission threshold for the controlled, low-risk classes above when every listed Gate is available. GPT-5.6 Luna xhigh remains the current default efficiency baseline for this environment because the measured wall-clock result was faster, while the experiment does not establish a model-only causal advantage.
