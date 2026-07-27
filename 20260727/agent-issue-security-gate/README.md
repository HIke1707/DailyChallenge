# Agent Issue Intake Security Gate

`agent-issue-security-gate` 會在 GitHub Issue 的標題、內文、留言與已抽取的附件文字交給 Coding Agent 前，先篩檢其中的不可信任內容。

它是一個確定性、非執行式的安全閘門：依據版本化 JSON 政策掃描輸入文字，並回傳下列三種結果之一。

| 決策 | 意義 | Agent 處理方式 |
| --- | --- | --- |
| `allow` | 未命中已設定的風險模式。 | 可在正常的 Repository 權限範圍內繼續處理任務。 |
| `review` | 請求可能涉及高風險能力。 | Agent 動作前必須經人工核准。 |
| `block` | 命中明確危險規則，或累積風險達到封鎖門檻。 | 不得將該任務交給 Coding Agent。 |

## 安全邊界

本閘門不會執行 Issue 文字、Shell 指令、下載內容、編碼資料或連結，也不會抓取外部 URL；整個流程都將輸入視為資料而非指令。

初始政策可偵測秘密外洩、破壞性操作、指令覆寫、編碼命令、權限提升、外部下載、正式環境操作，以及關閉測試或防護機制等情境。

## 安裝

需要 Python 3.10 以上版本。首次使用時，建立隔離環境並安裝本機套件：

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -e .
```

## 執行安全閘門

```bash
python3 -m issue_guard.cli \
  --input fixtures/malicious/secret-exfiltration.json \
  --policy policies/default-policy.json \
  --output reports/
```

此指令會產生 `reports/sample-result.json` 與 `reports/sample-result.md`。

若結果是 `block`，CLI 會在寫入報告後回傳 exit code `2`。這是刻意設計：CI 或 Agent 包裝工作流應在將任務交給 Coding Agent 前停止。

若需要不同的報告檔名，可使用 `--report-name`：

```bash
python3 -m issue_guard.cli \
  --input fixtures/suspicious/production-deployment.json \
  --policy policies/default-policy.json \
  --output reports/ \
  --report-name production-review
```

## 輸入格式

```json
{
  "source_type": "issue",
  "title": "任務標題",
  "body": "不可信任的 Issue 內文",
  "comments": ["不可信任的留言文字"],
  "attachments": [
    {"name": "extracted-notes.txt", "text": "不可信任的附件抽取文字"}
  ]
}
```

`title`、`body`、每一則 `comment` 與每一個附件的 `text` 都會分開正規化。證據報告會保留內容來源與從 1 開始計算的行號。

## 政策設計

規則位於 `policies/default-policy.json`。每一條規則都有供自動化使用的穩定英文 `category`，以及供人員閱讀的 `category_label_zh`。

```json
{
  "id": "SEC-007",
  "category": "production_operation",
  "category_label_zh": "正式環境操作",
  "action": "review",
  "score": 45
}
```

明確標示為 `block` 的規則一旦命中就會直接封鎖。其他命中規則的分數會累加、最高為 100；總分達 60 以上同樣會封鎖，1 至 59 分則需要人工審核。

## 可選的 AI 語意複核

僅能將 [prompts/semantic-review.md](prompts/semantic-review.md) 用於確定性掃描結果為 `review` 的第二意見。AI 僅能建議 `review` 或 `block`，絕不能將確定性 `block` 降級為 `allow`。

## GitHub Copilot 整合

Repository 根目錄已提供 GitHub Actions 安全 Gate 與 Copilot 自訂 Agent Profile。它會在 Issue／Issue Comment 到達時套用 `agent-security-allow`、`agent-security-review` 或 `agent-security-block` 標籤，但不會自動啟動 Agent。完整的權限設計、限制與手動指派流程請見 [docs/github-copilot-integration.md](docs/github-copilot-integration.md)。

另有兩條完全手動、獨立的 Copilot POC：只驗證翻譯的 [docs/copilot-translation-poc.md](docs/copilot-translation-poc.md)，以及會執行「原文掃描 + 英文譯文掃描 + 最嚴格決策合併」的 [docs/copilot-translation-rescan-poc.md](docs/copilot-translation-rescan-poc.md)。兩者都不會啟動 Agent。

## 測試

```bash
python3 -m unittest discover -s tests -v
```

測試涵蓋全部安全、可疑與惡意 fixture，包含來源與行號證據、政策中繼資料，以及 CLI 的 JSON／Markdown 輸出。

## 限制

這是一個精簡的確定性安全閘門，不是完整的惡意程式分析或授權系統。它無法理解所有意圖、檢查二進位附件、驗證發送者身分，或安全地授權正式環境變更。實際使用時，仍應搭配 Repository 最小權限、人工核准與隔離的 Agent 執行環境。
