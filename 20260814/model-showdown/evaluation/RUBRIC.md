# 評分規則（交卷後使用）

總分 100 分。自動評分先執行，瀏覽器走查後才產生最終名次。

## A. 核心正確性：50 分，自動

- 模組可載入且 export 完整：2
- normalizeEvents：15
- reduceIncidentEvents：15
- applyFilters：6
- calculateMetrics：7
- buildDashboard 整合：5

自動案例不依賴題目附的 `data/events.json`，因此只對範例資料硬編碼不會得分。每個 check 都獨立計分，報告會列出失敗原因。

## B. 提交與產品接線：15 分，自動靜態檢查

- 必要檔案、不可改動的 fixture／公開測試、零外部 dependency：5
- 真實資料讀取、核心函式接線、URL 歷史狀態、時間軸播放：5
- HTML 可及性訊號、responsive／reduced-motion CSS、README：5

這一區只表示「具備接受瀏覽器走查的條件」，不取代實際操作。

## C. 瀏覽器走查：35 分，盲測

在不知道 A／B 對應模型名稱的前提下，以相同資料、瀏覽器與 viewport 評分：

- `visualHierarchy`（0–10）：資訊層級、密度、掃讀性、severity／status 視覺語言。
- `interactions`（0–10）：回放、播放、複合篩選、選取失效、URL 還原及資料品質操作。
- `responsive`（0–5）：1440×900 與 390×844 都可完整操作，無水平溢出。
- `accessibility`（0–5）：鍵盤順序、focus、label／名稱、狀態可理解，reduced motion。
- `resilience`（0–5）：loading、error、empty、invalid data 與 console 狀態。

走查結果寫入由 template 複製出的 `manual-review.json`，再重跑 evaluator 合併報告。分數必須是範圍內的整數或半分，並附可觀察證據。

## 平手規則

1. 總分較高者勝。
2. 同分時，核心正確性較高者勝。
3. 再同分時，interactions 較高者勝。
4. 仍同分則並列，不以模型品牌或耗時主觀破同分。

## 不評分項目

- 模型聲稱自己完成了什麼。
- 使用大量程式碼、特定框架風格或單純檔案數量。
- 未由外部計時器一致記錄的完成時間。
- 未列入題目的個人美術偏好。
