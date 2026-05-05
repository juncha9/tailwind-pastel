<script lang="ts">
    let count = 0;
    let active = false;
</script>

<!--
    Svelte: 일반 class="..." 그리고 표현식 안의 helper 호출.
    Svelte 고유 `class:foo={cond}` 디렉티브는 별개 매칭 패턴이 아니라 그대로 attribute 로 보임.
-->
<div
    class="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900"
    class:opacity-50={!active}
    class:ring-2={active}
>
    <span class="font-bold tracking-tight">Count</span>
    <span class="font-mono tabular-nums min-w-8 text-right">{count}</span>
    <button
        on:click={() => (count += 1)}
        class="ml-auto px-3 py-1.5 bg-emerald-500 text-white rounded-full font-semibold cursor-pointer transition-transform hover:scale-105 active:scale-95"
    >
        +1
    </button>
</div>

<!-- tagged template `cn` 안의 string 도 잡혀야 함 -->
<div class={`relative inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-900 rounded-md`}>
    Static template (no ${} interpolation)
</div>
