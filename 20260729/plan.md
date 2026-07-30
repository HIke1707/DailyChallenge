# 2026-07-29 實作計畫：Stateless MCP Workspace Server

## 目標與完成邊界

建立一個 ASP.NET Core 的 HTTP MCP Server，提供四個 Tool：

- `create_workspace`
- `add_work_item`
- `list_work_items`
- `complete_work_item`

本作業要驗證的是 **MCP 協定層沒有 Session**，而跨呼叫的應用程式狀態由 Tool 回傳並由下一次 Request 明確帶回的 `workspace_id` 管理。In-memory Store 只作為本機實驗用資料層；Server 重啟後資料消失是預期行為，不能宣稱已具備多節點持久化能力。

## 實作原則

1. 不使用 HTTP Session、Cookie、`Mcp-Session-Id`、Connection ID、靜態「目前 Workspace」變數，或「最近一次呼叫」作為狀態來源。
2. 所有讀寫 Workspace 的 Tool 都必須收到有效的 `workspace_id`；缺少或錯誤時回傳明確錯誤，絕不猜測或自動建立 Workspace。
3. 使用官方 C# SDK 的 HTTP Transport；不手寫 JSON-RPC/MCP Transport。
4. SDK API 以當天安裝後的實際版本為準。2026-07-28 協定支援目前屬新版 SDK 範圍，先查證再寫 Host 設定。
5. 先讓 Store 與單元測試正確，再接 MCP Tool 與真實 Client。

---

## Phase 0：建立專案與版本基線（約 35 分鐘）

### 0.1 先確認本機工具

在 Repository 根目錄執行：

```bash
dotnet --info
dotnet --list-sdks
git --version
```

**記錄位置：**稍後寫入 `README.md` 的 Environment 區段。

**完成條件：**可使用 .NET 8 或以上 SDK。若未安裝，先安裝 .NET SDK，再重新執行上述指令。

### 0.2 建立目錄、Solution 與兩個專案

```bash
mkdir -p 20260729/stateless-mcp-workspace
cd 20260729/stateless-mcp-workspace

dotnet new sln -n StatelessMcpWorkspace
dotnet new web -n StatelessWorkspaceMcp -o src/StatelessWorkspaceMcp
dotnet new xunit -n StatelessWorkspaceMcp.Tests -o tests/StatelessWorkspaceMcp.Tests

dotnet sln StatelessMcpWorkspace.sln add src/StatelessWorkspaceMcp/StatelessWorkspaceMcp.csproj
dotnet sln StatelessMcpWorkspace.sln add tests/StatelessWorkspaceMcp.Tests/StatelessWorkspaceMcp.Tests.csproj

dotnet add tests/StatelessWorkspaceMcp.Tests/StatelessWorkspaceMcp.Tests.csproj reference src/StatelessWorkspaceMcp/StatelessWorkspaceMcp.csproj

mkdir -p docs evidence
```

建立初始檔案：

```bash
touch README.md .env.example mcp-client-config.example.json
touch docs/protocol-comparison.md docs/architecture.md docs/test-results.md
```

**注意：**`.env` 是本機檔案，不應提交；本日基本版沒有任何 Secret，因此 `.env.example` 只放註解說明即可。

### 0.3 查詢並安裝官方 MCP SDK

先從官方 NuGet/SDK 文件確認實際可取得的預覽版與 API，再安裝 HTTP Server 所需套件：

```bash
dotnet add src/StatelessWorkspaceMcp/StatelessWorkspaceMcp.csproj package ModelContextProtocol.AspNetCore --prerelease
dotnet list src/StatelessWorkspaceMcp/StatelessWorkspaceMcp.csproj package --include-transitive
```

如果 `--prerelease` 取得的版本未支援 `2026-07-28`，停止後續實作，記錄查到的版本與 SDK release note，再確認官方文件指定的版本或 prerelease feed；不要自行假設 API 名稱。

### 0.4 建立空白基線並驗證

```bash
dotnet build StatelessMcpWorkspace.sln
dotnet test StatelessMcpWorkspace.sln
git status --short
```

在 `README.md` 先填入：

- 作業日期與目標。
- OS、`dotnet --info` 的 SDK 版本。
- `ModelContextProtocol.AspNetCore` 實際版本。
- MCP Client 名稱、版本（尚未決定可寫 `TBD`）。

**Checkpoint 0：**Solution Build/Test 成功；此階段不寫四個 Tool。

---

## Phase 1：先設計資料模型與顯式 Handle（約 35 分鐘）

### 1.1 建立目錄與模型

```bash
cd 20260729/stateless-mcp-workspace
mkdir -p src/StatelessWorkspaceMcp/Models
mkdir -p src/StatelessWorkspaceMcp/Services
mkdir -p src/StatelessWorkspaceMcp/Tools
```

建立：

- `Models/WorkItem.cs`
- `Models/Workspace.cs`
- `Services/IWorkspaceStore.cs`

資料模型建議至少包含：

| 類型 | 欄位 |
| --- | --- |
| `Workspace` | `Id`、`Name`、`CreatedAt`、`Items` |
| `WorkItem` | `Id`、`Title`、`IsCompleted`、`CreatedAt`、`CompletedAt` |

ID 格式：

- Workspace：`ws_` + 不可預測的 GUID/隨機值。
- Work item：`wi_` + 不可預測的 GUID/隨機值。

不要使用純遞增數字當跨 Workspace 的公開 ID。

### 1.2 設計 Store 介面與錯誤模型

`IWorkspaceStore` 至少定義以下語意：

```csharp
Workspace Create(string name);
Workspace? Get(string workspaceId);
WorkItem AddItem(string workspaceId, string title);
WorkItem CompleteItem(string workspaceId, string workItemId);
```

實作時可將「找不到 Workspace」與「找不到 Work Item」改為明確的 domain exception 或 result type，例如：

```json
{
  "code": "workspace_not_found",
  "message": "Workspace 'ws_bad' does not exist."
}
```

輸入限制先固定並記錄：

- `name`：去除首尾空白後必填，最多 100 字元。
- `title`：去除首尾空白後必填，最多 200 字元。
- `workspace_id`、`work_item_id`：必填且只接受預期的 `ws_`/`wi_` 格式。

**Checkpoint 1：**程式設計中沒有 `CurrentWorkspace`、`LastWorkspace`、HTTP Session 或任何依賴連線的狀態欄位。

---

## Phase 2：完成 Thread-safe In-memory Store 與單元測試（約 55 分鐘）

### 2.1 實作 Store

建立 `Services/InMemoryWorkspaceStore.cs`。

建議選擇其中一個清楚的同步策略：

1. `ConcurrentDictionary<string, WorkspaceState>` 搭配每個 Workspace 的 lock；或
2. 一個 private lock 保護 Dictionary 與可變 List 的所有讀寫。

這個作業資料量很小，第二種較容易驗證正確性。重點是「讀取舊 List、修改、整個覆蓋回去」不可產生 lost update。

原則：

- `Create` 只新增新 Workspace。
- `AddItem` 只能寫入傳入 ID 對應的 Workspace。
- `List` 回傳 snapshot/immutable copy，不能將內部可變 List 直接暴露出去。
- `CompleteItem` 只能完成同一個 Workspace 內的指定 Item。
- Store 不提供 `GetAllWorkspaces()`、依名稱猜 ID、或「最近使用 Workspace」功能。

### 2.2 新增 Store 測試

將預設 `UnitTest1.cs` 改成描述性測試檔，建議：

- `InMemoryWorkspaceStoreTests.cs`
- `WorkspaceIsolationTests.cs`
- `ConcurrencyTests.cs`

至少撰寫下列測試：

| 測試 | 核心驗證 |
| --- | --- |
| Create 會產生唯一 `ws_` ID | 名稱可保存、ID 不重複 |
| Add/List 正常流程 | 同一 Workspace 可新增與讀取 |
| Complete 正常流程 | 指定 Item 變 Completed |
| Workspace 隔離 | A 看不到 B 的資料 |
| 錯誤 Workspace | 回傳/拋出 `workspace_not_found` |
| 錯誤 Item | 回傳/拋出 `work_item_not_found` |
| 空字串與超長輸入 | 被拒絕、不可寫入 |
| 同 Workspace 併發新增 20 筆 | 最終 20 筆、ID 唯一、無遺失 |

併發測試可採用：

```csharp
await Task.WhenAll(
    Enumerable.Range(1, 20)
        .Select(i => Task.Run(() => store.AddItem(workspaceId, $"item-{i}"))));
```

執行：

```bash
dotnet test StatelessMcpWorkspace.sln --logger "console;verbosity=detailed"
```

**Checkpoint 2：**Store 測試全綠，並且併發 20 筆不遺失後，才進入 MCP 整合。

---

## Phase 3：接入官方 SDK 與 Stateless HTTP Endpoint（約 35 分鐘）

### 3.1 先依已安裝版本查 API

```bash
dotnet list src/StatelessWorkspaceMcp/StatelessWorkspaceMcp.csproj package --include-transitive
rg -n "AddMcpServer|WithHttpTransport|MapMcp|HttpServerTransportOptions|Stateless" ~/.nuget/packages/modelcontextprotocol* 2>/dev/null
```

若本機 NuGet 快取內容不易閱讀，以 SDK 對應版本的官方文件與 release note 為準。預期會使用類似以下概念（實際 method 名稱以已安裝 SDK 為準）：

```csharp
builder.Services
    .AddMcpServer()
    .WithHttpTransport(/* 明確設定 Stateless = true */)
    .WithToolsFromAssembly();

app.MapMcp("/mcp");
```

### 3.2 註冊服務、端點與開發 URL

在 `Program.cs`：

1. 將 `IWorkspaceStore` 註冊為 singleton，因為同一個 process 內要共享資料；這不是 MCP Session。
2. 加入官方 MCP Server 與 HTTP Transport。
3. 明確設定 Stateless 模式（若 SDK 預設為 true，仍建議明寫）。
4. 將 MCP Endpoint 固定為 `/mcp`。
5. 僅在 Development 環境提供必要的 log，不記錄完整敏感 Request。

在 `Properties/launchSettings.json` 或啟動參數固定本機 port，例如 `5050`。啟動：

```bash
dotnet run --project src/StatelessWorkspaceMcp --urls http://127.0.0.1:5050
```

**預期 log：**顯示可連線的 `http://127.0.0.1:5050/mcp`。

### 3.3 Wire behavior 基線驗證

先用 SDK 官方 Test Client 或 HTTP Client 驗證 endpoint 能回應。將觀察內容記錄進 `docs/test-results.md`：

- Request 使用 `MCP-Protocol-Version: 2026-07-28` 時的回應。
- 沒有 `Mcp-Session-Id` 回應 header。
- `server/discover` 能被處理（由 SDK 完成）。
- 若 Client 降級到舊版，記錄協商結果；不要偽造 header 或手刻協定。

**Checkpoint 3：**`POST /mcp` 可接受 MCP Request，且證據顯示新版 Stateless 路徑沒有建立/回傳 protocol session。

---

## Phase 4：實作四個 MCP Tools（約 45 分鐘）

### 4.1 建立 `Tools/WorkspaceTools.cs`

使用已安裝 SDK 對應的 Tool attribute 與 DI 方式（例如 `[McpServerTool]`）。四個 Tool 的命名、輸入與行為固定如下：

| Tool | 必填輸入 | 成功輸出 | 錯誤行為 |
| --- | --- | --- | --- |
| `create_workspace` | `name` | `workspace_id`、`name` | 空白/超長名稱被拒絕 |
| `add_work_item` | `workspace_id`、`title` | `work_item_id`、`title`、完成狀態 | workspace 不存在即拒絕 |
| `list_work_items` | `workspace_id` | 只含該 Workspace 的 items | workspace 不存在即拒絕 |
| `complete_work_item` | `workspace_id`、`work_item_id` | 已完成的 item | Workspace 或 item 不存在即拒絕 |

### 4.2 Tool Description 的必要文字

每個需要 Workspace 的 Tool 描述都要明確寫出：

> Use the `workspace_id` returned by `create_workspace`. Never invent, omit, or infer a workspace ID. If it is unavailable, ask the caller for it.

`create_workspace` 說明它會建立並回傳新的 Handle；其他 Tool 說明不會建立或猜測 Handle。這是引導 Client/Agent 的輔助措施，**真正的保護仍是 Store/Tool 的必填參數驗證**。

### 4.3 統一 Tool 錯誤輸出

建立最小的結果 DTO 或 error helper，讓錯誤內容可被 Client 辨識：

```json
{
  "isError": true,
  "code": "workspace_not_found",
  "message": "Workspace 'ws_bad' does not exist."
}
```

不要將 stack trace、內部 Dictionary 內容或其他 Workspace ID 回傳給 Client。

### 4.4 編譯與 Tool Schema 檢查

```bash
dotnet format whitespace StatelessMcpWorkspace.sln --verify-no-changes
dotnet build StatelessMcpWorkspace.sln
dotnet test StatelessMcpWorkspace.sln
```

**Checkpoint 4：**四個 Tool 都可被 server 發現；必要參數在 Tool schema 中標記為 required。

---

## Phase 5：增加 MCP 整合測試與協定驗證（約 40 分鐘）

### 5.1 選擇測試策略

優先順序：

1. 使用官方 C# SDK 的 in-process/integration test client；或
2. 啟動本機 Server，再用支援 MCP 的 Client 實測；或
3. 兩者皆做（最理想）。

如果 Client 尚未支援 2026-07-28，Integration Test 仍可作為 server 端證據，並在結果文件標示「Client 相容性限制」，不可判成 Server 失敗。

### 5.2 撰寫至少五個可重現案例

建立 `McpWorkflowIntegrationTests.cs`（依 SDK 的可測 API 調整），覆蓋：

1. **完整流程**：create → add 兩筆 → list → complete 第一筆 → list。
2. **Workspace 隔離**：A/B 各加一筆，交錯讀取，彼此不可見。
3. **錯誤 Handle**：`ws_does_not_exist` 必須得到 `workspace_not_found`，不得寫入。
4. **缺少 Handle/狀態越權**：不得以任何預設/最近 Workspace 繼續執行。
5. **併發寫入**：同一 Workspace 20 筆，最終 20 筆、ID 不重複。

另加一個 protocol-level assertion（若 SDK 測試 API 支援）：

- Stateless request 沒有依賴 `Mcp-Session-Id`。
- 同一 Workspace 的跨呼叫只由 request argument 的 `workspace_id` 關聯。

執行並保存輸出：

```bash
dotnet test StatelessMcpWorkspace.sln --logger "console;verbosity=detailed" | tee /tmp/stateless-mcp-test-20260729.txt
```

將測試命令、實際 SDK 版本、通過數與失敗排查（若有）摘要寫入 `docs/test-results.md`。`/tmp` 只做暫存，不需提交。

**Checkpoint 5：**五個案例都有自動測試或清楚的可重現手動證據，且全部成功。

---

## Phase 6：連接真實 MCP Client 與保存證據（約 45 分鐘）

### 6.1 建立不含 Secret 的 Client 設定範例

寫入 `mcp-client-config.example.json`，以 Client 實際格式為準；通用示意：

```json
{
  "mcpServers": {
    "stateless-workspace": {
      "url": "http://127.0.0.1:5050/mcp"
    }
  }
}
```

README 要明確說明：

- 這是範例，實際欄位隨 GitHub Copilot App/Copilot CLI/其他 Client 變動。
- Server 必須先以 `dotnet run` 啟動。
- 僅連接 loopback URL，不對外暴露。

### 6.2 手動操作腳本

在 MCP Client 中依序要求/呼叫：

1. 列出 Tools，確認剛好有四個目標 Tool。
2. `create_workspace(name: "Daily AI Challenge")`，複製回傳的 `workspace_id`。
3. 用同一個 ID 呼叫兩次 `add_work_item`。
4. `list_work_items(workspace_id)`。
5. 使用第一筆的 `work_item_id` 呼叫 `complete_work_item`。
6. 再次 `list_work_items(workspace_id)`，確認第一筆 completed。
7. 故意用 `ws_does_not_exist` 呼叫 `add_work_item`，確認結構化錯誤。

**必留證據：**完整 Tool call/result，而不是只截 Agent 的自然語言回答。可擷取或遮蔽本機無關資訊。

### 6.3 擷取三張圖片

將圖片保存到 `evidence/`：

- `client-tool-list.png`：Client 列出四個 Tool 與 schema。
- `successful-workflow.png`：create/add/list/complete 的完整成功結果。
- `missing-workspace-error.png`：錯誤/遺漏 workspace ID 的明確拒絕結果。

如 Client 沒有適合的 UI 截圖，保存純文字 Tool Call log，並在 `docs/test-results.md` 說明原因與路徑。

**Checkpoint 6：**有一條可追溯的真實 Client 操作流程，證明模型/Client 將 Server 回傳的 `workspace_id` 傳入後續呼叫。

---

## Phase 7：撰寫架構與協定文件（約 35 分鐘）

### 7.1 `docs/architecture.md`

說明並畫出以下流程（Markdown Mermaid 可接受）：

```text
MCP Client
  -> POST /mcp + protocol metadata
  -> WorkspaceTools
  -> IWorkspaceStore
  -> InMemoryWorkspaceStore
  -> response containing workspace_id / work_item_id
  -> Client passes workspace_id in the next tool call
```

必須清楚標示：

- MCP protocol state：無 Session。
- Application state：In-memory Store 內的 Workspace/Item。
- State handle：`workspace_id` 是不透明的明確輸入。
- Scale-out 限制：多個 process/instance 不共享 In-memory Store；正式部署要換成 Redis、SQL、Cosmos DB 等共享/持久化儲存。

### 7.2 `docs/protocol-comparison.md`

依實際安裝 SDK 與官方文件，以表格比較：

| 項目 | 舊版模式 | `2026-07-28` Stateless |
| --- | --- | --- |
| 初始協商 | `initialize` / `initialized` | `server/discover` |
| Protocol session | `Mcp-Session-Id` | 移除 |
| Metadata | 初始化時交換 | 每個 request 的 header / `_meta` |
| 請求路由 | 可能需 sticky session | 可由任意 instance 處理 |
| 應用狀態 | 容易與 session 綁定 | 顯式 handle + 外部狀態儲存 |
| 舊版相容 | 原生流程 | 交由 SDK negotiation/相容路徑 |

必須寫出以下限制：

- 「協定 Stateless」不等於「Server 不可保存資料」。
- 「沒有 MCP Session」不等於「資料自然可跨節點同步」。
- 此作業只驗證單一 process 內 explicit handle 的正確性。

### 7.3 完成 `README.md`

至少包含：

- 專案目的、非目標與架構摘要。
- 前置條件與實際版本清單。
- 安裝、Build、Test、Run 指令。
- MCP endpoint 與 Client 設定方式。
- 四個 Tools 的 input/output 範例。
- 正常流程與錯誤 Handle 流程。
- 證據與測試文件連結。
- 安全與限制：不提交 Secret、只用 loopback、in-memory 不可跨 instance。

---

## Phase 8：最終驗收與交付整理（約 25 分鐘）

### 8.1 最終命令

在專案根目錄執行：

```bash
dotnet restore StatelessMcpWorkspace.sln
dotnet build StatelessMcpWorkspace.sln --no-restore
dotnet test StatelessMcpWorkspace.sln --no-build --logger "console;verbosity=normal"
dotnet list src/StatelessWorkspaceMcp/StatelessWorkspaceMcp.csproj package --include-transitive
git status --short
```

啟動 Server 進行最後一次 Client 檢查：

```bash
dotnet run --project src/StatelessWorkspaceMcp --urls http://127.0.0.1:5050
```

### 8.2 Definition of Done 清單

- [ ] Server 可啟動，`/mcp` 可接受 HTTP MCP request。
- [ ] Client 或 Integration Test 可發現四個 Tools。
- [ ] `create_workspace` 回傳唯一 `workspace_id`。
- [ ] 後續三個 Tool 必須明確接收 `workspace_id`。
- [ ] A/B Workspace 完全隔離。
- [ ] 錯誤或缺少 Handle 時拒絕，不猜測最近 Workspace。
- [ ] 20 筆併發新增不遺失、ID 不重複。
- [ ] 有完整 Client Tool Call/Result 證據與三張圖片（或等價 log）。
- [ ] `protocol-comparison.md` 正確區分協定與應用狀態。
- [ ] `docs/test-results.md` 列出所有命令與結果。
- [ ] Repository 不含 API Key、Token、`.env`、或任何敏感資訊。
- [ ] README 寫入實際 SDK 與 Client 版本，沒有虛構版本/API。

### 8.3 建議交付順序

1. 先確認 `git diff --check` 沒有空白錯誤。
2. 檢視 `git status --short`，確認只有預期的 `20260729/stateless-mcp-workspace` 檔案。
3. 在交付說明附上：實際 SDK 版本、使用的 Client、協商到的 protocol version、五個測試結果與已知限制。
4. 未確認所有內容前，不提交 `.env`、screenshots 中的個人資料或本機機密資訊。

---

## 卡關時的決策表

| 狀況 | 先做什麼 | 不要做什麼 |
| --- | --- | --- |
| Client 不支援 `2026-07-28` | 用官方 SDK Integration Test 驗證 Server，記錄降級結果 | 偽造協定 header 或把 Client 限制當 Server 壞掉 |
| SDK 文件與程式 API 不同 | 以 `dotnet list package` 的實際版本對應 release/documentation | 混用 stable、RC、preview 的範例 |
| Server 重啟後資料消失 | 在 README 記錄這是 In-memory 預期行為 | 宣稱資料可水平擴充/持久化 |
| Agent 漏傳 ID | 改善 Tool Description，並保留 Server-side validation | 實作「使用上一個 workspace」備援 |
| 併發測試遺失資料 | 將 mutable state 全部置於一致 lock/Concurrent 設計 | 以延遲或重試掩蓋 race condition |

## 今日第一個實際操作

依題目限制，現在只執行 Phase 0：建立 Solution、安裝並確認實際 MCP SDK 版本、填寫 README 的版本基線、確認空專案能 Build/Test。四個 Tool 要等版本與 Host API 確認後才開始撰寫。
