# Tailwind Pastel — samples

`launch.json`의 `debug` 설정이 이 폴더를 워크스페이스로 열어 Extension Host 를 띄운다.
F5 로 실행하면 아래 파일들이 모두 카테고리별로 색이 입혀진 상태로 보여야 한다.

| 파일                | 검증 포인트                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `index.html`        | 6 개 카테고리(layout/box/typography/surface/motion/other) 가 한 줄에 모두 등장하는 케이스    |
| `variants.html`     | `hover:` `md:` `dark:` `group-` `peer-` `data-[]` `aria-` `has-[]`, `!`, 음수 `-` 변형        |
| `arbitrary.html`    | `[12px]` `[#fff]` `[var(--x)]` `[font:inherit]` 같은 arbitrary value — 안쪽이 stone-300 톤   |
| `edge-cases.html`   | 빈 class, 따옴표 두 종류, 공백/탭/개행, Angular `[class]`/`ngClass`, Vue `:class`, Astro `class:list` |
| `Component.tsx`     | className 정적 / tagged template / `clsx` / `cn` / `twMerge` / `cva` / `classNames` / namespaced / 중첩 |
| `Page.vue`          | `<template>` 안의 `class=""`, `:class="..."`, `:class="[...]"`, `:class="{...}"`             |
| `Widget.svelte`     | Svelte `class="..."` + `class:foo={cond}` directive + tagged template                         |
| `Header.astro`      | Astro `class="..."` + `class:list={[...]}`                                                   |

## 빠른 검증 체크리스트

- [ ] `flex` `grid` `items-*` `justify-*` `gap-*` `top-*` 의 anchor 가 **파랑(layout)**
- [ ] `w-*` `h-*` `min-w-*` `max-w-*` `p-*` `m-*` `space-x-*` 의 anchor 가 **에메랄드(box)**
- [ ] `text-*` `font-*` `leading-*` `tracking-*` `truncate` 의 anchor 가 **앰버(typography)**
- [ ] `bg-*` `border*` `rounded*` `shadow*` `ring*` `opacity-*` 의 anchor 가 **핑크(surface)**
- [ ] `transition*` `duration-*` `animate-*` `transform` `translate-*` `rotate-*` 의 anchor 가 **바이올렛(motion)**
- [ ] `cursor-*` `select-*` `pointer-events-*` `scroll-*` `snap-*` 의 anchor 가 **회색(other)**
- [ ] `hover:` `md:` `dark:` `!` `-` 같은 variant 영역은 같은 카테고리 색의 weight 400 (anchor 보다 약함)
- [ ] arbitrary value 안의 `[12px]` `[#fff]` 본문은 stone-300, `var(--brand)` 의 `--brand` 는 slate-300
- [ ] `${}` interpolation 이 든 template literal 은 토큰화 제외 (Component.tsx 의 `Skipped`)
