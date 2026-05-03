import { CategoryStyle, SourceLanguage, TailwindCategory } from '../_types';

export const UPDATE_DEBOUNCE_MS = 150;

export const SUPPORTED_LANGUAGES: ReadonlySet<SourceLanguage> = new Set<SourceLanguage>([
    'typescriptreact',
    'javascriptreact',
    'html',
    'vue',
    'svelte',
    'astro',
]);

/*
 * 클래스 문자열을 담을 수 있는 속성 이름.
 * 새 항목을 추가하면 [attr]=`...` 형태(Angular property binding)도 자동 매칭된다.
 */
export const CLASS_ATTRIBUTES: readonly string[] = [
    'class',      // HTML, Vue, Svelte, Astro
    'className',  // JSX/TSX
    'ngClass',    // Angular
    'class:list', // Astro
];

/*
 * 클래스명을 합치는 데 흔히 쓰이는 헬퍼 함수 이름.
 * 이 함수들의 호출 인자 안에 있는 string literal을 클래스 문자열로 간주한다.
 *  e.g. clsx('flex p-4', cond && 'bg-red-500', { 'hidden': isHidden })
 *       cn(`gap-2`)            ← tagged template도 매칭
 *       lib.cn('flex')         ← namespaced 호출도 매칭
 */
export const CLASSNAME_HELPERS: readonly string[] = [
    'clsx',
    'cn',
    'cx',
    'cva',
    'tw',
    'twMerge',
    'twJoin',
    'classNames',
    'classnames',
];

/*
 * 클래스 속성의 "여는 부분"을 찾는 패턴.
 * tailwindcss-language-service의 matchClassAttributes와 동일한 모양.
 *
 * 매칭 대상: `class="`, ` className='`, `:class="`, `[class]="`, `class={`,
 *           `class={\`` 등 — 본문 직전 opener 문자(`"` `'` `` ` `` `{`) 까지만.
 * 본문 추출은 readClassAttrBody에서 별도로 한다.
 *
 * 매치 그룹:
 *   match[0]: 매치 전체           e.g. ` className="`
 *   match[1]: 속성명             e.g. `className` (또는 `[class]`, `ngClass` 등)
 *   match[0] 마지막 문자가 opener — `"` | `'` | `` ` `` | `{` 중 하나
 */
export const CLASS_ATTR_PATTERN = (() => {
    // 각 속성마다 plain(`class`)과 bracket-bound(`[class]`, Angular property binding) 둘 다 매칭
    const escaped = CLASS_ATTRIBUTES.flatMap((a) => [a, `\\[${a}\\]`]).join('|');
    return new RegExp(`(?:\\s|:|\\()(${escaped})\\s*=\\s*['"\`{]`, 'gi');
})();

/*
 * 함수 호출 식별자 + 여는 부분을 찾는 패턴.
 * tailwindcss-language-service의 matchClassFunctions와 동일한 모양.
 *
 * 임의의 식별자(점 표기 포함)를 잡은 뒤, 호출자가 CLASSNAME_HELPERS 목록과
 * 비교해 헬퍼인지 확인한다(post-filter). namespaced 호출(`lib.cn(`)이나
 * tagged template(`` cn`...` ``)도 자연히 잡힌다.
 *
 * 매치 그룹:
 *   match[0]: 매치 전체           e.g. `clsx(`, `lib.cn(`, `` cn` ``
 *   match[1]: 식별자(점 표기 포함) e.g. `clsx`, `lib.cn`, `cn`
 *   match[0] 마지막 문자: `(` | `` ` ``
 */
export const CLASSNAME_CALL_PATTERN =
    /(?<=^|[:=,;\s{()\[])([\p{ID_Start}$_][\p{ID_Continue}$_.]*)[(`]/giu;

// 카테고리 색상 팔레트 (글자색 기준).
// Tailwind 400-shade 행에서 6색을 채택 — 타겟 사용자에 친숙하고 다크/라이트 양 테마에서
// 검증된 가독성을 가진다.
export const CATEGORY_STYLES: readonly CategoryStyle[] = [
    { category: 'typography', color: 'rgb(251, 191,  36)', label: 'Typography' }, // amber-400
    { category: 'box',        color: 'rgb( 52, 211, 153)', label: 'Box' },        // emerald-400
    { category: 'layout',     color: 'rgb( 96, 165, 250)', label: 'Layout' },     // blue-400
    { category: 'motion',     color: 'rgb(167, 139, 250)', label: 'Motion' },     // violet-400
    { category: 'surface',    color: 'rgb(244, 114, 182)', label: 'Surface' },    // pink-400
    { category: 'other',      color: 'rgb(156, 163, 175)', label: 'Other' },      // gray-400
];

// CSS 커스텀 프로퍼티(`--xxx`) 색상 — 카테고리 6색 어디와도 거리를 두기 위해
// cool tone(slate-300)으로 골라 utility 본체와 시각적으로 구분되게 한다.
export const CSS_VARIABLE_COLOR = 'rgb(203, 213, 225)'; // slate-300

// arbitrary value(`[12px]`, `[#fff]`, `[font:inherit]`)의 안쪽 — "값/변수" 톤.
// CSS 변수 색과는 hue를 달리한 warm neutral(stone-300)로 두어 두 종류가 한 줄에
// 같이 등장해도 서로 구분된다.
export const ARBITRARY_VALUE_COLOR = 'rgb(214, 211, 209)'; // stone-300

// 빠른 lookup용 Map.
export const CATEGORY_STYLE_MAP: ReadonlyMap<TailwindCategory, CategoryStyle> = new Map(
    CATEGORY_STYLES.map(style => [style.category, style])
);

// utility 이름 prefix 별 카테고리 매핑.
// 우선순위: 더 길고 구체적인 prefix가 먼저 매칭되어야 한다 (예: "min-w-" > "min-").
// 배열 순서대로 시도하므로 작성 순서가 곧 우선순위.
export const PREFIX_CATEGORY_RULES: ReadonlyArray<readonly [string, TailwindCategory]> = [
    // ---- box: sizing (min/max-w/h를 먼저, 그다음 short prefix) ----
    ['min-w-', 'box'], ['min-h-', 'box'],
    ['max-w-', 'box'], ['max-h-', 'box'],
    ['size-', 'box'], ['w-', 'box'], ['h-', 'box'],

    // ---- box: spacing (margin / padding / space) ----
    ['space-x-', 'box'], ['space-y-', 'box'],
    ['p-', 'box'], ['px-', 'box'], ['py-', 'box'],
    ['pt-', 'box'], ['pr-', 'box'], ['pb-', 'box'], ['pl-', 'box'],
    ['ps-', 'box'], ['pe-', 'box'],
    ['m-', 'box'], ['mx-', 'box'], ['my-', 'box'],
    ['mt-', 'box'], ['mr-', 'box'], ['mb-', 'box'], ['ml-', 'box'],
    ['ms-', 'box'], ['me-', 'box'],

    // ---- layout: positioning ----
    ['top-', 'layout'], ['right-', 'layout'], ['bottom-', 'layout'], ['left-', 'layout'],
    ['inset-', 'layout'], ['z-', 'layout'],
    ['static', 'layout'], ['fixed', 'layout'], ['absolute', 'layout'],
    ['relative', 'layout'], ['sticky', 'layout'],

    // ---- layout: flex/grid 정렬 + display + container + box-model ----
    ['gap-x-', 'layout'], ['gap-y-', 'layout'], ['gap-', 'layout'],
    ['items-', 'layout'], ['justify-', 'layout'], ['content-', 'layout'],
    ['self-', 'layout'], ['place-', 'layout'], ['order-', 'layout'],
    ['col-', 'layout'], ['row-', 'layout'],
    ['grid-cols-', 'layout'], ['grid-rows-', 'layout'],
    ['grid-flow-', 'layout'], ['auto-cols-', 'layout'], ['auto-rows-', 'layout'],
    ['flex-', 'layout'], ['basis-', 'layout'], ['shrink', 'layout'], ['grow', 'layout'],
    ['overflow-', 'layout'], ['object-', 'layout'], ['box-', 'layout'],
    ['float-', 'layout'], ['clear-', 'layout'],
    ['isolate', 'layout'], ['isolation-', 'layout'],
    ['aspect-', 'layout'], ['columns-', 'layout'],

    // ---- typography ----
    ['text-', 'typography'], ['font-', 'typography'], ['leading-', 'typography'],
    ['tracking-', 'typography'], ['whitespace-', 'typography'], ['break-', 'typography'],
    ['truncate', 'typography'], ['line-clamp-', 'typography'],
    ['list-', 'typography'], ['placeholder-', 'typography'],
    ['indent-', 'typography'], ['align-', 'typography'], ['decoration-', 'typography'],
    ['underline', 'typography'], ['overline', 'typography'], ['line-through', 'typography'],
    ['no-underline', 'typography'], ['italic', 'typography'], ['not-italic', 'typography'],
    ['uppercase', 'typography'], ['lowercase', 'typography'], ['capitalize', 'typography'],
    ['normal-case', 'typography'], ['antialiased', 'typography'], ['subpixel-antialiased', 'typography'],

    // ---- surface: background ----
    ['bg-', 'surface'], ['from-', 'surface'], ['via-', 'surface'], ['to-', 'surface'],

    // ---- surface: border / radius / shadow / ring / divide / outline ----
    ['border', 'surface'], ['rounded', 'surface'],
    ['ring', 'surface'], ['divide-', 'surface'],
    ['outline-', 'surface'], ['outline', 'surface'],
    ['shadow', 'surface'],

    // ---- surface: visual effects (opacity / backdrop / blur / filter) ----
    ['opacity-', 'surface'], ['backdrop-', 'surface'],
    ['blur', 'surface'],
    ['brightness-', 'surface'], ['contrast-', 'surface'],
    ['grayscale', 'surface'], ['hue-rotate-', 'surface'], ['invert', 'surface'],
    ['saturate-', 'surface'], ['sepia', 'surface'], ['drop-shadow', 'surface'],
    ['mix-blend-', 'surface'], ['bg-blend-', 'surface'],

    // ---- motion: transition / animation / transform ----
    ['transition', 'motion'], ['duration-', 'motion'],
    ['ease-', 'motion'], ['delay-', 'motion'], ['animate-', 'motion'],
    ['transform', 'motion'],
    ['translate-', 'motion'], ['rotate-', 'motion'],
    ['scale-', 'motion'], ['skew-', 'motion'], ['origin-', 'motion'],

    // ---- other: interaction (cursor / select / pointer-events / scroll / etc) ----
    ['cursor-', 'other'], ['pointer-events-', 'other'],
    ['select-', 'other'], ['resize-', 'other'], ['resize', 'other'],
    ['scroll-', 'other'], ['snap-', 'other'],
    ['touch-', 'other'], ['will-change-', 'other'],
    ['accent-', 'other'], ['caret-', 'other'],
    ['appearance-', 'other'],

    // ---- layout: display 키워드 (마지막에 — 'flex' 단독은 다른 'flex-' 룰 뒤로) ----
    ['container', 'layout'],
    ['hidden', 'layout'], ['block', 'layout'], ['inline-block', 'layout'],
    ['inline-flex', 'layout'], ['inline-grid', 'layout'], ['inline', 'layout'],
    ['flex', 'layout'], ['grid', 'layout'], ['table', 'layout'],
    ['contents', 'layout'], ['flow-root', 'layout'],
    ['visible', 'layout'], ['invisible', 'layout'], ['collapse', 'layout'],
];

// 매칭 결과 entry. anchorLength는 카테고리 anchor의 표시 길이(rule의 trailing `-`는 제외).
export interface AnchorHit {
    readonly category: TailwindCategory;
    readonly anchorLength: number;
}

/*
 * PREFIX_CATEGORY_RULES를 두 종류 lookup으로 미리 분리해 두어 매칭 비용을
 * O(R) 선형 → O(1) Map 조회로 줄인다.
 *
 *  - DASH_PREFIX_LOOKUP   : `bg-` `min-w-` 처럼 trailing `-`로 끝나는 룰. key는 trailing `-`를 뗀 형태.
 *                           매칭은 utility의 첫 segment(들)과 정확 비교.
 *  - EXACT_KEYWORD_LOOKUP : `flex` `border` 같은 단일 키워드 룰. utility 자체이거나 `${prefix}-`로
 *                           시작할 때 매칭.
 *
 * 우선순위는 segment 길이로 결정 — 더 긴 segment(2-segment)부터 dash → 1-segment dash → exact whole →
 * 1-segment exact. 룰 배열 작성 순서와 결과가 일치하는지는 테스트로 보장한다.
 */
export const DASH_PREFIX_LOOKUP: ReadonlyMap<string, AnchorHit> = (() => {
    const map = new Map<string, AnchorHit>();
    for (const [prefix, category] of PREFIX_CATEGORY_RULES) {
        if (prefix.endsWith('-') === false) {
            continue;
        }
        const key = prefix.slice(0, -1);
        map.set(key, { category, anchorLength: key.length });
    }
    return map;
})();

export const EXACT_KEYWORD_LOOKUP: ReadonlyMap<string, AnchorHit> = (() => {
    const map = new Map<string, AnchorHit>();
    for (const [prefix, category] of PREFIX_CATEGORY_RULES) {
        if (prefix.endsWith('-')) {
            continue;
        }
        map.set(prefix, { category, anchorLength: prefix.length });
    }
    return map;
})();
