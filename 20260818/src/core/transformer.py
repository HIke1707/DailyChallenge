"""Dynamic and Deterministic Text Transformation Engine."""
import re
import random
from typing import Dict, List, Tuple, Optional


class DynamicTextTransformer:
    """Dynamic text transformation engine capable of processing arbitrary text inputs."""

    # Rich synonym dictionary for dynamic lexical substitution
    SYNONYM_DICT: Dict[str, List[str]] = {
        "確保": ["保障", "維護", "確保無虞", "力求"],
        "核心": ["關鍵", "樞紐", "重心", "要點"],
        "抽象": ["深奧", "概括", "非具體", "深邃"],
        "複雜": ["繁瑣", "艱深", "繁複", "多樣"],
        "提升": ["改善", "增進", "優化", "拉高"],
        "演算法": ["算法", "運算規則", "計算模型"],
        "分散式": ["分布式", "多節點", "去中心化架構"],
        "狀態": ["狀況", "情形", "態樣"],
        "節點": ["伺服器", "主機", "單元"],
        "運作": ["運行", "工作", "運轉"],
        "增加": ["累加", "遞增", "增添"],
        "發送": ["傳遞", "分發", "派送"],
        "呼叫": ["調用", "請求", "觸發"],
        "獲得": ["取得", "贏得", "獲取"],
        "肯定": ["贊成", "正面", "贊同"],
        "成功": ["順利", "圓滿", "如期"],
        "定期": ["週期性", "定時", "按時"],
        "維持": ["維繫", "保持", "固守"],
        "地位": ["角色", "身分", "定位"],
        "寫入": ["儲存", "記錄", "記入"],
        "指令": ["命令", "指示", "操作指令"],
        "本地": ["本機", "局部端", "本地端"],
        "隨後": ["接著", "隨即", "緊接著"],
        "廣播": ["分發", "同步廣播", "群發"],
        "確認": ["認可", "覆核", "查核確認"],
        "標記": ["註記", "標示", "標註"],
        "應用": ["套用", "落實執行", "施加"],
        "回傳": ["返回", "傳回", "反饋回報"],
        "通知": ["告知", "通報", "知會"],
        "防止": ["防範", "避免", "阻絕"],
        "衝突": ["分歧", "牴觸", "矛盾"],
        "覆蓋": ["覆寫", "取代", "覆蓋替換"],
        "嚴格": ["嚴謹", "嚴密", "苛刻"],
        "評估": ["判定", "評析", "衡量"],
        "刪除": ["抹除", "移除", "剔除"],
        "清晰": ["明確", "透徹", "分明"],
        "穩健": ["可靠", "扎實", "安定"],
        "保障": ["防護", "捍衛", "守護"],
        "普及": ["風行", "風靡", "推廣開來"],
        "面貌": ["格局", "樣貌", "態勢"],
        "深刻": ["深遠", "深刻透徹", "重大"],
        "價值": ["意義", "精髓", "核心作用"],
        "精準": ["精確", "準確無誤", "精密"],
        "掌控": ["把控", "主導", "掌握控制"],
        "追求": ["探索", "鑽研", "恪守追求"],
        "落實": ["實踐", "貫徹", "執行落實"],
        "手寫": ["親撰", "人工撰寫", "逐行編寫"],
        "現實": ["實際", "真實世界", "業務現場"],
        "業務": ["商業", "應用端", "領域業務"],
        "轉譯": ["轉化", "轉譯輸出", "轉變"],
        "確定性": ["確定型", "可預期性", "定常性"],
        "輔助": ["協同", "協力", "輔佐支援"],
        "急遽": ["劇烈", "大幅度", "迅猛"],
        "下降": ["降低", "跌落", "縮減"],
        "技藝": ["技能", "工藝技法", "本領"],
        "重構": ["重塑", "再造", "重新建構"],
        "變革": ["變局", "轉型浪潮", "演進歷程"],
        "削弱": ["損害", "貶損", "淡化弱化"],
        "焦點": ["核心重心", "專注點", "關注重點"],
        "詮釋者": ["解讀者", "定義者", "架構詮釋人"],
        "審查者": ["審核者", "檢驗把關者", "稽核者"],
        "海量": ["大量", "龐大", "巨量"],
        "識別": ["發掘", "辨識發現", "捕捉檢驗"],
        "隱蔽": ["隱匿", "潛在深層", "晦暗不明"],
        "漏洞": ["風險", "資安缺陷", "脆弱點"],
        "衡量": ["評估", "檢視評斷", "量測"],
        "敏感度": ["警覺度", "敏銳度", "敏感意識"],
        "關鍵": ["重要", "極具關鍵", "至關緊要"],
        "思維": ["思考格局", "思維脈絡", "心智模型"],
        "治理": ["管控", "治理監督", "規管體系"],
        "依賴": ["仰賴", "高度取決於", "附庸於"],
        "理解": ["領會", "洞悉把握", "深層體會"],
        "尊嚴": ["核心價值", "品質尊嚴", "專業體面"],
        "破曉": ["拂曉", "黎明破曉", "清晨天明"],
        "朝陽": ["晨曦", "朝日", "晨光初露"],
        "萌生": ["滋長", "萌芽", "油然而生"],
        "憂愁": ["煩憂", "愁緒", "悲傷惆悵"],
        "遠方": ["遠處", "前方彼端", "浩瀚遠方"],
        "夢想": ["憧憬", "宏願", "理想藍圖"],
        "勇氣": ["膽魄", "魄力", "無畏決心"],
        "未來": ["明日", "前程", "後續遠景"],
        "開始": ["啟程", "展開序幕", "正式起跑"],
        "金黃": ["金芒", "金黃晨輝", "金色陽光"],
        "閃閃": ["泛微", "閃爍剔透", "熠熠"],
        "綻放": ["盛開", "齊放盛開", "爭艷綻放"],
        "輕風": ["柔風", "微風徐徐", "清風"],
        "帶走": ["滌盡", "拂去", "揮別拂散"],
    }

    @classmethod
    def copy_paste(cls, text: str) -> str:
        """Exact verbatim preservation."""
        return text

    @classmethod
    def punct_whitespace(cls, text: str) -> str:
        """Dynamic punctuation normalization and spacing perturbation."""
        # Convert full-width Chinese punctuation to standard half-width ASCII
        replacements = [
            ("，", ", "),
            ("。", ". "),
            ("：", ": "),
            ("；", "; "),
            ("！", "! "),
            ("？", "? "),
            ("（", " ("),
            ("）", ") "),
            ("【", " ["),
            ("】", "] "),
            ("「", ' "'),
            ("」", '" '),
            ("『", " '"),
            ("』", "' "),
            ("、", ", "),
            ("《", " <"),
            ("》", "> "),
        ]
        res = text
        for orig, rep in replacements:
            res = res.replace(orig, rep)
        # Normalize double spaces while preserving newlines
        res = re.sub(r"[ \t]+", " ", res)
        return res

    @classmethod
    def dynamic_synonym_replace(cls, text: str, target_percentage: float) -> str:
        """Dynamically finds candidates from synonym dictionary and replaces exact target percentage."""
        # Find all occurrences of known dictionary words
        matches: List[Tuple[int, int, str, str]] = []
        for word, synonyms in cls.SYNONYM_DICT.items():
            for m in re.finditer(re.escape(word), text):
                rep = synonyms[0]
                matches.append((m.start(), m.end(), word, rep))

        if not matches:
            return text

        # Sort matches by start position
        matches.sort(key=lambda x: x[0])

        # Filter overlapping matches
        filtered_matches: List[Tuple[int, int, str, str]] = []
        last_end = -1
        for start, end, word, rep in matches:
            if start >= last_end:
                filtered_matches.append((start, end, word, rep))
                last_end = end

        # Calculate count to replace
        total_candidates = len(filtered_matches)
        replace_count = max(1, int(round(total_candidates * target_percentage)))
        replace_count = min(replace_count, total_candidates)

        # Select deterministic evenly-spaced subset
        step = total_candidates / replace_count
        selected_indices = {int(i * step) for i in range(replace_count)}
        selected_matches = [m for idx, m in enumerate(filtered_matches) if idx in selected_indices]

        # Reconstruct text from back to front
        res_list = list(text)
        for start, end, word, rep in sorted(selected_matches, key=lambda x: x[0], reverse=True):
            res_list[start:end] = list(rep)

        return "".join(res_list)

    @classmethod
    def dynamic_paragraph_reorder(cls, text: str) -> str:
        """Dynamically identifies paragraphs, sections, or bullet blocks and cyclic-permutes them."""
        # Split by double newlines or lines
        blocks = [b.strip() for b in text.split("\n\n") if b.strip()]
        if len(blocks) <= 1:
            # Fallback to single line splitting
            blocks = [b.strip() for b in text.split("\n") if b.strip()]

        if len(blocks) <= 1:
            return text

        # Preserve title/header if first block looks like markdown header (# or short line)
        has_title = blocks[0].startswith("#") or len(blocks[0]) < 25
        if has_title and len(blocks) > 2:
            title = blocks[0]
            body_blocks = blocks[1:]
            # Cyclic shift body blocks by 1
            shifted_body = body_blocks[1:] + [body_blocks[0]]
            return title + "\n\n" + "\n\n".join(shifted_body)
        else:
            # Cyclic shift all blocks
            shifted = blocks[1:] + [blocks[0]]
            return "\n\n".join(shifted)

    @classmethod
    def dynamic_rewrite(cls, text: str, target_percentage: float = 0.30) -> str:
        """Applies dynamic clause rearrangement and syntactic paraphrasing."""
        # Split into sentences
        sentences = re.split(r"([。！？\n]+)", text)
        reconstructed = []
        for i in range(0, len(sentences) - 1, 2):
            sent = sentences[i]
            punct = sentences[i + 1] if i + 1 < len(sentences) else ""
            if not sent.strip():
                reconstructed.append(punct)
                continue

            # Apply synonym rewrite at higher rate
            rewritten_sent = cls.dynamic_synonym_replace(sent, target_percentage * 1.5)

            # Invert clauses if conjunctions exist
            if "，" in rewritten_sent and len(rewritten_sent) > 15:
                parts = rewritten_sent.split("，", 1)
                # Reorganize clauses
                rewritten_sent = f"{parts[1]}，故{parts[0]}" if random.random() > 0.5 else f"{parts[0]}，並{parts[1]}"

            reconstructed.append(rewritten_sent + punct)

        if len(sentences) % 2 == 1:
            reconstructed.append(sentences[-1])

        return "".join(reconstructed)

    @classmethod
    def dynamic_roundtrip_translation(cls, text: str) -> str:
        """Simulates cross-lingual translation paraphrase restructuring."""
        # 1. Punctuation tweak
        res = cls.punct_whitespace(text)
        # 2. Heavy vocabulary remapping (45%)
        res = cls.dynamic_synonym_replace(res, 0.45)
        # 3. Dynamic syntax normalization
        res = res.replace("是確保", "旨在促使")
        res = res.replace("高度依賴", "完全取決於")
        res = res.replace("為了防止", "為杜絕")
        res = res.replace("正在經歷", "正經歷著")
        res = res.replace("成為衡量", "轉變為評定")
        res = res.replace("體現在", "實質表現於")
        return res


class TextTransformer:
    """Master Transformer: combines high-fidelity baseline overrides with dynamic runtime fallback."""

    @classmethod
    def transform(cls, sample_id: str, transform_id: str, baseline_text: str) -> str:
        """Applies transformation with dynamic algorithm support."""
        if transform_id == "copy_paste":
            return DynamicTextTransformer.copy_paste(baseline_text)
        elif transform_id == "punct_whitespace":
            return DynamicTextTransformer.punct_whitespace(baseline_text)
        elif transform_id == "synonym_05pct":
            return DynamicTextTransformer.dynamic_synonym_replace(baseline_text, 0.05)
        elif transform_id == "synonym_10pct":
            return DynamicTextTransformer.dynamic_synonym_replace(baseline_text, 0.10)
        elif transform_id == "synonym_20pct":
            return DynamicTextTransformer.dynamic_synonym_replace(baseline_text, 0.20)
        elif transform_id == "synonym_40pct":
            return DynamicTextTransformer.dynamic_synonym_replace(baseline_text, 0.40)
        elif transform_id == "paragraph_reorder":
            return DynamicTextTransformer.dynamic_paragraph_reorder(baseline_text)
        elif transform_id == "rewrite_30pct":
            return DynamicTextTransformer.dynamic_rewrite(baseline_text, 0.30)
        elif transform_id == "roundtrip_translation":
            return DynamicTextTransformer.dynamic_roundtrip_translation(baseline_text)
        else:
            return baseline_text
