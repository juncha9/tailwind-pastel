import * as vscode from 'vscode';
import { UPDATE_DEBOUNCE_MS } from '../_defs';

export type RefreshFn = (
    editor: vscode.TextEditor,
    pendingChanges: readonly vscode.TextDocumentContentChangeEvent[] | undefined
) => void;

/*
 * 에디터별 디바운스 + 변경 누적 매니저.
 *  - recordChanges : onDidChangeTextDocument에서 변경을 누적
 *  - schedule      : 디바운스 타이머 설정 (호출 시 기존 타이머는 취소)
 *  - 타이머 만료 시 누적된 changes를 refresh 콜백에 전달하고 큐 비움
 *  - fireNow       : 디바운스 우회. config 변경, visibility 변경 같은 즉시 갱신용
 *
 * dispose 후에 schedule이 호출되면 무시한다 — deactivate 직후 남은 이벤트를 견디기 위함.
 */
export class RefreshScheduler implements vscode.Disposable {
    private readonly timers = new WeakMap<vscode.TextEditor, NodeJS.Timeout>();
    private readonly pending = new WeakMap<
        vscode.TextEditor,
        vscode.TextDocumentContentChangeEvent[]
    >();
    private disposed = false;

    constructor(private readonly refresh: RefreshFn) {}

    recordChanges(
        editor: vscode.TextEditor,
        changes: readonly vscode.TextDocumentContentChangeEvent[]
    ): void {
        const existing = this.pending.get(editor);
        if (existing == null) {
            this.pending.set(editor, [...changes]);
        } else {
            existing.push(...changes);
        }
    }

    schedule(editor: vscode.TextEditor): void {
        if (this.disposed) {
            return;
        }
        const previous = this.timers.get(editor);
        if (previous != null) {
            clearTimeout(previous);
        }
        const timer = setTimeout(() => {
            if (this.disposed) {
                return;
            }
            this.timers.delete(editor);
            const changes = this.pending.get(editor);
            this.pending.delete(editor);
            this.refresh(editor, changes);
        }, UPDATE_DEBOUNCE_MS);
        this.timers.set(editor, timer);
    }

    /** 디바운스 우회 즉시 갱신. 누적된 changes가 있으면 함께 전달하고 큐를 비운다. */
    fireNow(editor: vscode.TextEditor): void {
        if (this.disposed) {
            return;
        }
        const previous = this.timers.get(editor);
        if (previous != null) {
            clearTimeout(previous);
            this.timers.delete(editor);
        }
        const changes = this.pending.get(editor);
        this.pending.delete(editor);
        this.refresh(editor, changes);
    }

    dispose(): void {
        // WeakMap이라 활성 timer 목록을 따로 추적하진 않음. disposed 플래그로
        // 만료 콜백이 dispose 후 실행되어도 no-op이 되도록 한다.
        this.disposed = true;
    }
}
