# MCP 協定比較：Session 模式與 `2026-07-28` Stateless Core

## 比較範圍

此表比較傳統、使用 Session 的 Streamable HTTP 流程，與本專案鎖定的 MCP `2026-07-28` Stateless Core。SDK 仍可為舊 Client 提供相容路徑；表格不是說所有舊 Server 一律建立 Session，而是說明舊式 **Session-based** 部署的行為差異。

| 項目 | 舊版 Session 模式 | `2026-07-28` Stateless Core |
| --- | --- | --- |
| 初始協商 | `initialize`，接著 `notifications/initialized` | `server/discover` 探索能力 |
| Protocol Session | Server 可建立 Session | 協定層移除 Session |
| Session Header | `Mcp-Session-Id` 由 Server 回傳、Client 在後續 request 帶回 | 移除；不可建立或回傳此 header |
| Client metadata | 初始握手時傳遞 `clientInfo`、capabilities、protocol version | 每個 request 的 HTTP header 與 `_meta` 攜帶版本/Client metadata |
| Request routing | 若狀態綁 Session，常需 sticky routing 或 session migration/store | 任一 request 可路由到任一 instance |
| HTTP endpoint | 可包含 Session 相關 GET/DELETE、舊 SSE 相容端點 | 以獨立 POST request 為核心；本 SDK Stateless 模式不映射 GET/DELETE Session endpoint |
| Server-to-client 主動互動 | Session 可維持長連線支援部分通知/請求 | 不依賴 Session；需要使用 2026-07-28 的 extension/MRTR 模式或改變設計 |
| Application State | 容易將「目前工作區」放入 Session | 以 Tool input 的顯式 Handle 傳遞，例如 `workspace_id` |

## 本專案觀察到的 wire behavior

Server 使用：

```csharp
options.Stateless = true;
app.MapMcp("/mcp");
```

實測 `server/discover` 與 `tools/call` 的必要重點：

```text
POST /mcp
MCP-Protocol-Version: 2026-07-28
Mcp-Method: server/discover 或 tools/call
```

JSON-RPC 的 `params._meta` 也必須含 protocol version 與 Client metadata。Server 回覆成功時：

- 宣告支援 `2026-07-28`。
- 沒有 `Mcp-Session-Id` header。
- 每次 request 都由新的 Stateless server context 處理。

對 Streamable HTTP response，Client 需接受以下兩種 content type：

```text
application/json
text/event-stream
```

整合測試曾刻意只接受 `text/event-stream`，得到 `406 Not Acceptable`；測試 helper 因此固定同時傳送兩個 `Accept` 值。

## Stateless 不代表沒有資料

以下說法是錯誤的：

> Stateless 代表 Server 不能保存任何資料。

正確說法是：

> MCP protocol 不保存 Client 的隱含 Session；應用程式仍可保存資料，但後續操作必須帶明確的 state handle，且多 Instance 部署應使用共享資料層。

本專案的 `InMemoryWorkspaceStore` 正在保存 Workspace，但它不是 MCP Session。Agent 在下一次呼叫 `list_work_items` 時必須自行帶回 `workspace_id`；Server 沒有「上一個 Agent 操作哪個 Workspace」的可用記憶。

## 舊 Client 相容性

`ModelContextProtocol.AspNetCore` 2.0.0 仍保留舊協定的相容能力。若 Client 不支援 `2026-07-28`，SDK 可以走舊握手協商路徑；這不應被誤判為本 Server 實作失敗。

本作業的正式 SDK Test Client 明確固定 `ProtocolVersion = "2026-07-28"`，所以 [SDK Client evidence](../evidence/sdk-client-workflow.json) 證明的是新版 Stateless 路徑，不是回退後的相容模式。

## 部署結論

Stateless 改善的是 MCP Transport 的水平擴充與故障切換條件，不會自動提供：

- 使用者登入。
- Workspace 擁有權檢查。
- 資料持久化。
- 跨 Instance 一致性。

這些仍是 Application 層的責任。正式系統需在每次 request 驗證身分並檢查 resource-level authorization，再以外部 Store 保存 Workspace 資料。

## 參考資料

- [MCP C# SDK：Stateless and stateful mode](https://csharp.sdk.modelcontextprotocol.io/v2/concepts/stateless/stateless.html)
- [MCP C# SDK：Streamable HTTP transport](https://csharp.sdk.modelcontextprotocol.io/v2/concepts/transports/transports.html)
- [MCP `2026-07-28` Release Candidate：Stateless Core 說明](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)
