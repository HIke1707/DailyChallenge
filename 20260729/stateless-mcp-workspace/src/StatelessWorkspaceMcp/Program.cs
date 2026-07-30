using ModelContextProtocol.AspNetCore;
using StatelessWorkspaceMcp.Services;
using StatelessWorkspaceMcp.Tools;

var builder = WebApplication.CreateBuilder(args);

// This singleton is application data for this single process. It is deliberately
// separate from MCP protocol state and is addressed only by explicit handles.
builder.Services.AddSingleton<IWorkspaceStore, InMemoryWorkspaceStore>();

builder.Services
    .AddMcpServer()
    .WithHttpTransport(options =>
    {
        options.Stateless = true;
    })
    .WithTools<WorkspaceTools>();

var app = builder.Build();

app.MapMcp("/mcp");

app.Logger.LogInformation(
    "Stateless MCP endpoint is available at {McpEndpoint}. No MCP session is created.",
    "/mcp");

app.Run();

public partial class Program;
