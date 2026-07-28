今日 AI 實作計畫｜2026 年 7 月 28 日
1. 今日 AI 實作主題

使用 GitHub Copilot App 的 Canvas，建立一個可互動的「AI 實作類型探索儀表板」，記錄每天做過的題目、完成度、喜好與學習收穫。

你今天要體驗的不是傳統聊天，也不是掃描器，而是：

讓 AI Agent 建立一個視覺化工作介面，你能直接點擊、編輯與篩選資料，Agent 也能操作同一份狀態。

專案名稱：

ai-practice-explorer

**任務類型：**互動介面／Human-Agent Collaboration／視覺化工作流
**難度：**入門～中等
基本完成時間：約 3 小時 20 分鐘

階段	時間
安裝與熟悉 Copilot Canvas	25 分鐘
整理實作紀錄資料	25 分鐘
產生第一版 Canvas	45 分鐘
增加互動與資料持久化	50 分鐘
人工審稿與第二輪修改	35 分鐘
測試、截圖與整理繳交	20 分鐘
2. 今日熱門度快照

GitHub 在 2026 年 7 月 21 日發布 Canvas 實作介紹，並於 7 月 27 日再次發布 Copilot App 入門文章，特別介紹如何使用 Canvas 建立互動工作介面、預覽應用程式，以及直接選取畫面元素要求 Agent 修改。

熱度分類：7 天內升溫

熱度訊號一：官方近期教學集中發布

GitHub 將 Canvas 定義為人與 Agent 共用的互動介面。Agent 可以更新畫布，使用者也能透過點擊、拖曳與編輯改變同一份狀態；可用 /create-canvas 直接產生 Canvas Extension。

熱度訊號二：開源工具開始加入 Canvas 支援

Microsoft 的開源 APM 專案近期加入實驗性的 Copilot Canvas Primitive，可將 Canvas Extension 部署至 .github/extensions 或使用者層級的 ~/.copilot/extensions，顯示這種互動式 Agent Artifact 已開始進入工具鏈。

熱度訊號三：公開社群已有實際 Demo

公開社群已有使用者展示 Canvas 作為 Repository 內的「小型子應用」，例如比較不同 SVG 渲染結果，並讓畫面按鈕反向呼叫 Agent Runtime。這屬於小型社群訊號，不能視為大眾爆紅，但代表已有可重現的實作形式。

近期熱度與新鮮度

36／40

時間新鮮度：18／20
熱度與擴散證據：18／20

扣分原因：

Canvas 並非昨天才首次發布。
目前熱度主要集中於 GitHub Copilot 開發者社群，尚不是跨平台的大眾熱門工具。
官方已確認
Canvas 可用 /create-canvas 建立。
可放在 .github/extensions 與團隊共用。
使用者和 Agent 可以操作同一份共享狀態。
Copilot App 支援 macOS、Windows 與 Linux，且目前適用所有 Copilot Plans。
今日實作判斷

Canvas 最值得體驗的部分不是「AI 幫你寫前端」，而是：

聊天是否能轉變成一個持續存在、可被人與 Agent 同時操作的工作介面。

3. 候選題目勝出理由

今天的近期候選還包括：

OpenAI Presence 的客服 Agent 工作流模擬
Copilot Cloud Agent 與 Linear 的任務委派
新 MCP Stateless 規格實驗
新模型的小型能力比較
AI 影片時間軸剪輯

Canvas 題目勝出的原因是：

新鮮度

官方昨天才發布新的入門文章，本週仍在集中推廣與補充教學。

實作價值

它能直接解決你現在的問題：

我做過不同 AI 實作，但還不知道自己最喜歡哪一種類型。

一日可完成性

不用串接正式資料庫，也不用設計完整網站。基本版只需：

一份 JSON 資料
一個互動 Canvas
幾個操作按鈕
一個由 Agent 產生的偏好摘要
類型差異

最近兩題是安全工程與 Policy Validation；今天轉成：

視覺介面設計
＋
Human-Agent 協作
＋
個人學習資料整理
4. 今日完成定義 Definition of Done

今天結束前，Repository 至少應存在：

ai-practice-explorer/
├── .github/
│   └── extensions/
│       └── ai-practice-explorer/
│           ├── package.json
│           ├── extension.mjs
│           └── artifacts/
│               └── experiments.json
├── docs/
│   ├── brief.md
│   ├── canvas-prompt-v1.md
│   ├── canvas-prompt-v2.md
│   └── test-results.md
├── evidence/
│   ├── canvas-v1.png
│   ├── canvas-v2.png
│   └── preference-summary.png
└── README.md

Canvas 至少要有三個區域。

實作卡片區

每筆紀錄顯示：

日期
題目
類型
最終分數
花費時間
喜歡程度
是否願意再做
最大收穫
篩選與比較區

至少支援：

依任務類型篩選
依完成度排序
只看「願意再做」
比較工程、Agent、內容、工作流等類型
偏好摘要區

根據現有資料顯示：

最喜歡的類型
平均完成分數
最常卡住的階段
下一個建議嘗試的類型

Agent 不可自行杜撰不存在的紀錄。

5. 工具與前置條件
主要工具
GitHub 帳號
GitHub Copilot App
Git Repository
Node.js 20 以上，僅在 Extension 需要本機執行時使用
任一文字編輯器

GitHub Copilot App 目前支援 macOS、Windows 與 Linux，所有 Copilot Plans 均可使用；沒有訂閱時也可使用 BYOK，但可能產生模型供應商費用。

基本版費用
Copilot Free：可嘗試，但受方案使用量限制。
已有 Copilot Plan：使用既有額度。
BYOK：可能付費。
不需要額外資料庫或雲端服務。
不需要
API Key 寫進 Repository
MCP Server
後端 API
正式資料庫
部署網站
備援方案

若 Copilot App 無法使用，就以 Vue 3＋Vite 建立相同儀表板，讓 Codex 或其他 Coding Agent 協助製作。

備援版仍需保留：

Agent 建立第一版
人工視覺審稿
第二輪定點修改
JSON 持久化
前後比較證據
6. 分步實作流程
步驟一：建立實作資料

建立：

artifacts/experiments.json

先放至少四筆紀錄，可使用你近期做過的挑戰，例如：

[
  {
    "id": "20260724-api-auditor",
    "date": "2026-07-24",
    "title": "OpenAI API Deprecation Auditor",
    "type": "agent-skill",
    "score": 0,
    "hours": 4.2,
    "enjoyment": 3,
    "wouldRepeat": true,
    "lesson": "將確定性掃描與 AI 判斷分離"
  },
  {
    "id": "20260727-security-gate",
    "date": "2026-07-27",
    "title": "Agent Issue Security Gate",
    "type": "security-engineering",
    "score": 92,
    "hours": 6,
    "enjoyment": 3,
    "wouldRepeat": false,
    "lesson": "對抗測試比只跑 Fixture 更有價值"
  }
]

其餘兩筆可使用過去實作或虛構的明確標示 Sample。

**檢查點：**每筆資料都有唯一 id。

步驟二：先寫 Canvas Brief

建立 docs/brief.md，回答：

這個畫面主要給誰使用？
進入畫面後第一眼要看到什麼？
使用者最常做的三個操作是什麼？
Agent 可以修改什麼？
Agent 絕對不能修改什麼？

建議限制：

Agent 可以新增摘要。
Agent 可以更新紀錄。
Agent 不可修改原始分數，除非使用者明確要求。
Agent 不可自行新增不存在的完成紀錄。

**檢查點：**列出三個 Human Actions 和三個 Agent Capabilities。

步驟三：產生第一版 Canvas

在 Copilot App 中開啟 Repository，輸入：

/create-canvas

第一版 Prompt 至少說明：

使用 experiments.json
顯示卡片
可依類型篩選
可編輯喜好分數
顯示簡單統計
不呼叫外部網路
不產生不存在的紀錄
所有修改保存回 JSON Artifact

不要要求「做得漂亮就好」。

**預期結果：**生成 .github/extensions/ai-practice-explorer。

**檢查點：**Canvas 能正常開啟並顯示至少四筆資料。

步驟四：實際操作第一版

你要親手完成：

把一筆 enjoyment 從 3 改成 4。
篩選只顯示 agent-skill。
新增一筆「影片題已保留」的紀錄，狀態設為 deferred。
重新開啟 Canvas，確認資料仍存在。

**檢查點：**不是只有畫面展示，狀態必須真的改變。

步驟五：讓 Agent 分析偏好

要求 Agent：

只根據 experiments.json 中存在的紀錄，
分析我目前對不同 AI 實作類型的偏好。

每項結論必須列出支持它的 experiment id。
資料不足時直接寫「證據不足」。
不要推測我的人格或職涯。

輸出至少包含：

哪類任務完成分數最高
哪類任務喜好分數最高
哪類任務花費時間最長
哪些結論證據不足

**檢查點：**每項結論都有紀錄 ID。

步驟六：人工審稿第一版

你至少找出三個問題，例如：

卡片資訊太多。
最重要的喜好分數不明顯。
篩選器不容易理解。
手機或窄畫面排版溢出。
Agent 摘要與畫面資料不同步。

不得只寫：

不好看
沒有質感
不夠直覺

每個問題都要有可觀察條件。

步驟七：要求 Agent 做第二版

建立 canvas-prompt-v2.md。

只修改你明確指出的部分，例如：

1. 將喜好程度改為五顆星，放在卡片右上角。
2. 將分數、時間與是否願意再做移到同一列。
3. 加入「尚未嘗試／已完成／保留」狀態篩選。
4. 其他資料欄位與 JSON 結構不可改動。

**檢查點：**能列出 V1 與 V2 的三項可見差異。

步驟八：整理結果

README 至少記錄：

Canvas 解決了什麼問題
如何開啟
資料格式
Agent 可呼叫哪些 Capability
哪些資料只能由人修改
已知限制
你是否喜歡這種實作類型
7. 必測案例
案例一：正常新增紀錄

輸入

新增一筆「AI 影片剪輯」，狀態 deferred，喜好程度未知。

預期輸出

新增唯一 ID。
status = deferred
不自行填入分數。
不自行填入完成時間。
案例二：重新載入後持久存在

操作

修改一筆喜好程度後關閉並重新開啟 Canvas。

預期輸出

修改值仍存在於 experiments.json。

判定方式

比較操作前後 JSON。

案例三：篩選結果正確

操作

只顯示：

wouldRepeat = true

預期輸出

畫面中的每張卡片都符合條件。

案例四：不完整資料

輸入

新增一筆只有：

{
  "title": "未知實驗"
}

預期行為

Canvas 應要求補充必要資料，或將缺少欄位顯示為「未提供」，不可自行捏造日期、分數與時間。

案例五：AI 幻覺檢查

目前只有四筆紀錄時，要求：

告訴我過去 30 天最喜歡的五種任務。

預期輸出

Agent 必須指出資料不足，不能湊出五種類型。

8. 驗收標準
功能正確與可運行：40 分
Canvas 可正常開啟：8 分
可顯示 JSON 紀錄：6 分
新增與編輯可用：8 分
篩選功能正確：6 分
重新載入後資料保留：7 分
偏好摘要可產生：5 分
真實情境實用性：20 分
能追蹤每日 AI 實作：6 分
能幫助辨認任務偏好：6 分
畫面資訊層級清楚：4 分
未來可持續新增資料：4 分
AI 使用合理性：15 分
Agent 實際建立 Canvas：5 分
Agent 和使用者操作同一份資料：4 分
第二輪修改根據人工審稿：3 分
摘要只使用現有證據：3 分
測試、文件與可重現性：15 分
保存兩版 Prompt：4 分
五個案例有結果：5 分
README 可重現操作：3 分
有 V1／V2 截圖：3 分
安全、隱私與品質：10 分
不含公司或客戶資料：3 分
不呼叫未知外部服務：2 分
不杜撰實作紀錄：3 分
Agent 不可任意更改最終分數：2 分
最低通過條件

以下任一失敗仍判定為需修改：

Canvas 無法開啟。
只產生靜態畫面，沒有任何互動。
修改後沒有保存。
Agent 摘要包含不存在的紀錄或數字。
沒有人工審稿與第二版。
只提交截圖，沒有 Extension 原始檔。
使用真實公司、客戶或內部 Repository 資料。

70 分：通過
85 分以上：完成度良好
95 分以上：可成為長期使用的 AI 實作管理工具

9. 常見失敗點與排除方式
/create-canvas 無法使用

確認你使用的是 GitHub Copilot App，而不是普通 GitHub 網頁或 VS Code Chat。

備援方式是自行建立：

.github/extensions/ai-practice-explorer/extension.mjs

再請 Agent 補齊 Canvas Extension。

Canvas 顯示但資料不能保存

確認修改是否只存在前端記憶體。

要求 Agent 明確加入：

load_experiments
save_experiments
update_experiment

三項 Capability。

Agent 每次都重寫整份 JSON

要求它：

依 id 更新單筆紀錄。
保存前讀取最新版。
不重新排序未修改的紀錄。
不刪除未知欄位。
畫面太像普通後台

先不要追求動畫。優先確保：

喜好程度一眼可見。
類型可以篩選。
完成與保留狀態可區分。
結論能回到具體紀錄。
10. 進階加分項
加分一：加入類型偏好雷達圖

額外時間：35 分鐘

比較：

喜好
完成度
實用性
願意重做
學習收穫

若某類型只有一筆資料，必須標示樣本不足。

加分二：匯出教練摘要

額外時間：30 分鐘

加入按鈕輸出：

coach-summary.md

內容包含：

最近完成題目
平均分數
偏好變化
建議下一題類型
支持結論的紀錄 ID

兩項共 65 分鐘。

11. 繳交方式

完成後請貼回：

Repository 連結或 Extension 原始檔。
experiments.json。
第一版與第二版 Canvas Prompt。
V1／V2 畫面截圖。
五個必測案例結果。
Agent 產生的偏好摘要。
你否決或修改了哪些 UI 決策。
你對「互動介面／Canvas」類型的喜歡程度，與安全工程題相比有什麼不同。
今日開工指令

先安裝並開啟 GitHub Copilot App，建立一個空 Repository，新增含四筆紀錄的 experiments.json，接著輸入 /create-canvas。