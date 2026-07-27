# GitHub Copilot 翻譯 POC

## 用途與邊界

`.github/workflows/copilot-translation-poc.yml` 是一個手動觸發的可行性測試，用來確認此 Repository 能否以 GitHub Actions 內建的 `GITHUB_TOKEN` 呼叫 GitHub Copilot CLI，將指定 GitHub Issue 的文字翻譯為英文。

它**不是**正式 Security Gate 的一部分：

- 不會在 Issue 建立、編輯或留言時自動執行。
- 不會啟動 Coding Agent、建立 PR、加標籤或改動 Repository。
- 不會掃描或翻譯 PDF／附件。
- 不會把翻譯結果視為 allow／review／block 決策。

這個分離是刻意的。翻譯模型本身也可能受不可信任 Issue 文字影響，因此必須先在隔離、手動、最小權限的環境驗證，再考慮接入正式 Gate。

## 如何執行

1. 將 workflow 推送到預設分支。
2. 在 GitHub Repository 的 **Actions** 頁籤選擇 **Copilot Issue Translation POC**。
3. 點選 **Run workflow**，輸入測試 Issue 編號。
4. 執行成功後，在該 run 的 **Artifacts** 區下載 `copilot-translation-poc-...`。

Artifact 只保存 1 天，且僅包含 Copilot 回傳的翻譯結果，不包含原始 Issue JSON。

## 權限與安全控制

Workflow 只要求：

```yaml
permissions:
  issues: read
  copilot-requests: write
```

它不 checkout repository、沒有 secrets、沒有 contents write、沒有外部 API key。Copilot CLI 在空白暫存資料夾執行，並以 `--available-tools=''` 限制模型可用工具、停用 built-in MCP、禁止存取暫存目錄。

`--allow-all-tools` 只用於滿足 Copilot CLI 的非互動模式；搭配空的 available-tools allowlist 時，模型沒有可用工具。這個 POC 不使用 `--yolo`、`--allow-all`、`--allow-all-paths` 或 `--allow-all-urls`。

Issue 輸入被限制為 title、body、前 10 則 comment；每個欄位最多 4,000 字元。超出時翻譯輸出會帶有 `truncated: true`，不得將此結果用於正式 allow 決策。

## 前置條件與可能結果

GitHub 官方支援以 `GITHUB_TOKEN` 搭配 `copilot-requests: write` 在 Actions 使用 Copilot CLI，無需個人 API key：<https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli-in-actions>

然而是否可用取決於你的 Copilot 方案與帳號／組織政策。若 run 顯示 token 沒有 Copilot 權限，表示這個個人 Repository 無法使用內建 token 路徑；此 POC 不會自動改用 PAT 或其他 API key。

即使 POC 可用，也會消耗 Copilot AI credits。請只用無 secrets 的測試 Issue 執行。

## POC 通過條件

1. Copilot 回傳可解析 JSON，且只包含 `title_en`、`body_en`、`comments_en`、`truncated`。
2. 中文／混合語言的安全關鍵詞保留其語意，不被刪除或弱化。
3. 內嵌的「忽略規則」「執行命令」等文字只被翻譯，不會讓 workflow 執行任何工具。
4. 不可信任 Issue 不會取得 Repository 內容、secrets、網路存取或 Coding Agent 權限。

只有所有條件成立，下一階段才會將「原文 deterministic scan + 英文譯文 deterministic scan + decision merge」加到正式 Security Gate。 
