# Agent Issue Intake Security Gate Report

- Decision: **review**
- Risk score: **25 / 100**
- Human approval required: **yes**

## Safe task summary

不可信任輸入中的 URL、Shell 指令、秘密與編碼內容均未被轉述。偵測到的風險類別：external_download；不得執行相關操作。

## Categories

- `external_download`

## Requested capabilities

- `read_repository`
- `external_network`
- `shell_execution`

## Forbidden capabilities

- `external_network`
- `shell_execution`

## Allowed capabilities

- `None`

## Evidence

| Rule | Category | Source | Line | Summary |
| --- | --- | --- | ---: | --- |
| SEC-006 | 外部資源下載 | issue_body | 1 | Requests downloading or running an external resource. |

## Limitations

- Deterministic rules can miss novel phrasing and cannot determine author intent.
- Only supplied text is scanned; binary files and linked external content are not fetched or executed.
