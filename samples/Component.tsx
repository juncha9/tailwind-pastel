/*
 * JSX className 검증 — 다양한 form 을 한 데 모음.
 *  - 정적 className="..."
 *  - tagged template className={`...`}  (no `${}` interpolation)
 *  - clsx / cn / twMerge / cva / classNames 호출
 *  - namespaced 호출 (lib.cn(...))
 *  - tagged template helper (cn`...`)
 *  - object key 문자열 안의 클래스 (clsx({ 'flex p-4': cond }))
 *  - 중첩 helper (clsx(cn('...')))
 *
 * `${}` interpolation 이 들어간 template literal 은 position mapping 안전성 때문에
 * 토큰화에서 제외되어야 한다.
 */

import * as React from 'react';
import { clsx } from 'clsx';
import { cn } from './utils/cn';
import { cva } from 'class-variance-authority';
import { twMerge, twJoin } from 'tailwind-merge';
import classNames from 'classnames';
import * as lib from './utils';

const accent = 'amber';

function Static() {
    return (
        <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-6 py-3 bg-white border-b border-gray-200 shadow-sm transition-shadow duration-200 hover:shadow">
            <a className="inline-flex items-center gap-2 font-extrabold tracking-tight text-gray-900 no-underline">
                <span className="block w-2.5 h-2.5 rounded-full bg-amber-500" />
                Brand
            </a>
        </header>
    );
}

function TaggedTemplate() {
    return (
        <button
            className={`
                inline-flex items-center gap-2
                px-4 py-2.5 bg-gray-900 text-white
                rounded-full font-semibold cursor-pointer
                transition-all duration-150
                hover:bg-gray-800 hover:scale-105 active:scale-95
            `}
        >
            Click
        </button>
    );
}

function HelperCalls({ active, disabled }: { active: boolean; disabled: boolean }) {
    return (
        <>
            {/* clsx — 조건부, 객체 키 문자열, falsy 모두 한 호출에 */}
            <div
                className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-md',
                    active && 'bg-blue-500 text-white',
                    disabled && 'opacity-50 cursor-not-allowed',
                    {
                        'ring-2 ring-blue-400': active,
                        'border border-gray-200': !active,
                    },
                )}
            />

            {/* cn — 다중 라인 인자 -->*/}
            <div
                className={cn(
                    'flex flex-col gap-2',
                    'p-5 bg-white border border-gray-200 rounded-xl',
                    'shadow-sm hover:shadow-md transition-shadow',
                )}
            />

            {/* twMerge / twJoin */}
            <div className={twMerge('p-4 p-2', 'text-sm text-base')} />
            <div className={twJoin('flex', 'gap-2', active && 'items-center')} />

            {/* classNames (legacy) */}
            <div className={classNames('grid grid-cols-3 gap-4', { 'opacity-50': disabled })} />

            {/* tagged template helper */}
            <div className={cn`p-4 bg-amber-100 text-amber-900 rounded`} />

            {/* namespaced helper — `lib.cn` 도 매칭되어야 함 */}
            <div className={lib.cn('inline-flex items-center gap-1 text-xs text-gray-500')} />

            {/* 중첩 helper — 안쪽 cn 의 string도 잡혀야 함 */}
            <div className={clsx('rounded-lg', cn('p-4 bg-gray-50'))} />
        </>
    );
}

// cva — variant + base + compoundVariants 안의 string 모두 잡혀야 함.
const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
    {
        variants: {
            intent: {
                primary: 'bg-blue-500 text-white hover:bg-blue-600',
                secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
                ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
            },
            size: {
                sm: 'h-8 px-3 text-sm',
                md: 'h-10 px-4 text-base',
                lg: 'h-12 px-6 text-lg',
            },
        },
        compoundVariants: [
            {
                intent: 'primary',
                size: 'lg',
                className: 'shadow-md hover:shadow-lg',
            },
        ],
        defaultVariants: { intent: 'primary', size: 'md' },
    },
);

// `${}` interpolation 이 들어간 template — 토큰화에서 제외되어야 한다.
function Skipped() {
    return <div className={`flex p-4 bg-${accent}-500`} />;
}

export { Static, TaggedTemplate, HelperCalls, buttonVariants, Skipped };
