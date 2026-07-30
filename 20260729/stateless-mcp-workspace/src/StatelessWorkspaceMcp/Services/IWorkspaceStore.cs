using StatelessWorkspaceMcp.Models;

namespace StatelessWorkspaceMcp.Services;

public interface IWorkspaceStore
{
    Workspace Create(string name);

    Workspace? Get(string workspaceId);

    WorkItem AddItem(string workspaceId, string title);

    WorkItem CompleteItem(string workspaceId, string workItemId);
}
