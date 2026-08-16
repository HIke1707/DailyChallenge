const manualDimensions = {
  visualHierarchy: 10,
  interactions: 10,
  responsive: 5,
  accessibility: 5,
  resilience: 5,
};

export function normalizeManualReview(review) {
  const dimensions = {};
  let score = 0;
  let complete = true;

  for (const [name, max] of Object.entries(manualDimensions)) {
    const value = review?.[name];
    const valid = typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max && value * 2 === Math.round(value * 2);
    dimensions[name] = { score: valid ? value : null, max };
    if (valid) score += value;
    else complete = false;
  }

  return {
    status: complete ? "complete" : "pending",
    score: complete ? score : null,
    max: 35,
    dimensions,
    notes: Array.isArray(review?.notes) ? review.notes.map(String) : [],
  };
}

function scoreText(value, max) {
  return value === null || value === undefined ? `pending / ${max}` : `${value} / ${max}`;
}

function leaderBy(results, selector) {
  const entries = Object.entries(results).filter(([, result]) => result.status === "graded");
  if (entries.length !== 2) return null;
  const [a, b] = entries;
  const aScore = selector(a[1]);
  const bScore = selector(b[1]);
  if (aScore === null || bScore === null || aScore === bScore) return "tie";
  return aScore > bScore ? a[0] : b[0];
}

export function buildComparison(results) {
  const automatedLeader = leaderBy(results, (result) => result.automated.score);
  const bothManual = Object.values(results).every((result) => result.status === "graded" && result.manual.status === "complete");
  if (!bothManual) return { automatedLeader, finalWinner: null, reason: "manual_review_pending" };

  const totalLeader = leaderBy(results, (result) => result.total.score);
  if (totalLeader !== "tie") return { automatedLeader, finalWinner: totalLeader, reason: "total_score" };
  const coreLeader = leaderBy(results, (result) => result.automated.categories.core_correctness.score);
  if (coreLeader !== "tie") return { automatedLeader, finalWinner: coreLeader, reason: "core_correctness_tiebreak" };
  const interactionLeader = leaderBy(results, (result) => result.manual.dimensions.interactions.score);
  return { automatedLeader, finalWinner: interactionLeader === "tie" ? "tie" : interactionLeader, reason: interactionLeader === "tie" ? "true_tie" : "interaction_tiebreak" };
}

function failedChecks(result) {
  if (result.status !== "graded") return "- 尚未提交。";
  const failed = result.automated.checks.filter((check) => !check.passed);
  if (failed.length === 0) return "- 無。";
  return failed.map((check) => `- ${check.name}（0/${check.points}）：${check.detail}`).join("\n");
}

function notes(result) {
  if (result.status !== "graded" || result.manual.notes.length === 0) return "- 尚無人工走查紀錄。";
  return result.manual.notes.map((note) => `- ${note}`).join("\n");
}

export function renderMarkdown(payload) {
  const a = payload.submissions["model-a"];
  const b = payload.submissions["model-b"];
  const lines = [
    "# Incident Replay Workbench｜雙模型比較報告",
    "",
    `產生時間：${payload.generatedAt}`,
    "",
    "## 結論",
    "",
  ];

  if (payload.comparison.finalWinner) {
    lines.push(payload.comparison.finalWinner === "tie"
      ? "兩份提交在既定平手規則下並列。"
      : `最終勝出：**${payload.comparison.finalWinner}**（判定：${payload.comparison.reason}）。`);
  } else if (payload.comparison.automatedLeader) {
    lines.push(payload.comparison.automatedLeader === "tie"
      ? "自動評分目前同分；瀏覽器走查尚未完成，因此不宣布最終勝負。"
      : `自動評分暫時領先：**${payload.comparison.automatedLeader}**；瀏覽器走查尚未完成，因此不宣布最終勝負。`);
  } else {
    lines.push("兩份提交尚未都完成，暫不比較勝負。 ");
  }

  lines.push(
    "",
    "## 分數總覽",
    "",
    "| 項目 | model-a | model-b |",
    "|---|---:|---:|",
    `| 核心正確性 | ${scoreText(a.status === "graded" ? a.automated.categories.core_correctness.score : null, 50)} | ${scoreText(b.status === "graded" ? b.automated.categories.core_correctness.score : null, 50)} |`,
    `| 提交與產品接線 | ${scoreText(a.status === "graded" ? a.automated.categories.product_readiness.score : null, 15)} | ${scoreText(b.status === "graded" ? b.automated.categories.product_readiness.score : null, 15)} |`,
    `| 自動小計 | ${scoreText(a.status === "graded" ? a.automated.score : null, 65)} | ${scoreText(b.status === "graded" ? b.automated.score : null, 65)} |`,
    `| 瀏覽器走查 | ${scoreText(a.status === "graded" ? a.manual.score : null, 35)} | ${scoreText(b.status === "graded" ? b.manual.score : null, 35)} |`,
    `| **總分** | **${scoreText(a.total.score, 100)}** | **${scoreText(b.total.score, 100)}** |`,
    "",
    "## 瀏覽器走查明細",
    "",
    "| 面向 | model-a | model-b |",
    "|---|---:|---:|",
  );

  for (const [name, max] of Object.entries(manualDimensions)) {
    lines.push(`| ${name} | ${scoreText(a.status === "graded" ? a.manual.dimensions[name].score : null, max)} | ${scoreText(b.status === "graded" ? b.manual.dimensions[name].score : null, max)} |`);
  }

  lines.push(
    "",
    "## model-a 自動檢查失敗",
    "",
    failedChecks(a),
    "",
    "## model-b 自動檢查失敗",
    "",
    failedChecks(b),
    "",
    "## model-a 走查觀察",
    "",
    notes(a),
    "",
    "## model-b 走查觀察",
    "",
    notes(b),
    "",
    "## 判讀提醒",
    "",
    "- 自動分數回答「規格與邊界條件是否正確」；人工走查回答「產品是否真的好用且完成」。",
    "- 若 manual review 為 pending，這份報告只是中期結果，不應用來宣布模型勝負。",
    "- 揭露實際模型名稱前先完成人工分數，可降低品牌偏差。",
    "",
  );
  return lines.join("\n");
}
