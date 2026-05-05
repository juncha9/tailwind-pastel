<script setup lang="ts">
import { ref, computed } from 'vue';

const open = ref(false);
const variant = ref<'primary' | 'ghost'>('primary');

const buttonClass = computed(() =>
    variant.value === 'primary'
        ? 'bg-blue-500 text-white hover:bg-blue-600'
        : 'bg-transparent text-gray-700 hover:bg-gray-100',
);
</script>

<template>
    <!-- Vue: plain class="" 와 :class="..." (binding) 모두 매칭 -->
    <article class="grid grid-cols-[240px_1fr] gap-6 p-8 bg-gray-50 rounded-xl font-sans text-gray-900">
        <aside class="sticky top-4 p-4 bg-white border border-gray-200 rounded-lg text-sm">
            Sidebar
        </aside>

        <main :class="['flex flex-col gap-4', open ? 'opacity-100' : 'opacity-50']">
            <h2 class="text-2xl font-extrabold tracking-tight">Page title</h2>
            <p class="text-sm leading-relaxed text-gray-700">
                Vue's <code class="font-mono text-blue-600">:class</code>
                binding is detected the same as plain <code class="font-mono text-blue-600">class</code>.
            </p>

            <!-- 객체 form :class -->
            <button
                :class="{
                    'inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold': true,
                    'bg-blue-500 text-white hover:bg-blue-600': variant === 'primary',
                    'bg-gray-100 text-gray-900 hover:bg-gray-200': variant === 'ghost',
                }"
            >
                Action
            </button>

            <!-- computed string -->
            <button :class="`px-4 py-2 rounded-md font-semibold ${buttonClass}`">
                Computed (skipped — has ${} interpolation)
            </button>

            <!-- 정적 + 동적 혼합 array -->
            <span :class="['inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full', open && 'bg-amber-100 text-amber-900']" />
        </main>
    </article>
</template>
