# 必測案例 1 證據紀錄：純文字複製貼上 (Case 1: Copy-Paste Integrity)

**測試日期**：2026 年 8 月 18 日  
**測試目的**：驗證直接從 Claude 生成介面複製貼上至本地文字檔案的完整性與來源標記可驗證狀態。  
**驗證準則**：Pass 標準為具有實際量測證據（Hash/Edit Distance），並明確記錄環境不可驗證狀態，無任何捏造或冒充。

---

## 1. 測試樣本量測數據 (Empirical Measurements)

| 樣本 ID | 原始 SHA-256 | 複製後 SHA-256 | 字元編輯距離 | 相似度 (Ratio) | Jaccard 詞彙交集 | 官方水印檢驗狀態 |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `sample_01_tech_doc` | `4b971a81dc1c2514c330f6deab4dd17e29cb1f2780bb29bbfd2d1fe1c8e19e07` | `4b971a81dc1c2514c330f6deab4dd17e29cb1f2780bb29bbfd2d1fe1c8e19e07` | **0** | **1.0000** | **1.0000** | `not_verifiable_in_environment` |
| `sample_02_essay` | `df0613271be9eb8716bf042b36ae22ea7ca94f51458ea618ce5c24e3933c4323` | `df0613271be9eb8716bf042b36ae22ea7ca94f51458ea618ce5c24e3933c4323` | **0** | **1.0000** | **1.0000** | `not_verifiable_in_environment` |
| `sample_03_structured` | `43abcf8e67a07742bc56ee89d97a9cf6d22ef146ff9bce0fcb7dafe7be54394e` | `43abcf8e67a07742bc56ee89d97a9cf6d22ef146ff9bce0fcb7dafe7be54394e` | **0** | **1.0000** | **1.0000** | `not_verifiable_in_environment` |

---

## 2. 證據鏈審查與事實判定 (Evidence Chain)

1. **位元級一致性 (Bit-level Invariance)**：
   - 複製貼上未對字元編碼（UTF-8）、標點符號或分段換行產生任何變動。SHA-256 雜湊前後一致。
2. **來源可驗證性 (Provenance Verifiability)**：
   - 官方未公開文字水印解密 API 或本機端驗證工具。
   - 依據實驗規範，狀態明確登錄為 `not_verifiable_in_environment`。
3. **結論**：
   - 本案例符合 Pass 條件：客觀數據完整、零推論膨脹、嚴格遵循可驗證性原則。
