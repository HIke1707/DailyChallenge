# Canvas Prompt v1
/create-canvas 1. 預計我的canvas資料夾長這樣，互動資料取用artifacts/experiments.json
└── extensions/
│ └── ai-practice-explorer/
│ ├── package.json
│ ├── extension.mjs
│ └── artifacts/
│ └── experiments.json
2. 以卡片方式顯示experiments.json
3. 可以一類型篩選
4. 顯示簡單統計
5. 不呼叫外部網路
6. 不產生不存在的紀錄
7. 所有修改保存回 JSON Artifact
8. json預定義欄位
{
 "id": "20260724-api-auditor",
 "date": "2026-07-24",
 "title": "OpenAI API Deprecation Auditor",
 "type": "agent-skill",
 "score": 0,
 "hours": 4.2,
 "enjoyment": 3, // 1-5 很不喜歡/不喜歡/普通/喜歡/很喜歡
 "level": 1, // 1-3 簡單/中/難
 "wouldRepeat": true,
 "lesson": "將確定性掃描與 AI 判斷分離"
 }
