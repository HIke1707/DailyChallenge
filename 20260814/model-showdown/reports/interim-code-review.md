# Incident Replay Workbench｜中期驗證紀錄

> 此文件記錄自動與原始碼審查階段；瀏覽器驗證後的正式結果請以 `comparison-report.md` 為準。

驗證日期：2026-08-16（Asia/Taipei）

## 現況結論

- Model A：自動評分 **59 / 65**，暫時領先。
- Model B：自動評分 **57 / 65**。
- 兩者公開測試皆為 **6 / 6**；Model B 自行新增的 extended tests 也為 **6 / 6**。
- 兩份 submission 的既有 fixture 與公開測試均未被修改，且沒有外部 dependency。
- 實作 commit `668dad5` 的變更範圍只包含 `submissions/model-a/**` 與 `submissions/model-b/**`，沒有寫入 evaluation、reports 或共同題目。
- 兩份本機伺服器皆能在獨立 port 啟動，`index.html`、`src/app.mjs`、`data/events.json` 均可正常取得。
- 目前工作階段沒有可用的瀏覽器 backend，人工 35 分維持 pending；現階段不得宣布最終勝者。

Git 只能證明寫入範圍乾淨，不能證明模型從未讀取禁止檔案；repository 沒有檔案讀取 audit log。兩份產物中也沒有找到 evaluator／rubric 內容或 `EVALUATION_CONTAMINATION` 標記。

## 共同正確結果

使用題目提供的 55 筆事件時，兩份核心實作都得到：

- 48 筆 valid events
- 7 筆 rejected events
- 12 個 incidents
- Active：6
- SEV-1 Active：2
- Ack Rate：66.7%
- MTTR：86.7 分鐘
- Top Service：billing

這代表兩者都能正確處理目前 fixture 的亂序、重複、無效事件、resolve 與 reopen 主流程。

## Model A

### 已確認優點

- 原生 checkbox 實作同欄多選，符合 OR；跨欄位透過核心函式形成 AND。
- 使用原生 button、fieldset／legend、details／summary，鍵盤基礎較直接。
- loading、error、empty、事故詳情、event trail 與 rejected reason 都有獨立畫面。
- URL 同步包含 `at`、`q`、`service`、`severity`、`status`、`selected`，並處理 `popstate`。
- 程式較精簡，核心、介面與樣式總量明顯小於 Model B。

### 自動測試失敗

1. 無效曆法日期：`2026-02-30T08:00:00Z` 被 `Date.parse` 正規化後誤判為有效，未回報 `invalid_timestamp`。（4 分 check 未通過）
2. 空白搜尋：`q: " "` 沒有先 trim，因此被視為實際搜尋條件並把清單全部濾掉。（2 分 check 未通過）

### 尚待瀏覽器確認／程式碼觀察

- 畫面標示「Updated latest first」，實際資料仍沿用核心函式的 incident ID 排序，文案與行為不一致。
- range slider 主要在 `change` 後更新；拖曳中的即時回饋需以瀏覽器確認。
- CSS 有 720px／460px 斷點與 reduced-motion 規則，但 390×844 是否真的無溢出仍未實測。

## Model B

### 已確認優點

- 提供播放／暫停、±15 分鐘、回到 Live，比最低規格多一組實用操作。
- 篩選使用可切換的 pill buttons，支援同欄多選；URL 使用 push／replace state 區分離散操作與連續輸入。
- 資料品質使用 modal 與表格呈現，並支援 Escape 關閉。
- 採固定 DOM 骨架加局部更新，相較整頁重繪更有利於保留 slider 與輸入狀態。
- 額外撰寫 extended tests，涵蓋 lifecycle 與真實 fixture。

### 自動測試失敗

1. 無效曆法日期：同樣把 `2026-02-30T08:00:00Z` 誤判為有效。（4 分 check 未通過）
2. 非空字串驗證只檢查 `.length`，沒有 trim；例如 title 為空白字串仍會通過 `incident_created` payload 驗證。（4 分 check 未通過）

### 尚待瀏覽器確認／程式碼觀察

- modal 有 dialog role 與 Escape 關閉，但原始碼未看到開啟時移入 focus、focus trap 或關閉後還原 focus；這可能影響人工可及性分數。
- 預設 Live 或空篩選時會省略對應 query，而非始終寫出題目列出的所有 query key；狀態仍可用預設值還原，但需實際走查上一頁／下一頁行為。
- CSS 內容更完整且有 1080px／768px／420px 斷點，但其篇幅也顯著較大；視覺密度與手機操作仍需實測。

## 評分器公平性修正

首次執行曾要求 normalized payload 必須與輸入 payload 使用不同 object reference。題目只明訂「不得改動輸入」，沒有要求 deep／shallow clone，因此該條件已移除，rubric version 更新為 `2026-08-14.2`。

修正後 A 從 56 調整為 59；B 維持 57。這項修正不替任何模型加上題目外的能力，只移除了題目未明訂的限制。

## 尚未完成的人工驗證

待 browser backend 可用後，仍需以相同環境完成：

1. 1440×900 與 390×844 截圖及水平溢出檢查。
2. slider、500ms playback、到尾端自動停止。
3. 多選 OR、跨欄 AND、搜尋、清除與 selected 消失狀態。
4. URL 重新整理、上一頁／下一頁還原。
5. 全鍵盤操作、focus 可見性、dialog focus、reduced motion。
6. loading、fetch error、empty result、資料品質細節與 Console errors。

完成上述項目後，才填寫 `evaluation/manual-review.json` 並產生 100 分制最終報告。
