using System.Text.Json;
using ModelContextProtocol.Client;

const string DefaultEndpoint = "http://127.0.0.1:5050/mcp";
var endpoint = ReadEndpoint(args) ?? DefaultEndpoint;
var outputPath = ReadOption(args, "--output=");
var events = new List<object>();

var transportOptions = new HttpClientTransportOptions
{
    Endpoint = new Uri(endpoint),
    TransportMode = HttpTransportMode.StreamableHttp,
    ConnectionTimeout = TimeSpan.FromSeconds(10),
};

await using var transport = new HttpClientTransport(transportOptions);
await using var client = await McpClient.CreateAsync(
    transport,
    new McpClientOptions { ProtocolVersion = "2026-07-28" });

var tools = await client.ListToolsAsync();
Record("tools_list", arguments: null, new { tools = tools.Select(tool => tool.Name).OrderBy(name => name) });

var createArguments = Arguments(("name", "SDK Client Evidence"));
var created = await client.CallToolAsync(
    "create_workspace",
    createArguments);
Record("create_workspace", createArguments, created);
var workspaceId = GetStructuredString(created.StructuredContent, "workspace_id");

var firstItemArguments = Arguments(("workspace_id", workspaceId), ("title", "完成 MCP Client 測試"));
var firstItem = await client.CallToolAsync(
    "add_work_item",
    firstItemArguments);
Record("add_work_item_first", firstItemArguments, firstItem);
var firstItemId = GetStructuredString(firstItem.StructuredContent, "work_item_id");

var secondItemArguments = Arguments(("workspace_id", workspaceId), ("title", "整理 Client 證據"));
var secondItem = await client.CallToolAsync(
    "add_work_item",
    secondItemArguments);
Record("add_work_item_second", secondItemArguments, secondItem);

var listArguments = Arguments(("workspace_id", workspaceId));
var listedBeforeComplete = await client.CallToolAsync(
    "list_work_items",
    listArguments);
Record("list_before_complete", listArguments, listedBeforeComplete);

var completeArguments = Arguments(("workspace_id", workspaceId), ("work_item_id", firstItemId));
var completed = await client.CallToolAsync(
    "complete_work_item",
    completeArguments);
Record("complete_work_item", completeArguments, completed);

var listedAfterComplete = await client.CallToolAsync(
    "list_work_items",
    listArguments);
Record("list_after_complete", listArguments, listedAfterComplete);

var invalidWorkspaceArguments = Arguments(("workspace_id", "ws_does_not_exist"), ("title", "Must be rejected"));
var invalidWorkspace = await client.CallToolAsync(
    "add_work_item",
    invalidWorkspaceArguments);
Record("invalid_workspace", invalidWorkspaceArguments, invalidWorkspace);

if (outputPath is not null)
{
    var outputDirectory = Path.GetDirectoryName(Path.GetFullPath(outputPath));
    if (!string.IsNullOrEmpty(outputDirectory))
    {
        Directory.CreateDirectory(outputDirectory);
    }

    await File.WriteAllTextAsync(
        outputPath,
        JsonSerializer.Serialize(new { endpoint, protocol_version = "2026-07-28", events }, new JsonSerializerOptions { WriteIndented = true }));
}

return invalidWorkspace.IsError == true ? 0 : 1;

static string? ReadEndpoint(string[] arguments)
{
    return ReadOption(arguments, "--endpoint=");
}

static string? ReadOption(string[] arguments, string option) =>
    arguments.FirstOrDefault(argument => argument.StartsWith(option, StringComparison.Ordinal))?[option.Length..];

static Dictionary<string, object?> Arguments(params (string Name, object? Value)[] values) =>
    values.ToDictionary(value => value.Name, value => value.Value, StringComparer.Ordinal);

static string GetStructuredString(JsonElement? structuredContent, string propertyName)
{
    if (structuredContent is not { } content ||
        !content.TryGetProperty(propertyName, out var property) ||
        property.GetString() is not { } value)
    {
        throw new InvalidOperationException($"Tool result did not contain structuredContent.{propertyName}.");
    }

    return value;
}

void Record(string step, object? arguments, object result)
{
    var entry = new { step, arguments, result };
    events.Add(entry);
    Console.WriteLine(JsonSerializer.Serialize(entry));
}
