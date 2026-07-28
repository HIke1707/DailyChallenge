# AI Practice Explorer

這是 2026-07-28 的 AI 實作練習：用 GitHub Copilot Canvas 將本機 AI 練習紀錄整理成可篩選、可編輯的 Dashboard。Canvas Extension 本體位於 [../../.github/extensions/ai-practice-explorer](../../.github/extensions/ai-practice-explorer)；本資料夾保留需求、prompt、測試紀錄與截圖證據。

## Canvas 如何啟動

1. 在 DailyChallenge repository 開啟 GitHub Copilot app 的 agent session。
2. 以 /create-canvas 建立或開啟 Canvas；專案範圍的 Extension 會從 .github/extensions/ai-practice-explorer/ 載入。
3. Canvas 會在右側面板開啟 AI Practice Explorer，資料來源是該 Extension 下的 artifacts/experiments.json。
4. 修改 extension.mjs 或 assets/app.js 後，請要求 Copilot reload extensions、執行 /clear 開始新 session，或重新啟動 Copilot。

此 Extension 使用 Copilot runtime 內建的 @github/copilot-sdk/extension，不能以一般 Node 指令直接完整啟動；請在支援 Canvas 的 GitHub Copilot app 內開啟。

## Extension 放置位置

    .github/extensions/ai-practice-explorer/
    ├── package.json
    ├── extension.mjs
    ├── assets/app.js
    └── artifacts/experiments.json

.github/extensions 是 project scope，會隨 Repository 分享；若只想個人使用，應放在 ~/.copilot/extensions/ai-practice-explorer/。

## JSON Schema

experiments.json 的根值是陣列。每筆紀錄使用以下欄位：

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| id | string | 唯一識別碼，例如 20260728-copilot-canvas |
| date | string | YYYY-MM-DD |
| title | string | 練習題目 |
| type | string | 任務類型，例如 agent-skill、security |
| score | number | 最終分數；未知資料不應自行填補 |
| hours | number | 投入時數 |
| enjoyment | integer | 1–5 |
| level | integer | 1–3 |
| wouldRepeat | boolean | 是否願意再做 |
| lesson | string | 最大收穫 |

UI 只會更新既有欄位，不會自行杜撰新的實驗紀錄。新增紀錄時請由使用者明確提供資料。

## 可用功能

- 卡片式顯示所有實驗紀錄，並依類型分組。
- 依類型篩選、只顯示 Would Repeat，以及依日期／平均分數／平均 enjoyment／總時數排序。
- 依類型顯示小型統計 Dashboard 與下一個建議嘗試類型。
- 編輯 score、hours、enjoyment、wouldRepeat 等既有紀錄欄位，寫回 JSON Artifact。
- 由 UI 新增一筆使用者明確輸入的紀錄。

## 如何新增紀錄

在 Canvas 按 Add，填入題目與已知資料後建立。Extension 會以日期與 title 建立 ID；若 JSON 中已有相同 ID，會回傳衝突，不會覆寫既有紀錄。

也可以直接修改 .github/extensions/ai-practice-explorer/artifacts/experiments.json，再重新載入 Canvas。

## 如何重現測試

1. 在支援 Canvas 的 GitHub Copilot app 開啟此 Repository。
2. 開啟 AI Practice Explorer。
3. 依 [docs/test-results.md](docs/test-results.md) 執行新增、持久化、篩選、欄位不完整與幻覺測試。
4. 將每次 Canvas 版本的截圖放入 evidence/。

離線可執行的檢查只有 JavaScript 語法檢查：

    cd .github/extensions/ai-practice-explorer
    npm run check

## 為什麼不使用外部網路

Canvas 的資料只讀取與寫入 Extension 目錄內的 JSON Artifact。它啟動的是 loopback HTTP server，供右側 Canvas UI 存取 /api/experiments 與本機 assets；沒有外部 URL、第三方 API、CDN、追蹤或資料上傳。

## 已知限制

- Canvas Extension 目前是 GitHub Copilot app 的功能；一般 Node 執行環境無法完整模擬 Canvas runtime。
- JSON 是單一檔案，尚未處理多使用者同時寫入或合併衝突。
- 使用者輸入仍只做欄位白名單處理，尚未加入完整 JSON Schema validator。
