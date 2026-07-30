using StatelessWorkspaceMcp.Models;

namespace StatelessWorkspaceMcp.Services;

/// <summary>
/// A process-local store for the exercise. Every mutation is protected by one lock so
/// concurrent writes cannot overwrite one another. It intentionally has no concept of
/// a current workspace, HTTP session, connection, or MCP session.
/// </summary>
public sealed class InMemoryWorkspaceStore : IWorkspaceStore
{
    private const int MaximumNameLength = 100;
    private const int MaximumTitleLength = 200;

    private readonly Dictionary<string, WorkspaceState> _workspaces = new(StringComparer.Ordinal);
    private readonly Lock _sync = new();

    public Workspace Create(string name)
    {
        var normalizedName = NormalizeRequiredText(name, "Workspace name", MaximumNameLength);
        var now = DateTimeOffset.UtcNow;
        var state = new WorkspaceState(CreateId("ws"), normalizedName, now);

        lock (_sync)
        {
            _workspaces.Add(state.Id, state);
            return ToSnapshot(state);
        }
    }

    public Workspace? Get(string workspaceId)
    {
        if (string.IsNullOrWhiteSpace(workspaceId))
        {
            return null;
        }

        lock (_sync)
        {
            return _workspaces.TryGetValue(workspaceId, out var state)
                ? ToSnapshot(state)
                : null;
        }
    }

    public WorkItem AddItem(string workspaceId, string title)
    {
        EnsureWorkspaceId(workspaceId);
        var normalizedTitle = NormalizeRequiredText(title, "Work item title", MaximumTitleLength);

        lock (_sync)
        {
            var workspace = GetRequiredWorkspace(workspaceId);
            var item = new WorkItem(CreateId("wi"), normalizedTitle, false, DateTimeOffset.UtcNow, null);
            workspace.Items.Add(item);
            return item;
        }
    }

    public WorkItem CompleteItem(string workspaceId, string workItemId)
    {
        EnsureWorkspaceId(workspaceId);
        EnsureWorkItemId(workItemId);

        lock (_sync)
        {
            var workspace = GetRequiredWorkspace(workspaceId);
            var itemIndex = workspace.Items.FindIndex(item => item.Id == workItemId);
            if (itemIndex < 0)
            {
                throw new WorkItemNotFoundException(workItemId);
            }

            var current = workspace.Items[itemIndex];
            var completed = current.IsCompleted
                ? current
                : current with { IsCompleted = true, CompletedAt = DateTimeOffset.UtcNow };

            workspace.Items[itemIndex] = completed;
            return completed;
        }
    }

    private WorkspaceState GetRequiredWorkspace(string workspaceId) =>
        _workspaces.TryGetValue(workspaceId, out var workspace)
            ? workspace
            : throw new WorkspaceNotFoundException(workspaceId);

    private static Workspace ToSnapshot(WorkspaceState state) =>
        new(state.Id, state.Name, state.CreatedAt, state.Items.ToArray());

    private static string CreateId(string prefix) => $"{prefix}_{Guid.NewGuid():N}";

    private static string NormalizeRequiredText(string value, string fieldName, int maximumLength)
    {
        var normalized = value?.Trim();
        if (string.IsNullOrEmpty(normalized))
        {
            throw new WorkspaceInputException($"{fieldName} is required.");
        }

        if (normalized.Length > maximumLength)
        {
            throw new WorkspaceInputException($"{fieldName} must be at most {maximumLength} characters.");
        }

        return normalized;
    }

    private static void EnsureWorkspaceId(string workspaceId)
    {
        if (string.IsNullOrWhiteSpace(workspaceId) || !workspaceId.StartsWith("ws_", StringComparison.Ordinal))
        {
            throw new WorkspaceInputException("workspace_id is required and must start with 'ws_'.");
        }
    }

    private static void EnsureWorkItemId(string workItemId)
    {
        if (string.IsNullOrWhiteSpace(workItemId) || !workItemId.StartsWith("wi_", StringComparison.Ordinal))
        {
            throw new WorkspaceInputException("work_item_id is required and must start with 'wi_'.");
        }
    }

    private sealed class WorkspaceState(string id, string name, DateTimeOffset createdAt)
    {
        public string Id { get; } = id;

        public string Name { get; } = name;

        public DateTimeOffset CreatedAt { get; } = createdAt;

        public List<WorkItem> Items { get; } = [];
    }
}
