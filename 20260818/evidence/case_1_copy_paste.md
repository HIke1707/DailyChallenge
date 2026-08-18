# 必測案例 1 證據紀錄：純文字複製貼上 (Case 1: Copy-Paste Integrity)

**測試日期**：2026 年 8 月 18 日  
**資料來源**：`results.csv` (自動化管線動態匯入，確保 100% 事實同步)  
**測試目的**：驗證直接從 Claude 生成介面複製貼上至本地文字檔案的完整性與來源標記可驗證狀態。  
**驗證準則**：Pass 標準為具有實際量測證據（Hash/Edit Distance），並明確記錄環境不可驗證狀態，無任何捏造或冒充。

---

## 1. 測試樣本量測數據 (Empirical Measurements)

| 樣本 ID | 原始 SHA-256 | 複製後 SHA-256 | 字元編輯距離 | 相似度 (Ratio) | Jaccard 詞彙交集 | 官方水印檢驗狀態 |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `sample_01_tech_doc` | `3b8f6889000db36f...` | `3b8f6889000db36f...` | **0** | **1.0000** | **1.0000** | `not_verifiable_in_environment` |
| `sample_02_essay` | `4190a1c89d098885...` | `4190a1c89d098885...` | **0** | **1.0000** | **1.0000** | `not_verifiable_in_environment` |
| `sample_03_structured` | `31abeb90685c38d6...` | `31abeb90685c38d6...` | **0** | **1.0000** | **1.0000** | `not_verifiable_in_environment` |
| `sample_04_structured` | `07c29f414d4636d7...` | `07c29f414d4636d7...` | **0** | **1.0000** | **1.0000** | `not_verifiable_in_environment` |

---

## 2. 完整 SHA-256 密碼學雜湊核對清單

- **`sample_01_tech_doc`**:
  - 原始文字 SHA-256: `3b8f6889000db36f500ea4672f5616a220705a81de52e645033893fb0c04fae4`
  - 複製後文字 SHA-256: `3b8f6889000db36f500ea4672f5616a220705a81de52e645033893fb0c04fae4`
  - 位元一致性判定: **完全一致 (PASS)**
- **`sample_02_essay`**:
  - 原始文字 SHA-256: `4190a1c89d098885debf6c75d29cae6d29767619ce690f99d4187c0b3c9bbee1`
  - 複製後文字 SHA-256: `4190a1c89d098885debf6c75d29cae6d29767619ce690f99d4187c0b3c9bbee1`
  - 位元一致性判定: **完全一致 (PASS)**
- **`sample_03_structured`**:
  - 原始文字 SHA-256: `31abeb90685c38d6b4ecfa80945dc21b9696cc6ff93b5886ac61061c77d639a8`
  - 複製後文字 SHA-256: `31abeb90685c38d6b4ecfa80945dc21b9696cc6ff93b5886ac61061c77d639a8`
  - 位元一致性判定: **完全一致 (PASS)**
- **`sample_04_structured`**:
  - 原始文字 SHA-256: `07c29f414d4636d7c46c8d9223a8cb8d4f7c6ef8201b020b545cfba815cf6fee`
  - 複製後文字 SHA-256: `07c29f414d4636d7c46c8d9223a8cb8d4f7c6ef8201b020b545cfba815cf6fee`
  - 位元一致性判定: **完全一致 (PASS)**

---

## 3. 證據鏈審查與事實判定 (Evidence Chain)

1. **位元級一致性 (Bit-level Invariance)**：
   - 複製貼上未對字元編碼（UTF-8）、標點符號或分段換行產生任何變動。SHA-256 雜湊前後 100% 一致，編輯距離為 0。
2. **來源可驗證性 (Provenance Verifiability)**：
   - 官方未公開文字水印解密 API 或本機端驗證工具。
   - 依據實驗規範，狀態明確登錄為 `not_verifiable_in_environment`，驗證方法標記為 `official_detector_unavailable`。
3. **結論**：
   - 本案例符合 Pass 條件：客觀數據完整、零推論膨脹、嚴格遵循可驗證性原則。