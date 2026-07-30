# Stateless MCP Workspace Server

2026-07-29 的 .NET MCP 協定實驗。MCP Server 使用 `2026-07-28` 的 Stateless HTTP 模式；跨工具呼叫的應用程式狀態必須透過 `workspace_id` 顯式傳遞，而非 MCP Session。

## Environment baseline

- OS: macOS (Darwin)
- .NET SDK: 10.0.201
- MCP SDK: `ModelContextProtocol.AspNetCore` 2.0.0
- MCP Client: official C# SDK Test Client (`ModelContextProtocol` 2.0.0)

## Current progress

已完成：Solution、thread-safe in-memory workspace store、Store 單元測試，以及 Stateless MCP HTTP endpoint `http://127.0.0.1:5050/mcp`。

已完成四個 MCP Tools：

- `create_workspace(name)`
- `add_work_item(workspace_id, title)`
- `list_work_items(workspace_id)`
- `complete_work_item(workspace_id, work_item_id)`

每個需要 Workspace 的 Tool 都要求 Client 使用 `create_workspace` 實際回傳的 `workspace_id`；找不到或格式錯誤的 Handle 會回傳 MCP `isError: true` 與可機器讀取的 `code`/`message`，不會猜測最近使用的 Workspace。

已完成 HTTP 整合測試：測試在記憶體中啟動真實 `/mcp` endpoint，並覆蓋 Tool Schema、完整流程、Workspace 隔離、錯誤 Handle 與 `2026-07-28` discovery。詳見 [docs/test-results.md](docs/test-results.md)。

已完成正式 Client workflow：在沒有 Copilot/Claude/Cursor 本機 Client 的環境中，使用官方 C# SDK Test Client 連到 loopback Server。完整 Tool Call/Result 記錄在 [evidence/sdk-client-workflow.json](evidence/sdk-client-workflow.json)。

架構與協定差異說明見：[docs/architecture.md](docs/architecture.md) 與 [docs/protocol-comparison.md](docs/protocol-comparison.md)。

尚未完成：依作業格式補齊三張人工截圖。

## Run the Server

```bash
dotnet run --project src/StatelessWorkspaceMcp --urls http://127.0.0.1:5050
```

Endpoint: `http://127.0.0.1:5050/mcp`

已用 `server/discover` 實測：Server 宣告支援 `2026-07-28`，且回應沒有 `Mcp-Session-Id`。完整 request metadata 與回應摘要見 [docs/test-results.md](docs/test-results.md)。

## Run the official SDK Test Client

在第一個終端機保持 Server 運行後，於第二個終端機執行：

```bash
dotnet run --project tools/StatelessWorkspaceMcp.Client -- \
  --endpoint=http://127.0.0.1:5050/mcp \
  --output=evidence/sdk-client-workflow.json
```

Client 會鎖定 `2026-07-28`、列出四個 Tools，執行 create/add/add/list/complete/list，再以不存在的 Handle 驗證 `workspace_not_found`。正常結束碼為 `0`；最後一個 Tool 的 `isError: true` 是預期的安全測試結果。

若要補交圖片，可在 Client 執行後手動擷取終端機畫面並保存為：

- `evidence/client-tool-list.png`
- `evidence/successful-workflow.png`
- `evidence/missing-workspace-error.png`

CLI 產生的 JSON 證據已包含這三個畫面所需的完整資料，因此沒有 GUI Client 時不會遺失可重現性。

## Test

```bash
dotnet test StatelessMcpWorkspace.slnx
```

目前共有 12 個測試：6 個 Store 單元測試與 6 個 MCP HTTP 整合測試。

## Important limitation

`InMemoryWorkspaceStore` 只在單一 Server process 中保存資料，重啟即清除，也不能跨 multiple instances 共享。協定無 Session 不代表應用程式不能有資料，更不代表本機記憶體可直接水平擴充。
