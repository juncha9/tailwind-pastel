import * as vscode from 'vscode';
import { ClassToken } from '../_types';
import { extractClassTokens } from '../_libs';

/*
 * 문서별 토큰 캐시 엔트리. version은 vscode.TextDocument.version과 비교용,
 * text는 incremental 재스캔에서 변경 전 본문을 참고하기 위해 보관.
 */
interface DocCache {
    readonly version: number;
    readonly text: string;
    readonly tokens: readonly ClassToken[];
}

// 변경이 같은 라인 안이고 추가/삭제 모두 줄넘김이 없는 경우만 incremental을 시도.
// 윈도우 = 변경 라인 ±LINE_BUFFER. 멀티라인 helper call이 윈도우 밖으로 나가지 않는다는 가정.
const LINE_BUFFER = 5;
// 단일 변경이라도 큰 페이스트라면 full 재스캔이 더 안전.
const INCREMENTAL_MAX_CHARS = 200;

/*
 * 문서 → 토큰 캐시. 두 단계 fast-path를 제공한다.
 *  ① version match  → 캐시 그대로 반환 (visibility 변경, config 캐스케이드 등)
 *  ② 단순 변경 1건  → windowed 부분 재스캔 (typing 시 핫패스)
 *  ③ 그 외          → 전체 재추출
 *
 * Disposable이 아닌 이유: WeakMap이라 document 가 GC되면 자동 정리됨.
 */
export class TokenStore {
    private readonly cache = new WeakMap<vscode.TextDocument, DocCache>();

    getOrExtract(
        document: vscode.TextDocument,
        text: string,
        pendingChanges: readonly vscode.TextDocumentContentChangeEvent[] | undefined
    ): readonly ClassToken[] {
        const cached = this.cache.get(document);
        if (cached?.version === document.version) {
            return cached.tokens;
        }
        if (cached != null && pendingChanges != null) {
            const incremental = this.tryIncrementalRescan(cached, text, pendingChanges);
            if (incremental != null) {
                this.cache.set(document, { version: document.version, text, tokens: incremental });
                return incremental;
            }
        }
        const tokens = extractClassTokens(text);
        this.cache.set(document, { version: document.version, text, tokens });
        return tokens;
    }

    /*
     * cached 토큰을 변경 1건에 맞춰 부분 재계산한다.
     * 사용 가능 조건:
     *  - 변경 1개
     *  - 변경 전/후 모두 줄넘김 미포함
     *  - 변경 길이/추가 텍스트 길이 모두 INCREMENTAL_MAX_CHARS 이하
     *
     * 알고리즘:
     *  ① 변경이 위치한 post-edit 라인 범위(±LINE_BUFFER)를 윈도우로 잡는다.
     *  ② cached 토큰을 post-edit 좌표로 매핑(변경 이후 토큰은 delta만큼 shift, 변경 영역과 겹치는 토큰은 drop).
     *  ③ 윈도우와 겹치는 cached 토큰을 drop.
     *  ④ 윈도우 substring을 extractClassTokens로 재스캔하고 absolute offset으로 환산해 합친다.
     */
    private tryIncrementalRescan(
        cached: DocCache,
        newText: string,
        changes: readonly vscode.TextDocumentContentChangeEvent[]
    ): ClassToken[] | null {
        if (changes.length !== 1) {
            return null;
        }
        const change = changes[0];
        if (change.text.length > INCREMENTAL_MAX_CHARS || change.rangeLength > INCREMENTAL_MAX_CHARS) {
            return null;
        }
        if (change.text.includes('\n')) {
            return null;
        }
        const removed = cached.text.slice(change.rangeOffset, change.rangeOffset + change.rangeLength);
        if (removed.includes('\n')) {
            return null;
        }

        const preStart = change.rangeOffset;
        const preEnd = change.rangeOffset + change.rangeLength;
        const delta = change.text.length - change.rangeLength;
        const postStart = preStart;
        const postEnd = preStart + change.text.length;

        /*
         * 윈도우 경계 — ±LINE_BUFFER 라인.
         *  - windowStart는 발견된 \n 위치에 둔다 (substring 시작 직전이 \n) — CLASS_ATTR_PATTERN의
         *    `(?:\s|:|\()` 같은 leading 문자 클래스가 substring 첫 매치에서도 정상 작동하도록 보장.
         *  - windowEnd는 \n 위치 또는 텍스트 끝.
         */
        let windowStart = postStart;
        {
            let lines = 0;
            while (windowStart > 0) {
                windowStart--;
                if (newText.charCodeAt(windowStart) === 10) {
                    lines++;
                    if (lines > LINE_BUFFER) {
                        break;
                    }
                }
            }
        }
        let windowEnd = postEnd;
        {
            let lines = 0;
            while (windowEnd < newText.length) {
                if (newText.charCodeAt(windowEnd) === 10) {
                    lines++;
                    if (lines > LINE_BUFFER) {
                        break;
                    }
                }
                windowEnd++;
            }
        }

        // cached 토큰 → post-edit 좌표로 매핑.
        const shifted: ClassToken[] = [];
        for (const t of cached.tokens) {
            if (t.end > preStart && t.start < preEnd) {
                continue; // 변경 영역과 겹침
            }
            if (t.start >= preEnd) {
                shifted.push({
                    start: t.start + delta,
                    end: t.end + delta,
                    anchorStart: t.anchorStart + delta,
                    anchorEnd: t.anchorEnd + delta,
                    raw: t.raw,
                    category: t.category,
                });
            } else {
                shifted.push(t);
            }
        }

        // 윈도우와 겹치는 토큰 drop, 그 외는 보존.
        const kept = shifted.filter(t => t.end <= windowStart || t.start >= windowEnd);

        // 윈도우 재스캔. lookbehind를 가진 regex가 substring 시작점에서 오작동하지 않도록
        // windowStart는 줄 시작에 맞춰져 있다.
        const windowText = newText.slice(windowStart, windowEnd);
        const windowTokens = extractClassTokens(windowText);
        const fresh: ClassToken[] = windowTokens.map(t => ({
            start: t.start + windowStart,
            end: t.end + windowStart,
            anchorStart: t.anchorStart + windowStart,
            anchorEnd: t.anchorEnd + windowStart,
            raw: t.raw,
            category: t.category,
        }));

        const merged = kept.concat(fresh);
        merged.sort((a, b) => a.start - b.start);
        return merged;
    }
}
