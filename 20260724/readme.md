## 建立一個skill用來掃描有沒有使用openai的舊版api

openai-api-deprecation-auditor/
├── SKILL.md
├── scripts/
│   ├── audit.py
│   └── tests/
│       └── test_audit.py
└── references/
    └── openai-deprecations.json


## 淘汰API可以到官方網頁查詢
[text](https://developers.openai.com/api/docs/deprecations)


## 2026-07-20 List
| Shutdown date | Model family / snapshot | Recommended replacement |
| --- | --- | --- |
| Jan 20, 2027 | gpt-realtime | gpt-realtime-2.1 |
| Jan 20, 2027 | gpt-audio | gpt-audio-1.5 |
| Jan 20, 2027 | gpt-4o-audio | gpt-audio-1.5 |
| Jan 20, 2027 | gpt-4o-realtime | gpt-realtime-2.1 |
| Jan 20, 2027 | gpt-realtime-mini | gpt-realtime-2.1-mini |
| Jan 20, 2027 | gpt-audio-mini | gpt-audio-1.5 |
| Jan 20, 2027 | gpt-4o-mini-realtime | gpt-realtime-2.1-mini |
| Jan 20, 2027 | gpt-4o-mini-audio | gpt-audio-1.5 |
| Jan 20, 2027 | gpt-4o-mini-transcribe-2025-03-20 | gpt-4o-mini-transcribe-2025-12-15 |