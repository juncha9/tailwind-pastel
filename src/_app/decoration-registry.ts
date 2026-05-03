import * as vscode from 'vscode';
import { ARBITRARY_VALUE_COLOR, CATEGORY_STYLES, CSS_VARIABLE_COLOR } from '../_defs';
import { CategoryStyle, ClassToken, TailwindCategory } from '../_types';
import { rangeFromOffsets, withAlpha } from '../_libs';

/*
 * 토큰 raw 안에서 `--<id>` 위치를 찾는 패턴.
 *  - 시작은 `--` + (영문/언더스코어) — 숫자로 시작하는 ident는 CSS 명세상 invalid.
 *  - 이어지는 글자: 영문/숫자/`_`/`-`.
 */
const CSS_VARIABLE_PATTERN = /--[A-Za-z_][\w-]*/g;

/*
 * arbitrary value의 대괄호 안쪽 본문을 잡는 패턴.
 *  - `[12px]`, `[#fff]`, `[font:inherit]`, `[url(/x.png)]` 등의 `[...]`
 *  - capture group 1이 안쪽 본문 (대괄호 자체는 제외 — 카테고리 underline/색을 그대로 둠)
 *  - `[]` 빈 케이스는 의미 없으므로 `+`로 1자 이상 매칭
 */
const ARBITRARY_VALUE_PATTERN = /\[([^\]]+)\]/g;

// anchor 구간 — 카테고리 색 + bold(600). 분류를 결정한 prefix 부분에만 적용.
function buildAnchorDecoration(style: CategoryStyle): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
        color: style.color,
        fontWeight: '600',
    });
}

// full 구간 — 클래스 전체 길이에 카테고리 색 언더라인. 글자색은 건드리지 않음.
function buildFullDecoration(style: CategoryStyle): vscode.TextEditorDecorationType {
    const lineColor = withAlpha(style.color, 0.8);
    return vscode.window.createTextEditorDecorationType({
        textDecoration: `underline ${lineColor}; text-underline-offset: 3px; text-decoration-thickness: 1px;`,
    });
}

// variant 구간 — `hover:`, `md:`, `dark:`, `!`, 음수 `-` 등.
// utility와 같은 카테고리 색을 쓰되, anchor가 600이라 weight 400으로 자연스러운 위계 형성.
function buildVariantDecoration(style: CategoryStyle): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
        color: style.color,
        fontWeight: '400',
    });
}

// CSS 변수(`--xxx`) — 카테고리 색과 거리 둔 cool tone, weight 400.
function buildCssVariableDecoration(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
        color: CSS_VARIABLE_COLOR,
        fontWeight: '400',
    });
}

// arbitrary value(`[12px]` 안쪽) — "값/변수" 톤. weight 400으로 anchor와 위계 형성.
function buildArbitraryValueDecoration(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
        color: ARBITRARY_VALUE_COLOR,
        fontWeight: '400',
    });
}

/*
 * 데코레이션 인스턴스의 소유자.
 *  - 4종 데코레이션(anchor / full / variant / cssVariable) 생성·해제·적용을 한 곳에서 담당.
 *  - apply()는 토큰 목록에서 카테고리별 range bucket을 빌드해 setDecorations로 발행한다.
 *  - reinit()은 config 변경 시 색·스타일을 갱신하기 위해 dispose → init을 한 번에 처리.
 */
export class DecorationRegistry implements vscode.Disposable {
    private readonly anchor = new Map<TailwindCategory, vscode.TextEditorDecorationType>();
    private readonly full = new Map<TailwindCategory, vscode.TextEditorDecorationType>();
    private readonly variant = new Map<TailwindCategory, vscode.TextEditorDecorationType>();
    private cssVariable: vscode.TextEditorDecorationType | undefined;
    private arbitraryValue: vscode.TextEditorDecorationType | undefined;

    constructor() {
        this.init();
    }

    /** config 변경 시 모든 인스턴스를 새로 만든다. */
    reinit(): void {
        this.dispose();
        this.init();
    }

    dispose(): void {
        for (const d of this.anchor.values()) d.dispose();
        for (const d of this.full.values()) d.dispose();
        for (const d of this.variant.values()) d.dispose();
        this.cssVariable?.dispose();
        this.arbitraryValue?.dispose();
        this.anchor.clear();
        this.full.clear();
        this.variant.clear();
        this.cssVariable = undefined;
        this.arbitraryValue = undefined;
    }

    /** 한 에디터의 모든 하이라이트를 비운다 (toggle off 시 사용). */
    clear(editor: vscode.TextEditor): void {
        for (const d of this.anchor.values()) editor.setDecorations(d, []);
        for (const d of this.full.values()) editor.setDecorations(d, []);
        for (const d of this.variant.values()) editor.setDecorations(d, []);
        if (this.cssVariable != null) {
            editor.setDecorations(this.cssVariable, []);
        }
        if (this.arbitraryValue != null) {
            editor.setDecorations(this.arbitraryValue, []);
        }
    }

    /** 토큰을 카테고리별 bucket으로 모아 setDecorations로 적용한다. */
    apply(editor: vscode.TextEditor, tokens: readonly ClassToken[], lineStarts: number[]): void {
        const anchorBuckets = this.makeBuckets();
        const fullBuckets = this.makeBuckets();
        const variantBuckets = this.makeBuckets();
        const cssVariableRanges: vscode.Range[] = [];
        const arbitraryValueRanges: vscode.Range[] = [];

        for (const token of tokens) {
            anchorBuckets.get(token.category)?.push(
                rangeFromOffsets(lineStarts, token.anchorStart, token.anchorEnd)
            );
            fullBuckets.get(token.category)?.push(
                rangeFromOffsets(lineStarts, token.start, token.end)
            );
            // [token.start, token.anchorStart) — variant prefix / `!` / 음수 `-` 구간.
            // 비어있지 않을 때(즉, 실제 modifier가 붙은 토큰)만 누적.
            if (token.anchorStart > token.start) {
                variantBuckets.get(token.category)?.push(
                    rangeFromOffsets(lineStarts, token.start, token.anchorStart)
                );
            }
            // 토큰 raw 안의 `--<id>` 위치 — 대부분의 토큰엔 없으므로 includes로 빠르게 거른다.
            if (token.raw.includes('--')) {
                CSS_VARIABLE_PATTERN.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = CSS_VARIABLE_PATTERN.exec(token.raw)) !== null) {
                    const varStart = token.start + m.index;
                    cssVariableRanges.push(
                        rangeFromOffsets(lineStarts, varStart, varStart + m[0].length)
                    );
                }
            }
            // 토큰 raw 안의 `[...]` arbitrary value — 안쪽 본문만 잡는다 (대괄호 자체는 제외).
            if (token.raw.includes('[')) {
                ARBITRARY_VALUE_PATTERN.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = ARBITRARY_VALUE_PATTERN.exec(token.raw)) !== null) {
                    // m.index는 `[` 위치 — 안쪽은 +1 부터 시작, m[1].length 만큼.
                    const innerStart = token.start + m.index + 1;
                    arbitraryValueRanges.push(
                        rangeFromOffsets(lineStarts, innerStart, innerStart + m[1].length)
                    );
                }
            }
        }

        this.applyBucketed(editor, anchorBuckets, this.anchor);
        this.applyBucketed(editor, fullBuckets, this.full);
        this.applyBucketed(editor, variantBuckets, this.variant);
        if (this.cssVariable != null) {
            editor.setDecorations(this.cssVariable, cssVariableRanges);
        }
        if (this.arbitraryValue != null) {
            editor.setDecorations(this.arbitraryValue, arbitraryValueRanges);
        }
    }

    private init(): void {
        for (const style of CATEGORY_STYLES) {
            this.anchor.set(style.category, buildAnchorDecoration(style));
            this.full.set(style.category, buildFullDecoration(style));
            this.variant.set(style.category, buildVariantDecoration(style));
        }
        this.cssVariable = buildCssVariableDecoration();
        this.arbitraryValue = buildArbitraryValueDecoration();
    }

    private makeBuckets(): Map<TailwindCategory, vscode.Range[]> {
        const m = new Map<TailwindCategory, vscode.Range[]>();
        for (const style of CATEGORY_STYLES) {
            m.set(style.category, []);
        }
        return m;
    }

    private applyBucketed(
        editor: vscode.TextEditor,
        buckets: Map<TailwindCategory, vscode.Range[]>,
        decorations: Map<TailwindCategory, vscode.TextEditorDecorationType>
    ): void {
        for (const [category, ranges] of buckets) {
            const decoration = decorations.get(category);
            if (decoration == null) {
                continue;
            }
            editor.setDecorations(decoration, ranges);
        }
    }
}
