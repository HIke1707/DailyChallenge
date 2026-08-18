# 必測案例 2 證據紀錄：低幅度編輯邊界測試 (Case 2: Low-Degree Edits)

**測試日期**：2026 年 8 月 18 日  
**測試目的**：量化檢驗在「標點/空白微調」與「約 10% 局部同義詞改寫」情境下，文字修改幅度指標與來源標記之可觀察狀態，避免主觀臆測。  
**驗證準則**：完整記錄 Levenshtein 距離、相似度比率、Jaccard 詞彙交集率與客觀狀態。

---

## 1. 標點與空白微調量測數據 (Punctuation & Whitespace Tweaks)

| 樣本 ID | 編輯距離 | 相似度 (Ratio) | Jaccard 詞彙交集 | 字數變化 | 官方水印檢驗狀態 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `sample_01_tech_doc` | 91 | **0.9311** | 0.9856 | 0 | `not_verifiable_in_environment` |
| `sample_02_essay` | 68 | **0.9211** | 0.9824 | 0 | `not_verifiable_in_environment` |
| `sample_03_structured` | 59 | **0.9431** | 0.9872 | 0 | `not_verifiable_in_environment` |

**觀察重點**：
- 僅轉換全形標點為半形標點並調整空格。
- Jaccard 詞彙交集率高達 `0.98+`，實質中文詞彙完全沒有變動。

---

## 2. 10% 同義詞改寫量測數據 (10% Synonym Substitution)

| 樣本 ID | 編輯距離 | 相似度 (Ratio) | Jaccard 詞彙交集 | 替換詞彙比例 (估算) | 官方水印檢驗狀態 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `sample_01_tech_doc` | 44 | **0.9636** | 0.8240 | ~9.8% | `not_verifiable_in_environment` |
| `sample_02_essay` | 33 | **0.9518** | 0.8195 | ~10.2% | `not_verifiable_in_environment` |
| `sample_03_structured` | 32 | **0.9555** | 0.8286 | ~9.5% | `not_verifiable_in_environment` |

**具體替換詞彙對照範例**：
- `確保` ➔ `保障`
- `核心` ➔ `關鍵`
- `抽象` ➔ `深奧`
- `複雜` ➔ `繁瑣`
- `迅速` ➔ `快速`
- `普及` ➔ `風行`
- `廢棄` ➔ `汰除`

---

## 3. 客觀量測結論 (Factual Findings)

1. **量化邊界確立**：
   - 標點符號調整影響的是字元層級字面比對（相似度降至 ~0.93），但語意與詞彙幾乎未受影響（Jaccard 0.98+）。
   - 10% 同義詞替換在字面相似度上仍高達 0.95+，但在詞彙層級的 Jaccard 交集率已明顯降至 0.82 左右。
2. **統計水印理論影響 (Theoretical Implication)**：
   - 依據統計綠名單理論，被替換之 10% 詞彙將失去官方綠名單偏好，且連帶影響緊接在後的 1~2 個 Token 的 Prefix Hash。因此雖然整體文字可讀性極為接近，但統計檢定 z-score 理論上將呈現顯著下降。
