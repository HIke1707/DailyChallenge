# MCP Stateless Compatibility Lab：Protocol Contract

## 文件目的

本文件定義本實驗要驗證的新版與舊版 MCP 行為差異。

本實驗的目標是驗證 Stateless Core 與 Request-scoped State 的相容性行為，
不是宣稱目前的 Release Candidate 或 Preview SDK 已達正式生產環境成熟度。

## 五項協定差異

| 項目 | 舊版行為（Legacy Era） | 新版預期（Modern Era） | 本實驗的驗證方式 |
|---|---|---|---|
| 起始流程 | 透過 `initialize` 建立連線與能力協商 | 使用 `server/discover` 或已知能力資訊，不依賴傳統初始化 Session | 執行 Server Discovery，確認不需先建立持久 Session |
| Session | 協定層可能維護持久 Session | Stateless；每個請求可獨立處理 | 發送兩個獨立請求，確認 Request ID 與狀態不共用 |
| Header | 可能依賴 `Mcp-Session-Id` | 不應依賴 `Mcp-Session-Id` | 記錄請求與回應是否出現 Session Header |
| Protocol Version | 在初始化流程中協商 | 每次請求透過 Metadata／`_meta` 傳遞相關資訊 | Protocol Probe 記錄 Protocol Version 與請求 Metadata |
| Request State | 狀態可能綁定在 Session | 狀態應限制在單一 Request 範圍 | 執行隔離測試與 10 個並行請求測試 |

## 測試需求對應

| 測試案例 | 對應契約項目 | 通過條件 |
|---|---|---|
| 正常 Tool Call | 起始流程、Protocol Version | `add(14, 28)` 成功回傳 `42` |
| Request State 隔離 | Session、Request State | 兩次獨立請求的 Request ID 不同，且 Count 都是 `1` |
| 10 個並行請求 | Session、Request State | 10 個唯一 Request ID；每個 Count 都是 `1` |
| 協定污染風險 | 起始流程、Header、Protocol Version | Legacy 策略明確；不混用新版欄位與舊版流程 |

## 本實驗的明確限制

- MCP 2026-07-28 規格尚未正式發布時，測試結果只代表當下採用的 SDK／RC／Preview 行為。
- 若官方 SDK 無法安裝，備援實驗只能驗證 HTTP JSON-RPC Envelope 與 Stateless 行為，不能稱為官方 SDK 整合測試。
- 最終報告不得使用 `PRODUCTION_READY` 作為結論。

## 預定結論值

最終相容性報告只能使用以下其中一個結論：

- `PASS_FOR_EXPERIMENT`
- `PASS_WITH_LIMITATIONS`
- `FAIL`
