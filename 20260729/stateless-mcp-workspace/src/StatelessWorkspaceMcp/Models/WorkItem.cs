namespace StatelessWorkspaceMcp.Models;

public sealed record WorkItem(
    string Id,
    string Title,
    bool IsCompleted,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt);
