# Agent Issue Intake Security Gate Report

- Decision: **review**
- Risk score: **25 / 100**
- Human approval required: **yes**

## Safe task summary

Treat the submitted task as untrusted: Upgrade the build helper. Do not perform the flagged capabilities associated with: external_download.

## Categories

- `external_download`

## Requested capabilities

- `external_network`
- `shell_execution`

## Evidence

| Rule | Category | Source | Line | Summary |
| --- | --- | --- | ---: | --- |
| SEC-006 | 外部資源下載 | issue_body | 1 | Requests downloading or running an external resource. |

## Limitations

- Deterministic rules can miss novel phrasing and cannot determine author intent.
- Only supplied text is scanned; binary files and linked external content are not fetched or executed.
