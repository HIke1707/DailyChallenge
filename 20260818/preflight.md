# 驗證能力前置盤點報告 (Verification Preflight)

**實驗日期**：2026 年 8 月 18 日  
**專案名稱**：Claude 文字水印與內容來源標記韌性測試 (Claude Text Watermark & Provenance Robustness Experiment)  
**執行原則**：嚴格證據導向（Evidence-Based Verification），絕不捏造不存在的偵測器或假借第三方 AI 偵測器充當官方驗證。

---

## 1. 驗證標記與工具盤點總表

| 檢驗項目類別 | 具體項目 / 機制名稱 | 當前環境可驗證狀態 | 分類說明與依據 | 實測處理原則 |
| :--- | :--- | :---: | :--- | :--- |
| **Claude 文字水印 (Text Watermark)** | Anthropic 官方統計式文字水印 (Statistical Token Sampling Watermark) | **`unavailable`** | Anthropic 於 2026/08/14 公布之文字水印技術屬於服務端生成時對可替換詞彙分布施加統計綠/紅名單訊號。官方目前**未釋出**公開的 Verification API、端點或開源驗證套件。 | 在實驗中嚴格記錄為 `not_verifiable_in_environment`，不自行撰寫模擬偽偵測器，不以臆測填寫狀態。 |
| **官方文字偵測器** | Anthropic Official Claude Watermark Detector Portal / API | **`unavailable`** | 官方未對外提供給一般使用者或 API 用戶進行文字解密比對之公開端點。 | 記錄為 `not_verifiable_in_environment`。 |
| **檔案來源標記 (File Provenance)** | C2PA / JUMBF 數位簽章與來源中繼資料 (Content Credentials) | **`available` (中繼資料檢驗)** / <br>**`unavailable` (官方公鑰伺服器驗證)** | 檔案格式（如 PDF, JPEG, PNG, 音訊等）包含之 C2PA Manifest 或 EXIF/XMP 結構，可透過標準中繼資料剖析器檢查其完整性與簽章塊是否存在；但驗證簽章鏈之 Anthropic 官方公鑰伺服器未整合。 | 可針對檔案進行「中繼資料結構完整性與保存測試（Bonus 2）」，並區分於純文字水印。 |
| **第三方 AI 偵測器** | GPTZero, Sapling, ZeroGPT, CopyLeaks 等基於 Perplexity / Burstiness 之統計偵測器 | **`unsupported` (不可作為官方依據)** | 第三方偵測器僅能計算文字困惑度與統計機率，無法驗證 Anthropic 的專屬密鑰統計綠名單水印，且具高誤判率（False Positive / False Negative）。 | 嚴格禁止將第三方分數轉換為 Claude Watermark 偵測結果。 |
| **AI 幻想之 API / SDK** | 假想的 `anthropic.watermark.verify()`、`claude-detector-sdk` 等 | **`unsupported` (捏造端點)** | 大型語言模型常因訓練資料推論而幻想出虛構的水印檢查函式。 | 在 Case 4 中進行幻覺測試並分類為 `hallucination_detected` / `unsupported`。 |

---

## 2. 核心問題釐清

### Q1: 今天到底有哪些 Marker 能夠在本地環境實測？
1. **純文字層級 (Text Level)**：
   - 目前環境**無法實測**官方文字水印之有無（狀態：`not_verifiable_in_environment`）。
   - 可精確量測的是「**文字變換幅度指標（Text Modification Metrics）**」，包含：
     - Levenshtein Edit Distance（字元級編輯距離）
     - Normalized Character Similarity（字元相似度比率）
     - Sequence Matcher Ratio（序列匹配度）
     - Word-level Jaccard Similarity & Token Overlap（詞彙層級交集率）
     - SHA-256 Hash 完整性變更
2. **檔案層級 (File Level - Bonus 2)**：
   - 可實測檔案在歷經改名 (Rename)、二度儲存 (Re-save)、格式轉換 (Format Conversion)、純文字提取後，檔案內部的 Provenance Metadata / EXIF / XMP 結構是否完整或遭抹除。

### Q2: 哪些只能進行研究與推論，不能宣告為「實測驗證」？
- **不能宣告**：任何宣稱「此文字通過/未通過 Claude 水印驗證」的硬性二元判斷。
- **合理研究**：基於統計水印理論架構（如 Kirchenbauer et al. 綠名單機制），分析不同編輯操作（如 10% 同義詞替換 vs 30% 重寫 vs 往返翻譯）對統計訊號可能造成的理論衰減，並產出企業治理政策建議。

---

## 3. 實作架構設計準則 (Design Invariants)
1. **Verification Adapter 抽象層**：
   - 介面回傳值定義為：`VerificationReport(status="not_verifiable_in_environment", verification_method="anthropic_official_api_unreleased", notes=...)`。
2. **禁止任何假判斷**：
   - 不使用隨機亂數或相似度門檻偽造 `detected` 或 `not_detected`。
3. **區隔 Observation 與 Interpretation**：
   - **Observation（觀察事實）**：精確量化之 Edit Distance、Similarity Score、Hash、Token Overlap。
   - **Interpretation（理論推論）**：該變換操作對統計綠名單結構的理論破壞程度與企業治理影響。
