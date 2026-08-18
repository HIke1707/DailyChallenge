# 加分項 2 證據紀錄：檔案來源標記與 C2PA 韌性測試 (Bonus 2: File Provenance Track)

**測試日期**：2026 年 8 月 18 日  
**測試目的**：測試包含來源標記（C2PA Manifest / XMP / EXIF）之檔案在經歷重新命名（Rename）、二次儲存（Re-save）、格式轉換（Format Conversion）與純文字擷取（Text Extraction）後，中繼資料的保存完整性。  
**架構區隔**：本測試針對「容器層級（Container/File Metadata）」進行驗證，與「字面統計層級（Statistical Text Watermark）」嚴格分開分析。

---

## 1. 檔案操作生命週期與中繼資料保留矩陣

| 檔案操作情境 (Operation) | 模擬操作手法 | C2PA Manifest 保留狀態 | EXIF / XMP 雜湊一致性 | 檔案來源驗證可信度 | 說明 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **1. 檔案改名 (Rename)** | `document.pdf` ➔ `archived_doc_v2.pdf` | **完全保留** | 檔案 Payload Hash 不變 | **高** | 單純修改檔案系統名稱不會改動檔案內容與 JUMBF Manifest 區塊。 |
| **2. 二次儲存 (Re-save)** | 以一般編輯器（如 Preview / Word）開啟並覆寫儲存 | **部分丟失 / 簽章失效** | 檔案 Hash 改變，部分編輯器剝離非標準區塊 | **中~低** | 多數消費級軟體不支援 C2PA 簽章增量更新，會破壞簽章鏈。 |
| **3. 格式轉換 (Format Convert)** | PDF / DOCX ➔ 純文字 TXT 或 Markdown | **完全抹除 (Stripped)** | 檔案容器結構完全重構 | **無 (None)** | 格式轉換徹底銷毀檔案容器元資料，C2PA 憑證無法穿越純文字管道。 |
| **4. 截圖 / 影印重建 (Optical / Screen Capture)** | 螢幕截圖或重新拍照存為 PNG/JPEG | **完全抹除 (Stripped)** | 像素數據重編碼，無原始中繼資料 | **無 (None)** | 像素與字元轉換使所有檔案層級簽章失效。 |

---

## 2. 實測結論與架構區隔 (Analysis)

1. **檔案來源標記（File Provenance）的優缺點**：
   - **優點**：具備密碼學非對稱數位簽章（PKI），只要檔案容器未被破壞，即可提供防竄改且高確信度的簽署者身份證明。
   - **缺點**：極度脆弱於「跨格式傳播」（Air-gap / Copy-Paste / Format Conversion），任何純文字複製都會瞬間摧毀 C2PA 憑證。
2. **純文字水印（Text Watermark）與檔案來源（File Provenance）的互補性**：
   - 純文字水印隨文字本身傳播，能抵抗純文字複製貼上與輕度編輯；
   - 檔案來源標記隨容器傳播，能提供防偽簽章與嚴謹的法律效力；
   - 兩者屬於不同防禦縱深，不可互相替代。
