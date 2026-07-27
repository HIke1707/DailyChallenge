# GitHub Copilot 整合說明

## 這次導入的內容

Repository 根目錄的 `.github/workflows/issue-security-gate.yml` 會在 Issue 建立、編輯、重新開啟，以及 Issue Comment 建立或編輯時執行本專案的 scanner。

它會讀取 Issue 標題、內文與所有目前留言，建立 intake JSON 後執行確定性安全政策，並套用唯一一個結果標籤：

| 結果 | 標籤 | 後續處理 |
| --- | --- | --- |
| `allow` | `agent-security-allow` | 可由有權限的人手動指派自訂 Agent。 |
| `review` | `agent-security-review` | 不得指派 Agent，等待人工核准或建立可信任任務摘要。 |
| `block` | `agent-security-block` | 不得指派 Agent。 |
| `error` | `agent-security-error` | 閘門失敗時採 fail-closed，禁止指派 Agent。 |

Workflow 不會在 shell 中插入 Issue 內容，也沒有任何 secrets、deploy、程式碼寫入權限或 Agent Task token。它只有讀取程式碼和管理 Issue 標籤的最小權限。

每次成功掃描也會將 `issue-result.json` 與 `issue-result.md` 上傳為 GitHub Actions artifact，保存 7 天，供有 Repository read 權限的人在 Actions run 頁面下載。原始 intake JSON 與附件內容不會被上傳。Label 仍是即時決策標準；artifact 僅供人工稽核。

GitHub Issue 事件不會提供 PDF 或其他附件的抽取文字；因此目前不下載附件。內文或留言中出現外部 URL 會由 `SEC-006` 進入 `review`。若要掃描 PDF，必須另建沒有 secrets、限制檔案大小與 MIME type 的隔離抽取服務，再把抽取文字送進 Gate。

## 自訂 Agent 設定

正式的 GitHub Copilot 自訂 Agent 設定位於：

```text
.github/agents/dailychallenge-security-gated-dev.agent.md
```

這取代了非正式的 `copilot-config.json`。它使用 YAML front matter 設定名稱、說明、目標與允許工具，並在 Markdown 內容中定義 Agent 的安全操作規則。GitHub 官方參考資料：<https://docs.github.com/en/copilot/reference/custom-agents-configuration>

這個 Agent 設為 `disable-model-invocation: true`，表示必須由人員明確選取；它不會由模型自行挑選。

## 如何真的啟動 Copilot Agent

這個 workflow 是安全 Gate，不會假裝「加了標籤就已啟動 Agent」。GitHub Copilot 有兩種正式啟動方式：

1. **最安全的做法：人工指派**
   在確認 Issue 有 `agent-security-allow` 標籤後，於 GitHub Issue 的 Assignees 選 Copilot，再選取 `DailyChallenge Security-Gated Developer`。這是本次導入後可立即採用的流程。

2. **GitHub Copilot Automations**
   在 Repository 的 **Agents → Automations** 建立「When an issue is created」Automation。這是在 GitHub 網頁介面設定，不會寫入 `.github/workflows`，而且只適用 private／internal repository 與支援的付費 Copilot 方案。它預設忽略沒有 write 權限的使用者建立的事件。官方文件：<https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/create-automations>

不要直接設定 Automation 對外部 Issue 自動開發。Automation 的 trigger 是 Issue 建立當下，而 Gate 標籤是稍後才產生；單靠標籤無法安全地把「Issue 建立」Automation 延後到 Gate 完成後。

若一定要在 Gate 通過後自動啟動 Agent，必須使用 GitHub 的 Agent Tasks API。該 API 目前是 public preview，啟動 task 的 endpoint 需要 Copilot Business 或 Enterprise，以及具 `Agent tasks: write` 權限的**使用者型** token；`GITHUB_TOKEN` 與 GitHub App installation token 都不支援。應將這個呼叫放在獨立的受控服務或需人工核准的 workflow，而不是一般的外部 Issue 事件工作流。官方文件：<https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-via-the-api>

## 測試 Gate workflow

1. 將變更推送到 `HIke1707/DailyChallenge`。
2. 在 GitHub 建立測試 Issue，觀察 Actions 的 **Agent Issue Security Gate** 工作流。
3. 確認 Issue 收到 `agent-security-allow`、`agent-security-review` 或 `agent-security-block` 標籤。
4. 僅對 `agent-security-allow` 的 Issue，手動指派 `DailyChallenge Security-Gated Developer` Agent。

請使用 private sandbox repository，且不要放入 secrets、Production 權限或真實客戶資料。GitHub Copilot Agent 建立的 PR，預設也需要有 write 權限的人核准後才會執行 GitHub Actions workflow。
