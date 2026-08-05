# Comparison

20260730/framer-agent-landing-page/docs/prompt-one-shot.md
第一次生成花費423 credits. opus 5
https://framer.com/projects/Considerate-Ways--UZ8v26VnLu2uRjH49XVV-fAFEQ?node=augiA20Il&view=preview

20260730/framer-agent-landing-page/docs/prompt-staged-build.md
剛好把剩下的用完．換了 gpt luna
https://framer.com/projects/Focused-Gecko--rPZxwQ9eWlqTScyjsx15-1SjME?duplicate=starter-template-empty-site&node=augiA20Il&view=preview&fullscreen=true

版型差不多一致，但在排版與內容上稍有差異．prompt-one-shot的卡片高度有做到一致，但prompt-staged-build則沒有．

prompt-one-shot的折線圖比較逼真

prompt-staged-build則是在哪片細節上處理比較好，幻燈片的設計比較符合常理

prompt-one-shot 一次讀取完整內容後，似乎很希望照完全照著指令也因此少了許多人性化，例如按鈕不會先啟用，而是直接設定了pending的屬性，且樣式因為得到了簡潔的指示，乾脆直接變成全白的。
prompt-staged-build在架構產生時就已經建立好很不錯的內容了，相對最後的結果來說，看起來整體更完整一些．

但是，prompt-staged-build在最後的實際內容產出上又出現了圖片錯位的問題，這在先前的測試上沒有發生過．