// 본 익스텐션이 다루는 에디터 언어. languageId의 부분집합.
export type SourceLanguage =
    | 'typescriptreact'
    | 'javascriptreact'
    | 'html'
    | 'vue'
    | 'svelte'
    | 'astro';

// Tailwind 유틸리티 클래스 카테고리 (A안 6개).
// 좁은 분류는 시각적으로 구분이 어려워 6개 상위 그룹으로 통합.
export type TailwindCategory =
    | 'layout'      // display + positioning + flex/grid 정렬 (1, 2 + items/justify/gap)
    | 'box'         // sizing + spacing (w/h, m/p, gap-는 layout에 포함하지 않고 spacing 성격이지만 layout으로 둠)
    | 'typography'  // 글자 관련 모두
    | 'surface'     // border + radius + shadow + ring + divide + bg + opacity + backdrop + blur 등 시각 표면
    | 'motion'      // transition + animation + transform
    | 'other';      // interaction(cursor/select 등) + 미분류 fallback

export interface CategoryStyle {
    readonly category: TailwindCategory;
    readonly color: string; // rgb(r,g,b)
    readonly label: string;
}

// 문서에서 잘라낸 텍스트 조각 + 그 시작 offset.
// 클래스 문자열 본문(class="..."의 ...) 또는 raw 안에서의 utility 부분을 표현.
export interface TextFragment {
    readonly text: string;
    readonly offset: number;
}

// 문서 내에서 Tailwind 클래스 토큰 하나를 나타내는 인터페이스.
//  - [start, end)         : 토큰 전체 영역 (variant prefix 포함)
//  - [anchorStart, anchorEnd) : 카테고리 anchor 영역 — 분류를 결정한 prefix 부분 (e.g. `bg-red-500`의 `bg`)
//  - [start, anchorStart) : variant 영역 (`hover:`, `md:`, `!`, 음수 `-` 등). 비어있을 수 있음
export interface ClassToken {
    readonly start: number;
    readonly end: number;
    readonly anchorStart: number;
    readonly anchorEnd: number;
    readonly raw: string;
    readonly category: TailwindCategory;
}


