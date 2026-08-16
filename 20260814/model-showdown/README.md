# 雙模型實作比較實驗

這個資料夾把「出題、兩份隔離實作、獨立驗證、比較報告」拆開，避免兩個模型互相覆蓋，也讓之後的驗證可以重跑。

## 資料夾

```text
model-showdown/
├── challenge/                 # 兩個模型唯一共用的題目與 starter
│   ├── TASK.md
│   └── starter/
├── submissions/
│   ├── model-a/               # 模型 A 只能修改這裡
│   └── model-b/               # 模型 B 只能修改這裡
├── evaluation/                # 獨立評分器；實作模型不可讀或修改
├── reports/                   # 驗證後產生的比較報告
└── scripts/
    ├── prepare.mjs
    └── evaluate.mjs
```

## 建議流程

需要 Node.js 20 以上，不需安裝 npm 套件。

1. 目前 repository 已準備好兩份完全相同的 starter，可直接從第 2 步開始。只有在 submission 資料夾重新清空後需要重建時，才執行：

   ```bash
   node 20260814/model-showdown/scripts/prepare.mjs both
   ```

2. 在兩個全新的模型對話中，分別完整貼上對應的盲測 Prompt。不要把另一個模型的輸出或驗證器內容放進對話。

   - [Model A Prompt](operator-prompts/model-a.md)
   - [Model B Prompt](operator-prompts/model-b.md)

   Prompt 內含明確的讀寫 allowlist、禁止搜尋範圍與污染回報規則。Prompt 本身不是作業系統安全邊界；若執行平台支援 workspace sandbox，應把模型的可見 workspace 進一步限制到共同題目與自己的 submission。

3. 為公平比較，兩邊使用相同時間限制、相同工具權限，而且不在中途追加提示。建議上限 60–90 分鐘。

4. 等兩個模型都完成後，再請驗證模型執行：

   ```bash
   node 20260814/model-showdown/scripts/evaluate.mjs
   ```

   自動結果會寫到 `reports/automated-results.json` 與 `reports/comparison-report.md`。瀏覽器走查分數會從 `evaluation/manual-review.json` 合併；尚未走查時，報告會清楚標成 pending，不會把缺項誤算為零分。

## 公平性規則

- `challenge/` 是兩個模型可讀的共同資訊。
- 每個模型只修改自己的 submission。
- `evaluation/`、`reports/` 與另一份 submission 在作答階段不可讀。
- 不允許外部套件或網路資源，以免版本、下載狀況或 CDN 影響結果。
- 不用「完成速度」作主要勝負標準；若要記錄，應由人類在外部另外計時。
- 模型名稱先保持 A／B，完成評分後再揭露，可降低人工視覺評分偏差。

## 分數

總分 100：自動評分 65 分、瀏覽器走查 35 分。詳細規則見 `evaluation/RUBRIC.md`；該檔應在兩個模型交卷後才開啟。
