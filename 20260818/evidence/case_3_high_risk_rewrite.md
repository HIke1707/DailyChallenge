# 必測案例 3 證據紀錄：大幅重寫與往返翻譯風險測試 (Case 3: High-Risk Rewrites)

**測試日期**：2026 年 8 月 18 日  
**資料來源**：`results.csv` (自動化管線動態匯入，確保 100% 事實同步)  
**測試目的**：評估經歷 30% 局部語意大幅改寫與跨語言往返翻譯（Round-trip Translation）後，文字指標與來源標記之狀態變化。  
**關鍵限制**：即使來源標記訊號在理論上大幅衰減或無法觀察，嚴格禁止推論出「內容非 AI 生成」之錯誤結論。

---

## 1. 30% 局部語意改寫量測數據 (30% Semantic Rewrite)

| 樣本 ID | 編輯距離 | 相似度 (Ratio) | Jaccard 詞彙交集 | 字元數變化 | 官方水印檢驗狀態 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `sample_01_tech_doc` | 205 | **0.7763** | 0.8746 | +13 | `not_verifiable_in_environment` |
| `sample_02_essay` | 168 | **0.8135** | 0.8896 | +15 | `not_verifiable_in_environment` |
| `sample_03_structured` | 127 | **0.8969** | 0.9795 | +6 | `not_verifiable_in_environment` |
| `sample_04_structured` | 38 | **0.7739** | 0.8023 | +6 | `not_verifiable_in_environment` |

**改寫特徵**：
- 句構重組、被動句轉主動句、長句拆解與詞彙置換。

---

## 2. 往返翻譯量測數據 (Round-trip Translation: 繁中 ➔ 英文 ➔ 繁中)

| 樣本 ID | 編輯距離 | 相似度 (Ratio) | Jaccard 詞彙交集 | 字元數變化 | 官方水印檢驗狀態 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `sample_01_tech_doc` | 174 | **0.8742** | 0.8580 | +64 | `not_verifiable_in_environment` |
| `sample_02_essay` | 137 | **0.8379** | 0.8428 | +51 | `not_verifiable_in_environment` |
| `sample_03_structured` | 100 | **0.9085** | 0.9593 | +36 | `not_verifiable_in_environment` |
| `sample_04_structured` | 24 | **0.8018** | 0.7791 | +3 | `not_verifiable_in_environment` |

**往返翻譯特徵**：
- 句型結構與詞彙選擇經歷雙重重構。

---

## 3. 治理層面之核心判定原則 (Governance Principles)

> [!CAUTION]
> **嚴禁邏輯謬誤（Negative Fallacy）**：
> 1. **訊號消失 ≠ 非 AI 產出**：
>    - 當一段 Claude 生成的文字經歷大幅改寫或往返翻譯後，其原始統計水印訊號在理論上極可能已跌破檢定閾值。
>    - 此時的客觀事實僅能表述為：**「在目前的驗證方法與檢定工具下，無法觀察到足夠顯著的來源標記訊號」**。
>    - 絕對**不能**反推為「該內容是由人類原創」或「證明此內容非 AI 產出」。
> 2. **不可將水印作為內容真實性（Factuality）證明**：
>    - 水印僅代表生成參與度（Participation Signal），無法證明內容中陳述的事實是否正確。