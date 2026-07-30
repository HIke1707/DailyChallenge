# Test results

## Environment baseline

- Date: 2026-07-29
- .NET SDK: 10.0.201
- MCP SDK: `ModelContextProtocol.AspNetCore` 2.0.0

## Phase 2: Store tests

Run from this directory:

```bash
dotnet test StatelessMcpWorkspace.slnx --logger "console;verbosity=detailed"
```

Expected coverage: explicit workspace handle, normal add/list/complete behaviour, workspace isolation, unknown-handle rejection, input validation, and 20 concurrent writes.

**Actual result (2026-07-29):** 6 / 6 tests passed in 0.986 seconds.

## Phase 3: Stateless host

```bash
dotnet run --project src/StatelessWorkspaceMcp --urls http://127.0.0.1:5050
```

Expected endpoint: `http://127.0.0.1:5050/mcp`.

The host explicitly configures `HttpServerTransportOptions.Stateless = true`. The SDK's 2026-07-28 path must not create or return an MCP session ID. Tool discovery and client evidence will be recorded after Tools are implemented.

### Actual discovery check (2026-07-29)

The server was started with:

```bash
dotnet run --project src/StatelessWorkspaceMcp --no-build --urls http://127.0.0.1:5050
```

A manual `server/discover` request required all of the following 2026-07-28 metadata:

- `MCP-Protocol-Version: 2026-07-28`
- `Mcp-Method: server/discover`
- `params._meta.io.modelcontextprotocol/protocolVersion: 2026-07-28`

The endpoint returned `HTTP 200` and a discovery response with:

```json
{
  "supportedVersions": ["2026-07-28"],
  "ttlMs": 0,
  "cacheScope": "private"
}
```

The response did **not** contain `Mcp-Session-Id`. At this stage it contains only SDK-level discovery information because the four Workspace Tools have intentionally not yet been registered.

## Phase 4: MCP Tools

**Actual result (2026-07-30):** `tools/list` returned exactly four Tools:

- `create_workspace` — required: `name`
- `add_work_item` — required: `workspace_id`, `title`
- `list_work_items` — required: `workspace_id`
- `complete_work_item` — required: `workspace_id`, `work_item_id`

The SDK did not expose the injected `IWorkspaceStore` as a tool parameter. A manual 2026-07-28 workflow was completed using the `workspace_id` returned by `create_workspace` on every later request:

1. `create_workspace("Daily AI Challenge")` returned `ws_6f5f165156f4476fb0262960269b5bfd`.
2. `add_work_item(workspace_id, "完成 MCP 測試")` returned `wi_b0521cfd6d0b45b082ebd26189880fc8`.
3. `list_work_items(workspace_id)` returned that item only.
4. `complete_work_item(workspace_id, work_item_id)` returned the same item with `is_completed: true`.

An `add_work_item` call with `ws_does_not_exist` returned a normal MCP tool response with:

```json
{
  "isError": true,
  "structuredContent": {
    "code": "workspace_not_found",
    "message": "Workspace 'ws_does_not_exist' does not exist."
  }
}
```

This verifies that an invalid Handle is rejected and does not fall back to another or most-recent Workspace.

## Phase 5: in-memory MCP HTTP integration tests

The test project uses `Microsoft.AspNetCore.Mvc.Testing` 10.0.5 to start the same `Program` and `/mcp` route in memory. No TCP port, external service, API key, or manual Server process is required.

Run all tests:

```bash
dotnet test StatelessMcpWorkspace.slnx --no-restore --logger "console;verbosity=normal"
```

**Actual result (2026-07-30):** 12 / 12 tests passed in 1.1747 seconds.

The six new HTTP integration tests verify:

1. `tools/list` exposes exactly four Tools and marks each required argument in its JSON Schema.
2. A full create → add two items → list → complete → list workflow reuses the returned `workspace_id`.
3. Two separate Workspaces contain only their own items at the real MCP endpoint.
4. Unknown `workspace_id` returns `workspace_not_found` with MCP `isError: true`.
5. Empty `workspace_id` returns `invalid_input` with MCP `isError: true`.
6. `server/discover` advertises `2026-07-28`; all test responses assert that `Mcp-Session-Id` is absent.

The test client must send both of the following `Accept` values:

```text
application/json
text/event-stream
```

Sending only `text/event-stream` produced `406 Not Acceptable` from the Streamable HTTP endpoint. This is retained in the test helper as a protocol-level reproducibility check.

## Phase 6: official SDK Test Client evidence

No local Copilot, Claude, or Cursor executable was available, so the documented fallback was used: a small console client under `tools/StatelessWorkspaceMcp.Client`, built with the official `ModelContextProtocol` 2.0.0 package.

With the Server running on `http://127.0.0.1:5050/mcp`, run:

```bash
dotnet run --project tools/StatelessWorkspaceMcp.Client -- \
  --endpoint=http://127.0.0.1:5050/mcp \
  --output=evidence/sdk-client-workflow.json
```

**Actual result (2026-07-30):** the Client connected with `ProtocolVersion = "2026-07-28"`, discovered all four Tools, and saved eight ordered events in [../evidence/sdk-client-workflow.json](../evidence/sdk-client-workflow.json):

1. `tools_list`
2. `create_workspace`
3. `add_work_item_first`
4. `add_work_item_second`
5. `list_before_complete`
6. `complete_work_item`
7. `list_after_complete`
8. `invalid_workspace`

Each event contains the Client-sent arguments and the full MCP result. The final error result is intentionally `isError: true` with `workspace_not_found`; it proves the Client did not fall back to the valid Workspace. Successful Tool results have `isError: null` because the protocol omits the optional field when it is not an error.
