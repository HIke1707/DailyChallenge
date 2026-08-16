# Incident Replay Workbench

## 架構

- `src/core.mjs` 是純函式 replay model：負責事件正規化與拒絕原因、時間切片 reducer、AND/OR 篩選、KPI 計算，以及整合用的 `buildDashboard`。
- `src/app.mjs` 載入 `data/events.json`，以 URL query 還原工作台狀態，將 dashboard 結果渲染成時間軸、KPI、事故清單、事故詳情與資料品質面板。
- `src/styles.css` 使用原生 CSS 建立深色 control-room 介面、狀態色彩、focus 樣式與 1440px / 390px 兩種響應式佈局。

所有 KPI、事故狀態、篩選清單與拒絕事件數都由 `src/core.mjs` 的運算結果產生；無效事件不會進入 reducer 或 KPI。

## 執行

在本目錄執行：

```bash
npm test
npm run dev
```

預設會在 `http://127.0.0.1:4173` 提供頁面。時間軸播放每 500ms 前進 15 分鐘，抵達最後一筆有效事件時自動停止。搜尋與多選篩選會同步寫入 `at`、`q`、`service`、`severity`、`status`、`selected` query；瀏覽器上一頁／下一頁可還原工作台狀態。

## 測試結果

- `npm test`：公開測試 6/6 通過。
- `node --check src/app.mjs && node --check src/core.mjs`：通過。
- `npm run dev`：以獨立本地埠 4317 啟動成功；HTML、app module 與 55 筆事件資料 endpoint 可取得。
- in-app Browser：目前環境沒有可用 browser backend，因此無法進行實際 viewport 截圖或 console 面板檢查。

## 可及性與響應式

互動控制使用原生 button、input、fieldset/legend、details/summary 與語意化標題；事故卡是可用鍵盤啟動的 button，篩選與時間軸都有可見 label，載入／錯誤／詳情空狀態使用 live region。所有 focus outline 都保留並強化。桌面版採三欄工作區，窄螢幕會堆疊成單欄；390px 寬度下 KPI、事件軌跡與主要操作仍可用。CSS 會尊重 `prefers-reduced-motion`。

## 已知限制

- 本地檢查環境沒有可用的 in-app Browser backend，因此沒有完成瀏覽器實際 console error 與像素級 viewport 驗證。
- 介面使用 UTC 顯示事件時間，未提供時區切換。
- URL 多選值以逗號分隔寫入 query；資料值若未來包含逗號，需要改用更嚴格的編碼格式。
