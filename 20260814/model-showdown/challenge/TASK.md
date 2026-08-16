# 題目：Incident Replay Workbench

你要製作一個單頁「事故事件回放工作台」。它讀取一份刻意包含亂序、重複與無效資料的事件流，讓值班人員拖動時間軸，重建任一時刻的事故狀態。

這不是只看外觀的切版題。畫面上的事故、KPI、篩選結果與資料品質數字都必須由 `src/core.mjs` 的真實運算結果產生。

## 交付限制

- 所有修改只能位於你被指定的 `SUBMISSION_DIR`。
- 不可讀取或修改 `evaluation/`、`reports/` 或另一個模型的 submission。
- 使用 starter 內的原生 HTML、CSS、JavaScript；不得新增 dependency、外部 CDN、字型、圖片或網路 API。
- 頁面必須透過 `npm run dev` 啟動，並可在最新版 Chromium 使用。
- 不得更名或移除既有檔案；可以在 submission 內新增檔案。
- 不得硬編碼資料集的 KPI 或事故清單。

## 必做畫面

請自行決定視覺風格，但至少包含：

1. 頁首：產品名稱、目前回放時間與資料健康狀態。
2. KPI 區：Active、SEV-1 Active、Ack Rate、Mean Time to Resolve、Top Service。
3. 回放控制：range slider、最早／最晚時間、播放／暫停、回到 Live。
4. 篩選區：關鍵字、service、severity、status；可一鍵清除。
5. 事故清單：清楚呈現 severity、status、service、owner 與最後更新時間，並能選取事故。
6. 詳情區：選取事故後顯示完整欄位與該事故截至目前回放時間的事件軌跡。
7. 資料品質區：顯示被拒絕事件數，並能查看拒絕原因；不可讓無效事件污染 KPI。
8. Empty state、載入狀態與資料讀取失敗狀態。

## 必做互動

- 改變回放時間後，事故狀態、列表、軌跡與 KPI 必須同步更新。
- 播放速度固定為每 500ms 前進 15 分鐘；到達最後事件時自動停止。
- 篩選是交集（AND）；同一欄位內的多選值是聯集（OR）。
- 搜尋不分大小寫，涵蓋 incident ID、title、service 與 owner。
- 選取的事故若因篩選或時間回放而消失，詳情區應進入明確空狀態，不可顯示過期資料。
- 將 `at`、`q`、`service`、`severity`、`status`、`selected` 寫入 URL query；重新整理及瀏覽器上一頁／下一頁後應還原狀態。
- 所有按鈕、表單與事故選取都能只用鍵盤完成；focus 樣式不可被移除。
- 在 390×844 與 1440×900 都不得水平溢出或遮住主要操作。
- 尊重 `prefers-reduced-motion`。

## 核心函式契約

`src/core.mjs` 必須 export 以下函式：

```js
normalizeEvents(rawEvents)
reduceIncidentEvents(validEvents, atMs)
applyFilters(incidents, filters)
calculateMetrics(incidents)
buildDashboard(rawEvents, filters, atMs)
```

### 1. `normalizeEvents(rawEvents)`

回傳：

```js
{
  validEvents: [
    { eventId, incidentId, at, atMs, type, payload }
  ],
  rejectedEvents: [
    { index, eventId, reason }
  ]
}
```

規則：

- 非陣列輸入視為空陣列。
- 每筆必須有非空字串 `eventId`、`incidentId`、`type`、`at`，以及非陣列 object `payload`。
- `at` 必須是含 `Z` 或 `±HH:mm` 時區的有效 ISO-8601 字串。
- 支援的 type 與 payload：
  - `incident_created`：非空 `title`、非空 `service`、合法 `severity`。
  - `owner_assigned`：非空 `owner`。
  - `severity_changed`：合法 `severity`。
  - `incident_acknowledged`、`incident_resolved`、`incident_reopened`：無額外欄位。
  - `note_added`：非空 `text`。
- 合法 severity 僅有 `SEV-1`、`SEV-2`、`SEV-3`、`SEV-4`。
- 驗證順序為 `invalid_shape`、`invalid_timestamp`、`unsupported_type`、`invalid_payload`、`duplicate_event_id`；每筆只回報第一個原因。
- 只有完全合法的事件會占用 `eventId`。同一 ID 的後續合法事件以 `duplicate_event_id` 拒絕，來源中第一筆合法事件保留。
- `validEvents` 先依 `atMs` 升冪，再依 `eventId` 使用字典序升冪；不得改動輸入資料。
- `rejectedEvents.eventId` 在無合法非空 ID 時為 `null`。

### 2. `reduceIncidentEvents(validEvents, atMs)`

- 只處理 `event.atMs <= atMs` 的事件；`atMs` 省略或非有限數字時視為 `Infinity`。
- 尚未出現 `incident_created` 的其他事件忽略。
- 同一 incident 的第二個 `incident_created` 忽略。
- create 後的事件依序套用；每個已套用事件都更新 `updatedAt`。
- ack：若尚未 ack，設定 `acknowledgedAt`；事故未 resolved 時，status 變為 `acknowledged`。
- resolve：status 變為 `resolved` 並以該事件更新 `resolvedAt`。
- reopen：status 變為 `open`、`resolvedAt` 清為 `null`，但保留第一次 `acknowledgedAt`。
- note 加入 `{ at, text }`；owner 與 severity 事件更新對應欄位。
- 結果依 `incidentId` 字典序升冪，形狀固定為：

```js
{
  incidentId,
  title,
  service,
  severity,
  owner,              // 未指派時 null
  status,             // open | acknowledged | resolved
  createdAt,
  acknowledgedAt,     // 尚未 ack 時 null
  resolvedAt,         // 尚未／不再 resolved 時 null
  updatedAt,
  notes: [{ at, text }]
}
```

### 3. `applyFilters(incidents, filters)`

- `filters` 可省略；`q` 是字串，`services`、`severities`、`statuses` 是字串陣列。
- 空值或空陣列代表該欄位不篩選。
- 不分大小寫的 `q` 搜尋 incident ID、title、service、owner。
- 不同欄位使用 AND；同一陣列內使用 OR。
- 保留輸入順序，且不得改動輸入資料。

### 4. `calculateMetrics(incidents)`

回傳：

```js
{
  totalCount,
  activeCount,
  criticalActiveCount,
  acknowledgementRatePct,
  meanTimeToResolveMinutes,
  topService
}
```

- active 是 status 不等於 `resolved`；critical active 是 active 且 severity 為 `SEV-1`。
- ack rate = 有 `acknowledgedAt` 的事故數 / 全部事故數 × 100。
- MTTR 只計算目前 resolved 且有合法 created/resolved 時間的事故，以 `(resolvedAt - createdAt)` 分鐘計算。
- 百分比與 MTTR 四捨五入至小數 1 位；沒有分母時為 `0`。
- top service 以事故數最多者為準；同數時取字典序較前者；空集合為 `null`。

### 5. `buildDashboard(rawEvents, filters, atMs)`

依序呼叫前四個概念，metrics 必須針對「時間切片後且已套用篩選」的 incidents 計算，回傳：

```js
{ incidents, metrics, rejectedEvents }
```

## 完成定義

- `npm test` 公開測試全數通過。
- `npm run dev` 可開啟實際畫面，Console 無 error。
- 所有必做區域與互動完成，非靜態假畫面。
- `README.md` 說明架構、操作方式、測試結果、已知限制。
- 不修改 `data/events.json` 或 `tests/public.test.mjs`。
