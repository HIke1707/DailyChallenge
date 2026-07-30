using StatelessWorkspaceMcp.Services;

namespace StatelessWorkspaceMcp.Tests;

public sealed class InMemoryWorkspaceStoreTests
{
    [Fact]
    public void Create_returns_a_unique_explicit_workspace_handle()
    {
        var store = new InMemoryWorkspaceStore();

        var first = store.Create("Daily AI Challenge");
        var second = store.Create("Daily AI Challenge");

        Assert.StartsWith("ws_", first.Id);
        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal("Daily AI Challenge", first.Name);
    }

    [Fact]
    public void Add_list_and_complete_use_the_workspace_id_supplied_by_the_caller()
    {
        var store = new InMemoryWorkspaceStore();
        var workspace = store.Create("Daily AI Challenge");

        var item = store.AddItem(workspace.Id, "Finish MCP tests");
        var completed = store.CompleteItem(workspace.Id, item.Id);
        var snapshot = store.Get(workspace.Id);

        Assert.StartsWith("wi_", item.Id);
        Assert.True(completed.IsCompleted);
        Assert.NotNull(completed.CompletedAt);
        Assert.NotNull(snapshot);
        var savedItem = Assert.Single(snapshot!.Items);
        Assert.Equal(item.Id, savedItem.Id);
        Assert.True(savedItem.IsCompleted);
    }

    [Fact]
    public void Workspaces_are_isolated()
    {
        var store = new InMemoryWorkspaceStore();
        var workspaceA = store.Create("A");
        var workspaceB = store.Create("B");

        store.AddItem(workspaceA.Id, "A only");
        store.AddItem(workspaceB.Id, "B only");

        var workspaceASnapshot = store.Get(workspaceA.Id);
        var workspaceBSnapshot = store.Get(workspaceB.Id);
        Assert.NotNull(workspaceASnapshot);
        Assert.NotNull(workspaceBSnapshot);
        var itemsA = workspaceASnapshot!.Items;
        var itemsB = workspaceBSnapshot!.Items;

        Assert.Collection(itemsA, item => Assert.Equal("A only", item.Title));
        Assert.Collection(itemsB, item => Assert.Equal("B only", item.Title));
    }

    [Fact]
    public void Unknown_workspace_never_falls_back_to_another_workspace()
    {
        var store = new InMemoryWorkspaceStore();
        var known = store.Create("Known");

        var exception = Assert.Throws<WorkspaceNotFoundException>(
            () => store.AddItem("ws_does_not_exist", "Injected item"));

        Assert.Equal("workspace_not_found", exception.Code);
        var knownSnapshot = store.Get(known.Id);
        Assert.NotNull(knownSnapshot);
        Assert.Empty(knownSnapshot!.Items);
    }

    [Fact]
    public void Invalid_input_is_rejected_before_it_can_be_saved()
    {
        var store = new InMemoryWorkspaceStore();

        Assert.Throws<WorkspaceInputException>(() => store.Create("  "));
        var workspace = store.Create("Valid");
        Assert.Throws<WorkspaceInputException>(() => store.AddItem(workspace.Id, new string('x', 201)));
        Assert.Throws<WorkspaceInputException>(() => store.AddItem("", "Item"));
    }

    [Fact]
    public async Task Concurrent_adds_do_not_lose_updates_or_reuse_item_ids()
    {
        var store = new InMemoryWorkspaceStore();
        var workspace = store.Create("Concurrent workspace");

        var createdItems = await Task.WhenAll(
            Enumerable.Range(1, 20)
                .Select(index => Task.Run(() => store.AddItem(workspace.Id, $"item-{index}"))));

        var snapshot = store.Get(workspace.Id);
        Assert.NotNull(snapshot);
        Assert.Equal(20, snapshot.Items.Count);
        Assert.Equal(20, createdItems.Select(item => item.Id).Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(20, snapshot.Items.Select(item => item.Id).Distinct(StringComparer.Ordinal).Count());
    }
}
