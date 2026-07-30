using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace StatelessWorkspaceMcp.Tests;

public sealed class McpHttpIntegrationTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Tools_list_exposes_exactly_the_four_workspace_tools_with_required_handles()
    {
        var result = await SendAsync("tools/list", "tools-list-test");
        var tools = result.GetProperty("tools").EnumerateArray().ToArray();

        Assert.Equal(4, tools.Length);
        Assert.Equal(
            ["add_work_item", "complete_work_item", "create_workspace", "list_work_items"],
            tools.Select(tool => tool.GetProperty("name").GetString()).OrderBy(name => name));

        AssertRequired(tools, "create_workspace", "name");
        AssertRequired(tools, "add_work_item", "workspace_id", "title");
        AssertRequired(tools, "list_work_items", "workspace_id");
        AssertRequired(tools, "complete_work_item", "workspace_id", "work_item_id");
    }

    [Fact]
    public async Task Stateless_mcp_workflow_reuses_the_returned_handle_and_completes_one_item()
    {
        var created = await CallToolAsync("create-workspace-test", "create_workspace", new { name = "Integration workflow" });
        var workspaceId = GetStructuredString(created, "workspace_id");

        var firstItem = await CallToolAsync(
            "add-first-test",
            "add_work_item",
            new { workspace_id = workspaceId, title = "First item" });
        var firstItemId = GetStructuredString(firstItem, "work_item_id");

        await CallToolAsync(
            "add-second-test",
            "add_work_item",
            new { workspace_id = workspaceId, title = "Second item" });

        var beforeComplete = await CallToolAsync(
            "list-before-complete-test",
            "list_work_items",
            new { workspace_id = workspaceId });
        Assert.Equal(2, beforeComplete.GetProperty("structuredContent").GetProperty("items").GetArrayLength());

        var completed = await CallToolAsync(
            "complete-item-test",
            "complete_work_item",
            new { workspace_id = workspaceId, work_item_id = firstItemId });
        Assert.True(completed.GetProperty("structuredContent").GetProperty("is_completed").GetBoolean());
        Assert.Equal(firstItemId, GetStructuredString(completed, "work_item_id"));

        var afterComplete = await CallToolAsync(
            "list-after-complete-test",
            "list_work_items",
            new { workspace_id = workspaceId });
        var items = afterComplete.GetProperty("structuredContent").GetProperty("items").EnumerateArray().ToArray();

        Assert.Contains(items, item =>
            item.GetProperty("work_item_id").GetString() == firstItemId &&
            item.GetProperty("is_completed").GetBoolean());
    }

    [Fact]
    public async Task Workspaces_are_isolated_at_the_mcp_endpoint()
    {
        var workspaceA = GetStructuredString(
            await CallToolAsync("create-a-test", "create_workspace", new { name = "Workspace A" }),
            "workspace_id");
        var workspaceB = GetStructuredString(
            await CallToolAsync("create-b-test", "create_workspace", new { name = "Workspace B" }),
            "workspace_id");

        await CallToolAsync("add-a-test", "add_work_item", new { workspace_id = workspaceA, title = "A only" });
        await CallToolAsync("add-b-test", "add_work_item", new { workspace_id = workspaceB, title = "B only" });

        var listedA = await CallToolAsync("list-a-test", "list_work_items", new { workspace_id = workspaceA });
        var listedB = await CallToolAsync("list-b-test", "list_work_items", new { workspace_id = workspaceB });

        Assert.Collection(
            listedA.GetProperty("structuredContent").GetProperty("items").EnumerateArray(),
            item => Assert.Equal("A only", item.GetProperty("title").GetString()));
        Assert.Collection(
            listedB.GetProperty("structuredContent").GetProperty("items").EnumerateArray(),
            item => Assert.Equal("B only", item.GetProperty("title").GetString()));
    }

    [Theory]
    [InlineData("ws_does_not_exist")]
    [InlineData("")]
    public async Task Invalid_or_missing_workspace_handle_is_a_structured_tool_error(string workspaceId)
    {
        var result = await CallToolAsync(
            $"invalid-workspace-{workspaceId.Length}",
            "add_work_item",
            new { workspace_id = workspaceId, title = "Injected item" });

        Assert.True(result.GetProperty("isError").GetBoolean());
        var structured = result.GetProperty("structuredContent");
        Assert.Equal(workspaceId.Length == 0 ? "invalid_input" : "workspace_not_found", structured.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Discover_uses_2026_07_28_without_an_mcp_session_header()
    {
        var result = await SendAsync("server/discover", "discover-test");
        var versions = result.GetProperty("supportedVersions").EnumerateArray().Select(version => version.GetString());

        Assert.Contains("2026-07-28", versions);
    }

    private async Task<JsonElement> CallToolAsync(string requestId, string toolName, object arguments) =>
        await SendAsync("tools/call", requestId, new { name = toolName, arguments }, toolName);

    private async Task<JsonElement> SendAsync(string method, string requestId, object? additionalParameters = null, string? toolName = null)
    {
        var metadata = new Dictionary<string, object>
        {
            ["io.modelcontextprotocol/protocolVersion"] = "2026-07-28",
            ["io.modelcontextprotocol/clientInfo"] = new { name = "integration-tests", version = "1.0" },
            ["io.modelcontextprotocol/clientCapabilities"] = new { },
        };
        var parameters = additionalParameters is null
            ? new Dictionary<string, object> { ["_meta"] = metadata }
            : MergeWithMetadata(additionalParameters, metadata);

        using var request = new HttpRequestMessage(HttpMethod.Post, "/mcp")
        {
            Content = JsonContent.Create(new { jsonrpc = "2.0", id = requestId, method, @params = parameters }),
        };
        request.Headers.Add("MCP-Protocol-Version", "2026-07-28");
        request.Headers.Add("Mcp-Method", method);
        request.Headers.Accept.ParseAdd("application/json");
        request.Headers.Accept.ParseAdd("text/event-stream");
        if (toolName is not null)
        {
            request.Headers.Add("Mcp-Name", toolName);
        }

        using var response = await _client.SendAsync(request);
        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Mcp-Session-Id"));

        var payload = await response.Content.ReadAsStringAsync();
        var json = payload
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault(line => line.StartsWith("data: ", StringComparison.Ordinal));
        Assert.NotNull(json);

        using var document = JsonDocument.Parse(json!["data: ".Length..]);
        return document.RootElement.GetProperty("result").Clone();
    }

    private static Dictionary<string, object> MergeWithMetadata(object additionalParameters, Dictionary<string, object> metadata)
    {
        var element = JsonSerializer.SerializeToElement(additionalParameters);
        var parameters = element
            .EnumerateObject()
            .ToDictionary(property => property.Name, property => (object)property.Value.Clone(), StringComparer.Ordinal);
        parameters["_meta"] = metadata;
        return parameters;
    }

    private static string GetStructuredString(JsonElement result, string propertyName) =>
        result.GetProperty("structuredContent").GetProperty(propertyName).GetString()
        ?? throw new InvalidOperationException($"Missing structured content property '{propertyName}'.");

    private static void AssertRequired(JsonElement[] tools, string toolName, params string[] required)
    {
        var actualRequired = tools
            .Single(tool => tool.GetProperty("name").GetString() == toolName)
            .GetProperty("inputSchema")
            .GetProperty("required")
            .EnumerateArray()
            .Select(property => property.GetString())
            .OrderBy(property => property)
            .ToArray();

        Assert.Equal(required.OrderBy(property => property), actualRequired);
    }
}
