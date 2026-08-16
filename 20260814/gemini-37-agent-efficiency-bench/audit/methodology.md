# Public audit methodology

## Purpose and scope

This directory provides a minimal, de-identified evidence chain for the 12 formal runs. It permits a reviewer to verify experiment registration, paired inputs, run outcomes, artifact integrity, and stated limitations without publishing task text, source code, raw model output, or workspace metadata.

The full artifact set remains private. A reviewer with approved private access can recompute every public digest against the retained artifact set.

## What was locked before formal runs

`public-audit.json.locked_experiment` records the private benchmark-definition commit and SHA-256 fingerprints for the task registry, ground truth, run configuration, common tool policy, and runner source tree. The commit object and full definitions remain in the retained private artifact set; its published hash is an audit reference, not a claim that the object is publicly resolvable. The registration record states a 1,200,000 ms timeout and no formal-run retry or rescue run.

For each task, both cells share the same `prompt_sha256` and `source_tree_start_sha256`. The initial source-tree fingerprint is the SHA-256 of the private baseline snapshot. The final source-tree fingerprint is computed from the agent workspace after evaluation.

Agent worktrees were deliberately left uncommitted, so a made-up “final Git commit SHA” would be misleading. The audit therefore publishes deterministic source-tree SHA-256 fingerprints instead. These are stronger evidence of working-tree content for this setup and do not expose paths or source text.

## Source-tree fingerprint algorithm

For a repository state, recursively enumerate files in lexicographic relative-path order. For every included file, append `relative_path`, a NUL byte, and its file SHA-256; join records with a newline and SHA-256 that byte sequence. Exclude `.git`, `.codex`, `.dotnet-home`, `.nuget`, `node_modules`, `dist`, `bin`, `obj`, and `TestResults`.

The private baseline snapshot is a relative-path-to-file-hash map. Its file SHA-256 is the public `source_tree_start_sha256` value.

## Artifact integrity

Each public run record is a de-identified manifest. It includes SHA-256 fingerprints for the private manifest, final diff, final test output, event log, and a raw-log bundle.

`raw_logs_bundle` is SHA-256 of the compact JSON object `{ "stdout": <SHA-256(raw stdout)>, "stderr": <SHA-256(raw stderr)> }`, with keys in that order and no added whitespace. This lets a private reviewer validate both raw streams without publishing either stream.

`gate_result_sha256` is SHA-256 of the private ordered list of `{name, passed}` gate outcomes. Public semantic gate identifiers are only shown when a failure occurred.

## Result semantics

`task_passed` requires every pre-registered Gate. `final_tests_passed` and `final_verification_observed` only establish final functional behavior and post-edit verification; they do not override a failed process Gate.

Both cells therefore report 5/6 task passes and 6/6 final functional verifications. The only exception is TASK-006: the required pre-fix execution of the registered reproduction command was not observed, so `agent_failure_then_pass_required` remains failed even though final tests and integration verification passed.

## Fairness and interpretation

The run registry records identical paired prompt fingerprints, task-definition commit, start source-tree fingerprints, timeout policy, and evaluator configuration. Model identities were selected before execution; this was not a double-blind study. The A/B mapping was disclosed after all formal runs and evaluation had completed.

This is a comparison of model-plus-harness pairs. Provider-native event formats differ, so tool-call counts are traceability signals, not a pure model-only efficiency score. Elapsed time is local runner wall-clock duration; provider queue and serving latency were not separately observable. No provider cost was measured, so no cost conclusion is made. Provider rate-limit behavior is also not separately observable.

One Cell B integration-debug trace wrote a task-related temporary diagnostic file outside its workspace. It did not access credentials or another repository, but the deviation is disclosed and should not be read as full proof of strict workspace confinement.

## Privacy boundary

The public bundle has no absolute paths, account identifiers, repository URLs, source contents, prompts, raw tool payloads, or workspace Git metadata. A credential-pattern scan is required before publication. Private artifacts are retained only for controlled audit access.
