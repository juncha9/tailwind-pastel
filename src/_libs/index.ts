import * as vscode from 'vscode';
import {
    CLASSNAME_CALL_PATTERN,
    CLASSNAME_HELPERS,
    CLASS_ATTR_PATTERN,
    DASH_PREFIX_LOOKUP,
    EXACT_KEYWORD_LOOKUP,
} from '../_defs';
import { ClassToken, TextFragment, TailwindCategory } from '@/_types';

const CLASSNAME_HELPER_SET: ReadonlySet<string> = new Set(CLASSNAME_HELPERS);

// ---------------------------------------------------------------------------
// tailwind classification
// ---------------------------------------------------------------------------

/**
 * raw 클래스 문자열을 분석해 utility 본체 + 카테고리 분류 정보를 반환한다.
 *
 *  - utility.text:   variant prefix(`hover:`, `md:`, `dark:`)·important `!`·음수 `-`를
 *                    제거한 utility 본체 (e.g. `"md:!bg-red-500"` → `"bg-red-500"`)
 *  - utility.offset: raw 안에서 utility가 시작하는 인덱스 (anchor만 색칠하기 위한 위치 매핑)
 *  - category:       utility의 카테고리 (`surface`, `layout`, ...)
 *  - anchorLength:   utility 안에서 카테고리 anchor의 길이 — 표시 목적상 rule의
 *                    trailing `-`는 제외한다.
 *
 *  e.g. "md:hover:bg-red-500" → utility={ offset:9, text:"bg-red-500" }, category="surface", anchorLength=2
 *       "!flex"               → utility={ offset:1, text:"flex" },       category="layout",  anchorLength=4
 *       "-mt-2"               → utility={ offset:1, text:"mt-2" },       category="box",     anchorLength=2
 */
export function parseRawClass(raw: string): {
    utility: TextFragment;
    category: TailwindCategory;
    anchorLength: number;
} {
    /*
     * (1) variant prefix / `!` / `-` 제거.
     * variant는 `:`로 구분되며, arbitrary value 안의 `:`는 대괄호 내부에 있으므로
     * 대괄호 밖의 마지막 `:` 다음을 utility 시작점으로 본다.
     */
    let depth = 0;
    let variantEnd = 0;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '[') {
            depth++;
        } else if (ch === ']') {
            depth = Math.max(0, depth - 1);
        } else if (ch === ':' && depth === 0) {
            variantEnd = i + 1;
        }
    }
    let text = raw.slice(variantEnd);
    let offset = variantEnd;
    if (text.startsWith('!')) {
        text = text.slice(1);
        offset += 1;
    }
    if (text.startsWith('-')) {
        text = text.slice(1);
        offset += 1;
    }
    const utility: TextFragment = { offset, text };

    /*
     * (2) 카테고리 분류 — Map lookup으로 O(1)에 가까운 비용.
     * 우선순위: 더 긴 segment 매치를 먼저 시도해 더 구체적인 룰이 이긴다.
     *  ① 2-segment dash prefix (e.g. `min-w-`, `bg-blend-`)
     *  ② 1-segment dash prefix (e.g. `bg-`, `flex-`)
     *  ③ utility 전체가 exact keyword (e.g. `inline-block`, `flex`)
     *  ④ 1-segment이 exact keyword + utility가 `${seg}-`로 시작 (e.g. `border-2` ← `border`)
     */
    const firstDash = text.indexOf('-');
    if (firstDash !== -1) {
        const secondDash = text.indexOf('-', firstDash + 1);
        if (secondDash !== -1) {
            const seg2 = text.slice(0, secondDash);
            const hit2 = DASH_PREFIX_LOOKUP.get(seg2);
            if (hit2 != null) {
                return { utility, category: hit2.category, anchorLength: hit2.anchorLength };
            }
        }
        const seg1 = text.slice(0, firstDash);
        const hit1 = DASH_PREFIX_LOOKUP.get(seg1);
        if (hit1 != null) {
            return { utility, category: hit1.category, anchorLength: hit1.anchorLength };
        }
    }
    const hitWhole = EXACT_KEYWORD_LOOKUP.get(text);
    if (hitWhole != null) {
        return { utility, category: hitWhole.category, anchorLength: hitWhole.anchorLength };
    }
    if (firstDash !== -1) {
        const seg1 = text.slice(0, firstDash);
        const hitSeg = EXACT_KEYWORD_LOOKUP.get(seg1);
        if (hitSeg != null) {
            return { utility, category: hitSeg.category, anchorLength: seg1.length };
        }
    }
    return { utility, category: 'other', anchorLength: text.length };
}

// ---------------------------------------------------------------------------
// extraction
// ---------------------------------------------------------------------------

/**
 * 문서에서 클래스 문자열 조각(text + 문서 offset)을 모두 수집한다.
 *  (1) class= / className= / ngClass= / class:list= / [class]= 등 속성값
 *      ("..." | '...' | {`...`})
 *  (2) clsx/cn/cva/... 헬퍼 호출 — 일반 호출(`fn(...)`)과 tagged template(`` fn`...` ``).
 *      object key 문자열, namespaced 호출(`lib.cn(...)`) 포함.
 *
 * 두 regex 결과를 index 순으로 통합 처리하면서 이미 처리된 영역(attr body, helper call 본문)은
 * `coveredUntil` 커서로 스킵 — 같은 string literal이 두 번 fragment로 잡히는 일을 원천 차단해
 * 후단의 dedupe 비용을 없앤다.
 *
 * 내부 helper들(findCloserIndex / extractLiteral / getMatchingParenthesisIndex / collectStringLiterals)은
 * 모두 이 함수에서만 쓰이므로 nested로 두고 `text`를 closure로 공유한다.
 */
function findClassFragments(text: string): TextFragment[] {

    // `start` 위치에서 시작하는 string literal의 닫는 따옴표 다음 인덱스를 반환. 못 찾으면 text.length.
    function findCloserIndex(start: number, quote: string): number {
        let i = start + 1;
        while (i < text.length) {
            const ch = text[i];
            if (ch === '\\') {
                i += 2;
                continue;
            }
            if (ch === quote) {
                // ex: `"p-4"`에서 `"` 시작 → `"` 끝 다음 인덱스 반환 (문자열 본문은 text.slice(start+1, i))
                return i + 1;
            }
            i++;
        }
        // ex: `"p-4`에서 `"` 시작 → 닫는 `"` 못 찾음 → text.length 반환 (문자열 본문은 text.slice(start+1))
        return text.length;
    }

    // openerIdx 위치에 따옴표가 있다고 가정하고, 그 literal의 본문과 offset을 반환한다.
    function extractLiteral(openerIndex: number): TextFragment | null {
        const openerText = text[openerIndex];
        if (openerText !== '"' && openerText !== "'" && openerText !== '`') {
            return null;
        }
        const closerIndex = findCloserIndex(openerIndex, openerText);
        if (closerIndex < 1 || text[closerIndex - 1] !== openerText) {
            return null;
        }
        const offset = openerIndex + 1;
        const body = text.slice(offset, closerIndex - 1);
        if (openerText === '`' && body.includes('${')) {
            return null;
        }
        // ex: `class="p-4"` → body="p-4", offset=7 (document offset 기준)
        return { offset, text: body };
    }

    // `(` 위치에서 시작해 짝이 맞는 `)`의 인덱스를 반환. 문자열·주석 안의 paren은 무시. 못 찾으면 -1.
    function getMatchingParenthesisIndex(startIndex: number): number {
        let depth = 1;
        let i = startIndex + 1;
        while (i < text.length && depth > 0) {
            const ch = text[i];
            if (ch === '"' || ch === "'" || ch === '`') {
                i = findCloserIndex(i, ch);
                continue;
            }
            if (ch === '/' && text[i + 1] === '/') {
                const nl = text.indexOf('\n', i);
                i = nl === -1 ? text.length : nl + 1;
                continue;
            }
            if (ch === '/' && text[i + 1] === '*') {
                const e = text.indexOf('*/', i + 2);
                i = e === -1 ? text.length : e + 2;
                continue;
            }
            if (ch === '(') {
                depth++;
            } else if (ch === ')') {
                depth--;
                if (depth === 0) {
                    return i;
                }
            }
            i++;
        }
        return -1;
    }

    // [start, end) 구간 안의 string literal들을 fragment로 수집. 주석은 스킵.
    function collectStringLiterals(start: number, end: number): TextFragment[] {
        const out: TextFragment[] = [];
        let i = start;
        while (i < end) {
            const ch = text[i];
            if (ch === '"' || ch === "'" || ch === '`') {
                const literal = extractLiteral(i);
                if (literal != null) {
                    out.push(literal);
                }
                i = Math.min(end, findCloserIndex(i, ch));
                continue;
            }
            if (ch === '/' && text[i + 1] === '/') {
                const nl = text.indexOf('\n', i);
                i = nl === -1 ? end : nl + 1;
                continue;
            }
            if (ch === '/' && text[i + 1] === '*') {
                const e = text.indexOf('*/', i + 2);
                i = e === -1 ? end : e + 2;
                continue;
            }
            i++;
        }
        return out;
    }

    // ── 본 처리 시작 ──
    interface Hit { readonly kind: 'attr' | 'call'; readonly index: number; readonly match: RegExpExecArray; }
    const hits: Hit[] = [];

    CLASS_ATTR_PATTERN.lastIndex = 0;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = CLASS_ATTR_PATTERN.exec(text)) !== null) {
        hits.push({ kind: 'attr', index: attrMatch.index, match: attrMatch });
    }
    CLASSNAME_CALL_PATTERN.lastIndex = 0;
    let callMatch: RegExpExecArray | null;
    while ((callMatch = CLASSNAME_CALL_PATTERN.exec(text)) !== null) {
        hits.push({ kind: 'call', index: callMatch.index, match: callMatch });
    }
    hits.sort((a, b) => a.index - b.index);

    const fragments: TextFragment[] = [];
    let coveredUntil = 0;

    for (const hit of hits) {
        if (hit.index < coveredUntil) {
            continue;
        }
        const m = hit.match;

        if (hit.kind === 'attr') {
            /*
             * m[0]: 매치 전체           e.g. ` className="`
             * m[1]: 속성명             e.g. `className` (또는 `[class]`, `ngClass` 등)
             * m[0] 마지막 문자: opener — `"` | `'` | `` ` `` | `{`
             *
             * `{` opener는 JSX expression — 그 안의 backtick 템플릿만 본문으로 사용한다.
             *  (그 외 표현식 형태는 helper 호출 스캔에서 처리)
             */
            let openerIdx = m.index + m[0].length - 1;
            if (text[openerIdx] === '{') {
                let j = openerIdx + 1;
                while (j < text.length && /\s/.test(text[j])) {
                    j++;
                }
                if (text[j] !== '`') {
                    continue;
                }
                openerIdx = j;
            }
            const body = extractLiteral(openerIdx);
            if (body == null) {
                continue;
            }
            fragments.push(body);
            coveredUntil = body.offset + body.text.length + 1; // 닫는 따옴표/백틱 너머까지 커버
            continue;
        }

        /*
         * m[0]: 매치 전체              e.g. `clsx(`, `lib.cn(`, `` cn` ``
         * m[1]: 식별자(점 표기 포함)   e.g. `clsx`, `lib.cn`
         * m[0] 마지막 문자: opener — `(` | `` ` ``
         */
        const fullName = m[1];
        const dotIdx = fullName.lastIndexOf('.');
        const baseName = dotIdx === -1 ? fullName : fullName.slice(dotIdx + 1);
        if (CLASSNAME_HELPER_SET.has(baseName) === false) {
            continue;
        }
        const openerIdx = m.index + m[0].length - 1;

        if (text[openerIdx] === '(') {
            const closeIdx = getMatchingParenthesisIndex(openerIdx);
            if (closeIdx === -1) {
                continue;
            }
            fragments.push(...collectStringLiterals(openerIdx + 1, closeIdx));
            // 중첩 호출(clsx(cn(...))) 재진입 회피.
            coveredUntil = closeIdx + 1;
            continue;
        }

        // tagged template: cn`flex p-4`
        const body = extractLiteral(openerIdx);
        if (body != null) {
            fragments.push(body);
        }
        coveredUntil = findCloserIndex(openerIdx, '`');
    }

    return fragments;
}

/**
 * 텍스트 전체에서 클래스 토큰을 추출한다.
 * findClassFragments가 coveredUntil 커서로 영역 중복을 이미 막아두므로 dedupe는 필요 없다.
 *
 * fragment(클래스 문자열 본문) → 공백 단위 토큰 분해 로직은 이 함수 안의 nested helper로 둔다.
 * 대괄호 안의 공백은 무시(arbitrary value `[grid-template-columns:1fr_2fr]` 대응).
 */
export function extractClassTokens(text: string): ClassToken[] {
    function tokenizeFragment(fragment: TextFragment, out: ClassToken[]): void {
        const { text: body, offset } = fragment;
        let i = 0;
        while (i < body.length) {
            while (i < body.length && /\s/.test(body[i])) {
                i++;
            }
            if (i >= body.length) {
                break;
            }
            const tokenStart = i;
            let depth = 0;
            while (i < body.length) {
                const ch = body[i];
                if (ch === '[') {
                    depth++;
                } else if (ch === ']') {
                    depth = Math.max(0, depth - 1);
                } else if (depth === 0 && /\s/.test(ch)) {
                    break;
                }
                i++;
            }
            const rawText = body.slice(tokenStart, i);
            if (rawText.length === 0) {
                continue;
            }
            const { utility, category, anchorLength } = parseRawClass(rawText);
            const tokenStartAbs = offset + tokenStart;
            const anchorStart = tokenStartAbs + utility.offset;
            out.push({
                start: tokenStartAbs,
                end: offset + i,
                anchorStart,
                anchorEnd: anchorStart + anchorLength,
                raw: rawText,
                category,
            });
        }
    }

    const fragments = findClassFragments(text);
    const tokens: ClassToken[] = [];
    for (const fragment of fragments) {
        tokenizeFragment(fragment, tokens);
    }
    return tokens;
}

// ---------------------------------------------------------------------------
// position resolution
// ---------------------------------------------------------------------------

/**
 * 텍스트의 각 줄 시작 offset을 미리 계산한다.
 * `\n` 위치를 한 번만 스캔해 두고, offset → Position 변환은 binary search로 처리.
 * 토큰마다 document.positionAt을 직접 호출하는 것보다 의존성·캐시 의존 없이 안정적.
 */
export function buildLineStarts(text: string): number[] {
    const starts: number[] = [0];
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) === 10 /* '\n' */) {
            starts.push(i + 1);
        }
    }
    return starts;
}

/**
 * 미리 계산된 lineStarts로 offset 두 개를 vscode.Range로 변환한다.
 * binary search로 offset → Position을 만든다 (line `lo`의 시작이 offset 이하인 가장 큰 lo).
 */
export function rangeFromOffsets(
    lineStarts: number[],
    start: number,
    end: number
): vscode.Range {
    function positionAt(offset: number): vscode.Position {
        let lo = 0;
        let hi = lineStarts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >>> 1;
            if (lineStarts[mid] > offset) {
                hi = mid - 1;
            } else {
                lo = mid;
            }
        }
        return new vscode.Position(lo, offset - lineStarts[lo]);
    }
    return new vscode.Range(positionAt(start), positionAt(end));
}
