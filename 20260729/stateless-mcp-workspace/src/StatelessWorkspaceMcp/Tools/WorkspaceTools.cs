using System.ComponentModel;
using System.Text.Json;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using StatelessWorkspaceMcp.Models;
using StatelessWorkspaceMcp.Services;

namespace StatelessWorkspaceMcp.Tools;

[McpServerToolType]
public sealed class WorkspaceTools
{
    private const string HandleInstruction =
        "Use the workspace_id returned by create_workspace. Never invent, omit, or infer a workspace ID. " +
        "If it is unavailable, ask the caller for it.";

    [McpServerTool(Name = "create_workspace")]
    [Description("Creates a new isolated workspace and returns its workspace_id. Save this opaque ID and pass it unchanged to later workspace tools.")]
    public static CallToolResult CreateWorkspace(
        IWorkspaceStore store,
        [Description("A non-empty workspace name, at most 100 characters.")] string name)
    {
        try
        {
            var workspace = store.Create(name);
            return Success(new WorkspaceCreatedResponse(workspace.Id, workspace.Name));
        }
        catch (WorkspaceInputException exception)
        {
            return Error(exception.Code, exception.Message);
        }
    }

    [McpServerTool(Name = "add_work_item")]
    [Description("Adds one work item to exactly the workspace identified by workspace_id. " + HandleInstruction)]
    public static CallToolResult AddWorkItem(
        IWorkspaceStore store,
        [Description("The exact workspace_id returned earlier by create_workspace. Required; never guess it.")] string workspace_id,
        [Description("A non-empty work item title, at most 200 characters.")] string title)
    {
        try
        {
            var item = store.AddItem(workspace_id, title);
            return Success(ToResponse(workspace_id, item));
        }
        catch (WorkspaceInputException exception)
        {
            return Error(exception.Code, exception.Message);
        }
        catch (WorkspaceNotFoundException exception)
        {
            return Error(exception.Code, exception.Message);
        }
    }

    [McpServerTool(Name = "list_work_items")]
    [Description("Lists work items only from the workspace identified by workspace_id. " + HandleInstruction)]
    public static CallToolResult ListWorkItems(
        IWorkspaceStore store,
        [Description("The exact workspace_id returned earlier by create_workspace. Required; never guess it.")] string workspace_id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(workspace_id) || !workspace_id.StartsWith("ws_", StringComparison.Ordinal))
            {
                return Error("invalid_input", "workspace_id is required and must start with 'ws_'.");
            }

            var workspace = store.Get(workspace_id);
            return workspace is null
                ? Error("workspace_not_found", $"Workspace '{workspace_id}' does not exist.")
                : Success(new WorkItemListResponse(workspace.Id, workspace.Items.Select(ToListResponse).ToArray()));
        }
        catch (WorkspaceInputException exception)
        {
            return Error(exception.Code, exception.Message);
        }
    }

    [McpServerTool(Name = "complete_work_item")]
    [Description("Marks one work item as completed, but only inside the workspace identified by workspace_id. " + HandleInstruction)]
    public static CallToolResult CompleteWorkItem(
        IWorkspaceStore store,
        [Description("The exact workspace_id returned earlier by create_workspace. Required; never guess it.")] string workspace_id,
        [Description("The exact work_item_id returned by add_work_item for this same workspace.")] string work_item_id)
    {
        try
        {
            var item = store.CompleteItem(workspace_id, work_item_id);
            return Success(ToResponse(workspace_id, item));
        }
        catch (WorkspaceInputException exception)
        {
            return Error(exception.Code, exception.Message);
        }
        catch (WorkspaceNotFoundException exception)
        {
            return Error(exception.Code, exception.Message);
        }
        catch (WorkItemNotFoundException exception)
        {
            return Error(exception.Code, exception.Message);
        }
    }

    private static CallToolResult Success<T>(T payload) =>
        new()
        {
            Content = [new TextContentBlock { Text = JsonSerializer.Serialize(payload) }],
            StructuredContent = JsonSerializer.SerializeToElement(payload),
        };

    private static CallToolResult Error(string code, string message)
    {
        var payload = new ToolErrorResponse(code, message);
        return new CallToolResult
        {
            Content = [new TextContentBlock { Text = JsonSerializer.Serialize(payload) }],
            StructuredContent = JsonSerializer.SerializeToElement(payload),
            IsError = true,
        };
    }

    private static WorkItemResponse ToResponse(string workspaceId, WorkItem item) =>
        new(workspaceId, item.Id, item.Title, item.IsCompleted, item.CompletedAt);

    private static ListedWorkItemResponse ToListResponse(WorkItem item) =>
        new(item.Id, item.Title, item.IsCompleted, item.CompletedAt);

    private sealed record WorkspaceCreatedResponse(string workspace_id, string name);

    private sealed record WorkItemResponse(
        string workspace_id,
        string work_item_id,
        string title,
        bool is_completed,
        DateTimeOffset? completed_at);

    private sealed record ListedWorkItemResponse(
        string work_item_id,
        string title,
        bool is_completed,
        DateTimeOffset? completed_at);

    private sealed record WorkItemListResponse(string workspace_id, IReadOnlyList<ListedWorkItemResponse> items);

    private sealed record ToolErrorResponse(string code, string message);
}
