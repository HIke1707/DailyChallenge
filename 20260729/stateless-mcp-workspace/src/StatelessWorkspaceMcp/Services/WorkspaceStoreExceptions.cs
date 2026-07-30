namespace StatelessWorkspaceMcp.Services;

public sealed class WorkspaceNotFoundException(string workspaceId)
    : InvalidOperationException($"Workspace '{workspaceId}' does not exist.")
{
    public string Code => "workspace_not_found";
}

public sealed class WorkItemNotFoundException(string workItemId)
    : InvalidOperationException($"Work item '{workItemId}' does not exist in this workspace.")
{
    public string Code => "work_item_not_found";
}

public sealed class WorkspaceInputException(string message)
    : ArgumentException(message)
{
    public string Code => "invalid_input";
}
