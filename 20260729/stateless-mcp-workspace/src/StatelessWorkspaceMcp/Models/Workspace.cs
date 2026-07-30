namespace StatelessWorkspaceMcp.Models;

public sealed record Workspace(
    string Id,
    string Name,
    DateTimeOffset CreatedAt,
    IReadOnlyList<WorkItem> Items);
