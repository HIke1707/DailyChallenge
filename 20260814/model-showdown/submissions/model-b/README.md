# Incident Replay Workbench (Model B)

A single-page incident replay and time-travel simulation workbench built with vanilla ES modules, HTML5, and CSS3. The workbench normalizes unordered, duplicated, and malformed raw event streams and dynamically reconstructs the state of all incidents and operational KPIs at any given replay timestamp.

---

## 1. 架構與主要設計決策 (Architecture & Design Decisions)

### 核心模組架構 (`src/core.mjs`)
- **無 DOM 依賴的純函數核心**：所有資料清洗、狀態推導、篩選計算與指標彙整皆封裝於純函數，保證在 Node.js 測試環境與瀏覽器端完全一致。
- **正規化管線 (`normalizeEvents`)**：
  - 嚴格依照題目順序進行多階段驗證：`invalid_shape` → `invalid_timestamp` → `unsupported_type` → `invalid_payload` → `duplicate_event_id`。
  - 只有完全通過前述校驗之事件才會占用 `eventId`。
  - 對 `validEvents` 按時間戳 (`atMs`) 升冪排序，同時間戳按 `eventId` 字典序升冪，且不變更原始輸入。
- **事故生命週期狀態還原 (`reduceIncidentEvents`)**：
  - 時間切片過濾（`event.atMs <= atMs`）。
  - 以第一筆合法 `incident_created` 為建立依據，後續重複建立事件忽略；未建立前的其他操作事件忽略。
  - 實作完整狀態轉換：建立 (`open`) → 指派 (`owner_assigned`) → 升降級 (`severity_changed`) → 認領 (`incident_acknowledged`) → 解決 (`incident_resolved`) → 重啟 (`incident_reopened`) → 記錄 (`note_added`)。
  - 重啟時將 `resolvedAt` 重設為 `null` 並保留第一次 `acknowledgedAt`。
  - 結果按 `incidentId` 字典序升冪排序。
- **交集／聯集複合篩選 (`applyFilters`)**：
  - 多欄位採用 AND 邏輯，同欄位內多值採用 OR 邏輯。
  - 不分大小寫搜尋 `incidentId`、`title`、`service`、`owner`。
- **指標計算 (`calculateMetrics`)**：
  - `activeCount` 與 `criticalActiveCount` (SEV-1 active)。
  - `acknowledgementRatePct`（四捨五入至小數第 1 位）。
  - `meanTimeToResolveMinutes`（僅計算目前 `resolved` 且具備合法起訖時間之事故，四捨五入至小數第 1 位）。
  - `topService`（事故量最多之 service，同量時取字典序較前者）。
- **儀表板總成 (`buildDashboard`)**：依序調用正規化、時間切片還原、篩選與指標計算。

### 前端互動架構 (`src/app.mjs` & `src/styles.css`)
- **高效能狀態渲染與事件委派**：一次性建立語意化 DOM 骨架，在時間推進或篩選時進行局部精確更新，保留使用者輸入焦點與游標位置。
- **時間回放控制器**：支援播放／暫停（每 500ms 前進 15 分鐘）、滑桿拖曳、-15m / +15m 單步跳轉、一鍵回到 Live 狀態。
- **雙向 URL 狀態同步**：同步 `at`、`q`、`service`、`severity`、`status`、`selected` 至 URL Query 參數，完整支援瀏覽器上一頁／下一頁（`popstate`）。
- **資料品質隔離檢視**：獨立呈現被隔離的無效事件總數、占比與拒絕原因清單，防止 KPI 受污染。

---

## 2. 執行方式 (How to Run)

### 啟動開發伺服器
```bash
npm run dev
```
啟動後於瀏覽器開啟 `http://127.0.0.1:4173/`。

### 執行單元測試
```bash
npm test
```

---

## 3. 測試命令與實際結果 (Test Execution & Results)

### 公開測試執行
```bash
$ npm test

> incident-replay-workbench-submission@1.0.0 test
> node --test tests/public.test.mjs

TAP version 13
# Subtest: normalizeEvents sorts without mutating input
ok 1 - normalizeEvents sorts without mutating input
# Subtest: normalizeEvents rejects a later duplicate and an invalid payload
ok 2 - normalizeEvents rejects a later duplicate and an invalid payload
# Subtest: reduceIncidentEvents respects replay time
ok 3 - reduceIncidentEvents respects replay time
# Subtest: filters use AND between fields and search owner
ok 4 - filters use AND between fields and search owner
# Subtest: calculateMetrics follows the documented rounding and tie break
ok 5 - calculateMetrics follows the documented rounding and tie break
# Subtest: buildDashboard calculates metrics after filters
ok 6 - buildDashboard calculates metrics after filters
1..6
# tests 6
# pass 6
# fail 0
```

### 延伸測試執行 (`tests/public.test.mjs` + `tests/extended.test.mjs`)
- 包含邊界條件（null 輸入、非法時區、Payload 結構異常、重啟生命週期、真實資料集驗證）：**12 / 12 全部通過**。

---

## 4. 可及性與響應式設計說明 (Accessibility & Responsive Design)

1. **鍵盤可操作性**：
   - 所有按鈕、輸入框、篩選 Pill 及事故清單項目皆可透過 `Tab` 導航，並支援 `Enter` / `Space` 選取。
   - 保持顯眼的 `:focus-visible` 焦點外框。
   - 支援 `Escape` 鍵快速關閉資料品質對話框。
2. **語意化標籤與 ARIA 屬性**：
   - 採用 `<header>`, `<main>`, `<section>`, `<aside>`, `<time>`, `<article>` 等語意標籤。
   - 配置 `role="region"`, `role="listbox"`, `role="option"`, `aria-selected`, `aria-pressed`, `aria-live="polite"`，方便螢幕閱讀器掌握即時指標與回放變化。
3. **無障礙色彩對比與動態適配**：
   - 顏色對比度符合 WCAG AA 規範。
   - 完整支援 `prefers-reduced-motion: reduce`，在使用者開啟減少動態效果時自動關閉動畫過渡。
4. **全響應式佈局**：
   - 支援 Desktop (1440×900) 雙欄並排（事故清單 + 詳情檢視）。
   - 支援 Mobile (390×844) 單欄堆疊，觸控點符合大於 44px 之人體工學要求，保證無任何水平溢出 (no horizontal overflow)。

---

## 5. 已知限制 (Known Limitations)

1. **本機靜態檔案載入**：依賴以 HTTP 協定載入 `data/events.json`，需透過本機伺服器 (`npm run dev`) 執行，直接以 `file://` 開啟會受限於瀏覽器 CORS 安全性策略。
2. **事件量級**：目前設計針對數千筆事件之單頁重放，若事件流擴展至十萬筆以上，需引入虛擬滾動 (Virtual Scrolling) 或 Web Worker 運算以保持 60 FPS 流暢度。
