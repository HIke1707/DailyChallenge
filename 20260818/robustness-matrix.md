# Claude 文字水印與內容來源標記韌性矩陣分析報告 (Robustness Matrix)

**實驗日期**：2026 年 8 月 18 日  
**測試樣本總數**：36 筆測試樣本 (由 results.csv 唯一事實來源自動同步)  
**驗證準則**：嚴格區分「客觀量化觀察 (Observation)」與「理論推論 (Interpretation)」，不以相似度代稱水印強度。

---

## 1. 完整實驗韌性矩陣總表 (Robustness Matrix Overview)

| 樣本 ID | 變換操作名稱 | 目標強度 | 字元編輯距離 | 相似度 (Ratio) | Jaccard 詞彙交集 | 官方驗證狀態 | 驗證方法 | 證據追蹤檔 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| `sample_01_tech_doc` | 純文字複製貼上 (Exact Copy-Paste) | `0%` | 0 | **1.0000** | 1.0000 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_1_copy_paste.md](evidence/case_1_copy_paste.md) |
| `sample_01_tech_doc` | 標點符號與空白微調 (Punctuation & Whitespace Tweak) | `3%` | 124 | **0.9158** | 0.9674 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_01_tech_doc` | 局部同義詞替換 (10% Synonym Substitution) | `10%` | 11 | **0.9907** | 0.9708 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_01_tech_doc` | 段落與條列結構重排 (Paragraph / Section Reordering) | `15%` | 519 | **0.2406** | 1.0000 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_01_tech_doc` | 局部大幅改寫 (30% Semantic Rewrite) | `30%` | 205 | **0.7763** | 0.8746 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_01_tech_doc` | 往返翻譯重構 (Round-trip Translation) | `45%` | 174 | **0.8742** | 0.8580 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_01_tech_doc` | 同義詞替換曲線 - 5% (Synonym Curve 5%) | `5%` | 7 | **0.9939** | 0.9773 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_01_tech_doc` | 同義詞替換曲線 - 20% (Synonym Curve 20%) | `20%` | 26 | **0.9781** | 0.9373 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_01_tech_doc` | 同義詞替換曲線 - 40% (Synonym Curve 40%) | `40%` | 50 | **0.9572** | 0.8899 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_02_essay` | 純文字複製貼上 (Exact Copy-Paste) | `0%` | 0 | **1.0000** | 1.0000 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_1_copy_paste.md](evidence/case_1_copy_paste.md) |
| `sample_02_essay` | 標點符號與空白微調 (Punctuation & Whitespace Tweak) | `3%` | 94 | **0.8929** | 0.9599 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_02_essay` | 局部同義詞替換 (10% Synonym Substitution) | `10%` | 7 | **0.9891** | 0.9798 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_02_essay` | 段落與條列結構重排 (Paragraph / Section Reordering) | `15%` | 477 | **0.3683** | 1.0000 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_02_essay` | 局部大幅改寫 (30% Semantic Rewrite) | `30%` | 168 | **0.8135** | 0.8896 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_02_essay` | 往返翻譯重構 (Round-trip Translation) | `45%` | 137 | **0.8379** | 0.8428 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_02_essay` | 同義詞替換曲線 - 5% (Synonym Curve 5%) | `5%` | 4 | **0.9938** | 0.9864 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_02_essay` | 同義詞替換曲線 - 20% (Synonym Curve 20%) | `20%` | 15 | **0.9767** | 0.9500 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_02_essay` | 同義詞替換曲線 - 40% (Synonym Curve 40%) | `40%` | 29 | **0.9573** | 0.8990 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_03_structured` | 純文字複製貼上 (Exact Copy-Paste) | `0%` | 0 | **1.0000** | 1.0000 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_1_copy_paste.md](evidence/case_1_copy_paste.md) |
| `sample_03_structured` | 標點符號與空白微調 (Punctuation & Whitespace Tweak) | `3%` | 96 | **0.9124** | 0.9659 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_03_structured` | 局部同義詞替換 (10% Synonym Substitution) | `10%` | 2 | **0.9978** | 0.9966 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_03_structured` | 段落與條列結構重排 (Paragraph / Section Reordering) | `15%` | 193 | **0.8914** | 1.0000 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_03_structured` | 局部大幅改寫 (30% Semantic Rewrite) | `30%` | 127 | **0.8969** | 0.9795 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_03_structured` | 往返翻譯重構 (Round-trip Translation) | `45%` | 100 | **0.9085** | 0.9593 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_03_structured` | 同義詞替換曲線 - 5% (Synonym Curve 5%) | `5%` | 2 | **0.9978** | 0.9966 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_03_structured` | 同義詞替換曲線 - 20% (Synonym Curve 20%) | `20%` | 2 | **0.9978** | 0.9966 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_03_structured` | 同義詞替換曲線 - 40% (Synonym Curve 40%) | `40%` | 3 | **0.9972** | 0.9966 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_04_structured` | 純文字複製貼上 (Exact Copy-Paste) | `0%` | 0 | **1.0000** | 1.0000 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_1_copy_paste.md](evidence/case_1_copy_paste.md) |
| `sample_04_structured` | 標點符號與空白微調 (Punctuation & Whitespace Tweak) | `3%` | 15 | **0.8811** | 0.9494 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_04_structured` | 局部同義詞替換 (10% Synonym Substitution) | `10%` | 1 | **0.9911** | 0.9744 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_04_structured` | 段落與條列結構重排 (Paragraph / Section Reordering) | `15%` | 80 | **0.6429** | 1.0000 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_04_structured` | 局部大幅改寫 (30% Semantic Rewrite) | `30%` | 38 | **0.7739** | 0.8023 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_04_structured` | 往返翻譯重構 (Round-trip Translation) | `45%` | 24 | **0.8018** | 0.7791 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md) |
| `sample_04_structured` | 同義詞替換曲線 - 5% (Synonym Curve 5%) | `5%` | 1 | **0.9911** | 0.9744 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_04_structured` | 同義詞替換曲線 - 20% (Synonym Curve 20%) | `20%` | 5 | **0.9643** | 0.9241 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |
| `sample_04_structured` | 同義詞替換曲線 - 40% (Synonym Curve 40%) | `40%` | 10 | **0.9196** | 0.8214 | `not_verifiable_in_environment` | `official_detector_unavailable` | [evidence/case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md) |

---

## 2. 變換類型分層統計與客觀觀察 (Observations)

### A. 複製貼上 (Copy-Paste / Baseline Integrity)
- **觀察數據**：平均編輯距離為 `0.0`，平均相似度為 `1.0000`，平均 Jaccard 為 `1.0000`，SHA-256 雜湊值與原始 Baseline 完全一致。
- **驗證狀態**：`not_verifiable_in_environment`（環境無官方驗證工具）。
- **事實記錄**：內容無任何微觀字元或巨觀段落更動。

### B. 低幅度編輯 (Low-Degree Edits: 標點/空白 & 10% 同義詞替換)
- **標點空白微調**：平均編輯距離 `82.2`，相似度 `0.9005`，Jaccard 詞彙重合率 `0.9607`。文字詞彙語意完全保留，僅格式符號轉換。
- **10% 同義詞替換**：平均編輯距離 `5.2`，相似度 `0.9922`，Jaccard 詞彙交集率 `0.9804`。關鍵字詞被同義詞抽換，但句構骨架未變。

### C. 結構重排 (Paragraph / Section Reordering)
- **觀察數據**：平均編輯距離 `317.2`，相似度 `0.5358`，Jaccard 詞彙交集率高達 `1.0000`。
- **特徵分析**：全文字詞並未流失，但段落間的相鄰 Token 序列與前後文上下文被切斷。

### D. 大幅重寫與往返翻譯 (Semantic Rewrite & Round-trip Translation)
- **30% 語意重寫**：平均編輯距離 `134.5`，相似度降至 `0.8152`，Jaccard 詞彙交集率 `0.8865`。大量句構與長句被拆解重組。
- **往返翻譯 (Round-trip)**：平均編輯距離 `108.8`，相似度降至 `0.8556`，Jaccard 詞彙交集率 `0.8598`。詞彙選擇與語法結構經歷雙重洗牌。

---

## 3. Bonus 1：同義詞替換強度衰減曲線 (Synonym Substitution Strength Curve)

| 擾動強度 | 平均編輯距離 (Levenshtein) | 平均序列相似度 (Ratio) | 平均 Jaccard 詞彙交集 | 統計 Token 破壞程度 (理論推估) |
| :---: | :---: | :---: | :---: | :--- |
| **0% (Copy)** | 0.0 | 1.0000 | 1.0000 | 無破壞 (0% 水印擾動) |
| **5%** | 3.5 | 0.9941 | 0.9837 | 極低擾動 (綠名單統計訊號大部分保留) |
| **10%** | 5.2 | 0.9922 | 0.9804 | 輕度擾動 (局部 n-gram 綠名單斷裂) |
| **20%** | 12.0 | 0.9792 | 0.9520 | 中度擾動 (統計顯著性顯著下降) |
| **40%** | 23.0 | 0.9578 | 0.9017 | 重度破壞 (統計綠名單可能跌破檢定閾值) |

---

## 4. 理論推論與深度解析 (Interpretation & Implications)

> [!IMPORTANT]
> **關鍵原則提醒**：
> 1. **相似度 ≠ 水印強度**：高相似度（如 0.97）僅代表字面修改少，不代表一定能通過統計檢定；反之，結構重排即使 Jaccard=1.0，也可能因打破 Prefix-Token 連鎖而使統計水印失效。
> 2. **不可驗證 ≠ 未標記**：當前環境顯示 `not_verifiable_in_environment` 係因官方未釋出驗證金鑰/API，並非代表該文字生成時未植入統計水印。

### 理論推論分析：
1. **統計式綠名單水印（Kirchenbauer 等架構）之脆弱性**：
   - 統計文字水印仰賴前驅 Token（Prefix）雜湊決定當前 Token 的綠名單分佈。
   - 當進行 **10%~20% 同義詞替換** 時，每次替換不僅改變該詞本身，還會連帶改變其後續 1~2 個 Token 的綠名單雜湊值，造成乘數效應（Cascading Effect）的訊號衰減。
2. **跨語言翻譯之毀滅性影響**：
   - 往返翻譯將整個 Token 空間徹底轉換至目標語言再翻譯回中文，原始 Claude 生成時施加的微觀詞彙機率偏移被完全抹除。
3. **段落重排之非對稱性**：
   - 段落重排保留了段落內部的局部統計訊號，但在段落銜接處造成斷裂。若檢驗演算法採滑動視窗（Sliding Window），局部視窗仍可能保有部分訊號。

---
報告產出完成。