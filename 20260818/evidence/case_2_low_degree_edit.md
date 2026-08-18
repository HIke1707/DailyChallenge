# 必測案例 2 證據紀錄：低幅度編輯邊界測試 (Case 2: Low-Degree Edits)

**測試日期**：2026 年 8 月 18 日  
**資料來源**：`results.csv` (自動化管線動態匯入，確保 100% 事實同步)  
**測試目的**：量化檢驗在「標點/空白微調」與「約 10% 局部同義詞改寫」情境下，文字修改幅度指標與來源標記之可觀察狀態，避免主觀臆測。  
**驗證準則**：完整記錄 Levenshtein 距離、相似度比率、Jaccard 詞彙交集率與客觀狀態。

---

## 1. 標點與空白微調量測數據 (Punctuation & Whitespace Tweaks)

| 樣本 ID | 編輯距離 | 相似度 (Ratio) | Jaccard 詞彙交集 | 字數變化 (字元) | 官方水印檢驗狀態 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `sample_01_tech_doc` | 124 | **0.9158** | 0.9674 | +62 | `not_verifiable_in_environment` |
| `sample_02_essay` | 94 | **0.8929** | 0.9599 | +47 | `not_verifiable_in_environment` |
| `sample_03_structured` | 96 | **0.9124** | 0.9659 | +37 | `not_verifiable_in_environment` |
| `sample_04_structured` | 15 | **0.8811** | 0.9494 | +3 | `not_verifiable_in_environment` |

**觀察重點**：
- 僅轉換全形標點為半形標點並調整空格。
- 詞彙結構基本保留，相似度維持在 0.88 ~ 0.94。

---

## 2. 10% 同義詞改寫量測數據 (10% Synonym Substitution)

| 樣本 ID | 編輯距離 | 相似度 (Ratio) | Jaccard 詞彙交集 | 字數變化 (字元) | 官方水印檢驗狀態 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `sample_01_tech_doc` | 11 | **0.9907** | 0.9708 | +0 | `not_verifiable_in_environment` |
| `sample_02_essay` | 7 | **0.9891** | 0.9798 | +0 | `not_verifiable_in_environment` |
| `sample_03_structured` | 2 | **0.9978** | 0.9966 | +0 | `not_verifiable_in_environment` |
| `sample_04_structured` | 1 | **0.9911** | 0.9744 | +0 | `not_verifiable_in_environment` |

**具體替換詞彙對照範例**：
- `確保` ➔ `保障`
- `核心` ➔ `關鍵`
- `抽象` ➔ `深奧`
- `複雜` ➔ `繁瑣`
- `普及` ➔ `風行`
- `破曉` ➔ `拂曉`

---

## 3. 客觀量測結論 (Factual Findings)

1. **量化邊界確立**：
   - 標點符號調整主要改變符號字元，文字詞彙結構高度保留。
   - 10% 同義詞替換在編輯距離與詞彙層級呈現階梯式改變。
2. **統計水印理論影響 (Theoretical Implication - Supported Inference)**：
   - 依據統計綠名單理論，被替換之詞彙將連帶影響緊接在後 Token 的前驅雜湊值，造成統計顯著性衰減。