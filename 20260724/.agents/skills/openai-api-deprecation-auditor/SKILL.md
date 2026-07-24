---
name: openai-api-deprecation-auditor
description: Audit repositories for deprecated OpenAI model IDs and API usage, produce evidence-backed migration reports, and identify unresolved dynamic configuration. Use when checking OpenAI API lifecycle risk, deprecated models, migration readiness, or release compatibility. Do not use for general code review unrelated to OpenAI APIs.
---

1. 執行之前確認references/openai-deprecations.json是否有資料存在，若沒有資料請提醒使用者補齊資料
2. 確認使用者要求的是唯讀稽核還是允許修改。
3. 讀取 references/openai-deprecations.json。
4. 執行確定性掃描器。
5. 檢查 Scanner 的 Exit Code 與 JSON。
6. 搜尋 Scanner 可能漏掉的間接 Wrapper 或動態組合。
7. 區分：
    * 已確認淘汰
    * 已確認安全
    * 無法判定
    * 文件或註解中的歷史參照
8. 僅依 Catalog 提供替代模型。
9. 禁止自行發明模型名稱或遷移步驟。
10. 沒有使用者明確同意時，不直接修改程式碼。
11. 產生固定格式的 Markdown 報告。