# Model A｜盲測實作 Prompt

你正在參加一項 coding model 盲測。請獨立完成 Incident Replay Workbench，不得尋找、推測或利用評分器內容。

## 任務與工作位置

- 唯一題目檔：`20260814/model-showdown/challenge/TASK.md`
- 唯一可讀寫的實作目錄：`20260814/model-showdown/submissions/model-a/**`
- 你的執行目錄應固定為：`20260814/model-showdown/submissions/model-a`

先完整閱讀題目檔，再檢查自己的實作目錄並開始工作。題目已有明確規格；除非遇到無法從題目或現有檔案判斷的真正阻礙，請自行作出合理決策並完成實作。

## 嚴格範圍限制

你只能讀取：

1. `20260814/model-showdown/challenge/TASK.md`
2. `20260814/model-showdown/submissions/model-a/**`

你只能修改：

1. `20260814/model-showdown/submissions/model-a/**`

不得讀取、列舉、搜尋、開啟、摘要或修改下列內容：

- `20260814/model-showdown/evaluation/**`
- `20260814/model-showdown/reports/**`
- `20260814/model-showdown/submissions/model-b/**`
- `20260814/model-showdown/scripts/evaluate.mjs`
- repository 的 Git history、其他 branch 或 commit 中與本題評分、另一份提交有關的內容
- 題目與自己 submission 以外的任何檔案

不要在 `20260814/model-showdown` 或 repository 根目錄執行無範圍限制的 `find`、`rg`、`ls -R`、`tree`、`git diff`、`git show`、`git log` 或類似列舉命令。所有搜尋都必須明確限制在自己的 submission；Git diff 若需要使用，也只能指定自己的 submission 路徑。

不得委派其他 agent、sub-agent 或外部服務去讀取禁止區域。不得使用網路搜尋本 repository、題目答案或評分內容。

如果工具意外回傳任何禁止區域的內容，立即停止使用該內容；不要根據它修改實作，並在最終回覆標記 `EVALUATION_CONTAMINATION` 及說明看到的檔案路徑。若沒有發生，最終回覆標記 `SCOPE_CLEAN`。

## 實作規則

- 使用現有原生 HTML、CSS、JavaScript starter。
- 不新增 dependency、CDN、外部字型、圖片或網路 API。
- 不修改 `data/events.json` 或 `tests/public.test.mjs`。
- 所有畫面資料與 KPI 必須來自核心函式運算，不得針對 fixture 硬編碼。
- 完成題目列出的核心函式、畫面、互動、URL 狀態、響應式、可及性和錯誤狀態。
- 在自己的 submission 內執行 `npm test`。
- 可啟動 `npm run dev` 檢查頁面；若有瀏覽器工具，請驗證 1440×900 與 390×844、鍵盤操作及 Console error。
- 更新自己的 `README.md`，記錄架構、執行方式、實際測試結果、可及性設計與已知限制。
- 不要修改題目規格來迎合目前實作。

## 完成條件

持續工作到功能完成且公開測試通過。最後只需回覆：

1. `SCOPE_CLEAN` 或 `EVALUATION_CONTAMINATION`
2. 完成的功能摘要
3. 實際執行的測試與結果
4. 尚存的已知限制

不要在回覆中猜測分數、比較另一個模型或要求查看評分標準。
