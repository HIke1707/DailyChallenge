# Claude 文字水印與內容來源標記韌性測試 (Claude Text Watermark & Provenance Robustness Experiment)

[![Python Standard Library](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![Status](https://img.shields.io/badge/Status-Completed-success.svg)]()
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-brightgreen.svg)]()

本專案建立了一套嚴謹、可重複執行且以證據為導向的 **內容來源標記韌性實驗框架（Provenance Robustness Experiment Framework）**。評估 Claude 生成內容在歷經多種文字變換（複製貼上、標點修改、局部同義詞替換、段落重排、局部大幅改寫、往返翻譯）後，來源標記能否被驗證，並從技術量測延伸至企業內容治理決策。

---

## 🎯 核心原則與不可違背條件 (Design Invariants)

1. **嚴格拒絕捏造（Zero Fabrication Policy）**：
   - Anthropic 官方目前未釋出公開的文字水印 Detector API 或 SDK。本環境如實記錄為 `not_verifiable_in_environment`，絕不以第三方 AI 偵測器冒充官方水印驗證。
2. **文字修改幅度 ≠ 水印訊號強弱**：
   - 相似度指標（Levenshtein 距離、SequenceMatcher、Token Jaccard）僅描述文字被修改的客觀幅度，絕不可主觀代稱為水印強度。
3. **零外部依賴與 100% 可重現性**：
   - 全套管線基於 Python 3 標準庫開發，無須安裝第三方套件，開箱即跑。

---

## 📁 專案結構 (Directory Structure)

```text
20260818/
├── preflight.md                     # 驗證能力前置盤點報告 (Phase 1)
├── transforms.yaml                  # 宣告式變換規則設定 (Phase 3)
├── config.json                      # 變換規則 JSON 格式
├── samples/
│   ├── baseline/                    # 3 組 Baseline 樣本（含完整 Prompt 與詮釋資料）
│   │   ├── sample_01_tech_doc.json / .txt      # 技術架構文章 (~550 字)
│   │   ├── sample_02_essay.json / .txt         # 深度論述短文 (~520 字)
│   │   └── sample_03_structured.json / .txt    # 結構化規範文件 (~500 字)
│   └── transformed/                 # 批次管線自動產生之 27 組變換樣本
├── src/
│   ├── core/
│   │   ├── models.py                # 核心資料模型 (Dataclasses)
│   │   ├── diff_analyzer.py         # 編輯距離與多維相似度分析器
│   │   ├── transformer.py           # 6 大核心變換與同義詞強度曲線引擎
│   │   └── verification_adapter.py  # 證據導向驗證轉接層 (官方/C2PA/幻覺攔截)
│   ├── runner.py                    # 實驗管線自動化主程式
│   ├── matrix_generator.py          # 韌性矩陣報告產生器
│   └── hallucination_test.py        # Case 4：AI 水印偵測幻覺探測腳本
├── evidence/
│   ├── case_1_copy_paste.md         # 必測案例 1 證據紀錄 (複製貼上)
│   ├── case_2_low_degree_edit.md    # 必測案例 2 證據紀錄 (低幅度編輯)
│   ├── case_3_high_risk_rewrite.md  # 必測案例 3 證據紀錄 (高風險改寫/往返翻譯)
│   ├── case_4_hallucination_test.md # 必測案例 4 證據紀錄 (AI 偵測幻覺)
│   └── bonus_file_provenance.md     # 加分項 2 證據紀錄 (檔案來源 C2PA 測試)
├── tests/
│   └── test_pipeline.py             # 完整單元與整合測試套件
├── results.csv                      # 機器可讀實驗結果 CSV (27 筆)
├── results.json                     # 機器可讀實驗結果 JSON
├── robustness-matrix.md             # 韌性矩陣與深度分析報告
├── policy-brief.md                  # 企業內容治理政策簡報 (1~2 頁)
└── README.md                        # 本專案完整說明文件
```

---

## 🚀 快速開始與重現步驟 (Reproduction Guide)

### 1. 執行環境
- **作業系統**：macOS / Linux / Windows
- **Python 版本**：Python 3.9+（支援 3.9 / 3.10 / 3.11 / 3.12+）
- **相依套件**：無（純標準庫：`hashlib`, `json`, `csv`, `difflib`, `re`, `pathlib`, `unittest`）

### 2. 一鍵執行完整實驗管線
清除舊有生成檔案並重新產生 27 筆變換樣本、計算多維指標並匯出結果：
```bash
python3 src/runner.py --clean-run
```

### 3. 執行 Case 4 AI 幻覺探測
驗證針對不存在之 Claude 水印 API 的攔截機制：
```bash
python3 src/hallucination_test.py
```

### 4. 執行自動化測試套件
執行所有單元測試與不變量查核：
```bash
python3 -m unittest discover -s tests -p "test_*.py"
```

---

## 📊 實驗核心產出摘要 (Key Deliverables Summary)

### 1. 變換類型與量測指標 (4 Baselines × 9 Transforms = 36 筆)

| 變換操作 (Transform) | 目標強度 | 平均編輯距離 (Levenshtein) | 平均序列相似度 (Ratio) | 平均 Jaccard 詞彙交集 | 官方驗證狀態 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **copy_paste** | 0% | **0.0** | **1.0000** | **1.0000** | `not_verifiable_in_environment` |
| **punct_whitespace** | 3% | 82.2 | 0.9005 | 0.9607 | `not_verifiable_in_environment` |
| **synonym_10pct** | 10% | 5.2 | 0.9922 | 0.9804 | `not_verifiable_in_environment` |
| **paragraph_reorder** | 15% | 317.2 | 0.5358 | 1.0000 | `not_verifiable_in_environment` |
| **rewrite_30pct** | 30% | 188.2 | 0.8034 | 0.8865 | `not_verifiable_in_environment` |
| **roundtrip_translation** | 45% | 108.8 | 0.8556 | 0.8598 | `not_verifiable_in_environment` |
| **synonym_05pct (Bonus)** | 5% | 3.5 | 0.9941 | 0.9837 | `not_verifiable_in_environment` |
| **synonym_20pct (Bonus)** | 20% | 12.0 | 0.9792 | 0.9520 | `not_verifiable_in_environment` |
| **synonym_40pct (Bonus)** | 40% | 23.0 | 0.9578 | 0.9017 | `not_verifiable_in_environment` |

---

## 📑 核心交付文件導覽

- 🔍 **驗證能力前置盤點**：請參閱 [preflight.md](preflight.md)
- 📈 **韌性矩陣與深度分析**：請參閱 [robustness-matrix.md](robustness-matrix.md)
- 🏢 **企業內容治理政策簡報**：請參閱 [policy-brief.md](policy-brief.md)
- 📋 **必測案例證據紀錄**：
  - Case 1 (複製貼上)：[case_1_copy_paste.md](evidence/case_1_copy_paste.md)
  - Case 2 (低幅度編輯)：[case_2_low_degree_edit.md](evidence/case_2_low_degree_edit.md)
  - Case 3 (大幅改寫/往返翻譯)：[case_3_high_risk_rewrite.md](evidence/case_3_high_risk_rewrite.md)
  - Case 4 (AI 偵測幻覺)：[case_4_hallucination_test.md](evidence/case_4_hallucination_test.md)
  - Bonus 2 (檔案來源 C2PA)：[bonus_file_provenance.md](evidence/bonus_file_provenance.md)

---

## 🔒 資安與隱私宣告
- 本專案未包含任何 API 金鑰、認證 Token 或機密憑證。
- 所有 Baseline 均於隔離環境中由公開模型生成並完成詮釋資料雜湊封裝。
