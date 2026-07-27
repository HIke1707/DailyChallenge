# Copilot 翻譯後複掃 POC

`.github/workflows/copilot-translation-rescan-poc.yml` 是獨立、手動觸發的安全驗證流程。它不取代正式的 Issue Security Gate，也不會替 Issue 加標籤、啟動 Agent、建立分支或修改 Repository。

## 流程

```text
GitHub Issue（不可信任）
  ├─ 原文 deterministic scanner ───────┐
  └─ 無工具 Copilot 翻譯成英文 → scanner ┤
                                           └→ 取較嚴格決策 → POC 報告
```

合併規則是 `block > review > allow`；翻譯後的掃描結果絕不能降低原文的決策。若 Copilot 回傳不是嚴格的 JSON、欄位不完整、留言數量不一致、結果被截斷，或任一掃描報告缺失，合併結果一律為 `error`，並停止 POC。

POC 最後只有在 `allow` 時顯示成功；`review`、`block` 與 `error` 都會讓 run 失敗，明確表示不得交給 Agent。這是流程控制，並非 GitHub Issue 的任何寫入操作。

## 執行方式

1. 將變更推到預設分支。
2. 在 GitHub 的 **Actions** 選取 **Copilot Translation and Rescan POC**。
3. 點選 **Run workflow**，輸入純數字的 Issue 編號。
4. 下載 Artifact `copilot-translation-rescan-poc-...`，查看：
   - `raw-result.*`：原文掃描結果。
   - `translated-result.*`：英文譯文掃描結果。
   - `translation-rescan-result.*`：最後合併決策。

Artifact 保存 1 天。`translation-response.json` 仍是從不可信任輸入衍生的文字，只能用於人工檢查，不可拿來執行或當成指令。

## 安全限制

- Copilot CLI 在空白暫存資料夾執行，沒有 Repository 寫入權限，且用空的工具 allowlist、停用內建 MCP、禁止存取暫存目錄。
- Copilot CLI 使用 `-s` 靜默模式，因此輸出檔只保留模型回應；譯文仍必須通過嚴格 JSON 驗證。
- Workflow 僅有 `contents: read`、`issues: read` 與 `copilot-requests: write` 權限；不使用 API key、PAT 或 Repository secret。
- 為了測試「AI 不能解除 block」，即使原文已被 scanner 判定為 `block`，POC 仍會在受限環境進行翻譯和第二次掃描；最終決策永遠不會因為譯文而變寬鬆。
- Issue 與前 10 則留言都限制為每段 4,000 字元；任何截斷都會 fail closed，因此不會產生 allow。

這個 POC 通過後，才適合把相同的合併邏輯納入正式自動 Gate。
