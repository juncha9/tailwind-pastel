import * as vscode from 'vscode';
import { CATEGORY_STYLE_MAP, SUPPORTED_LANGUAGES } from '../_defs';
import { SourceLanguage } from '../_types';
import { buildLineStarts } from '../_libs';
import { DecorationRegistry } from './decoration-registry';
import { TokenStore } from './token-store';
import { RefreshScheduler } from './refresh-scheduler';

const CONFIG_NAMESPACE = 'tailwindPastel';

function isEnabled(): boolean {
    return vscode.workspace.getConfiguration(CONFIG_NAMESPACE).get<boolean>('enabled', true);
}

/*
 * 익스텐션 한 활성화 사이클의 싱글톤. 세 책임 객체를 조립하고 VSCode 이벤트를 wire한다.
 *  - DecorationRegistry : 데코레이션 인스턴스 + setDecorations 적용
 *  - TokenStore         : 문서별 토큰 캐시 + windowed 증분 재스캔
 *  - RefreshScheduler   : 에디터별 디바운스 + 변경 누적
 *
 * refresh()가 한 사이클의 본체 — text를 읽고 → 토큰 가져와 → lineStarts 빌드 →
 * 데코레이션 적용. RefreshScheduler가 디바운스 후 이걸 호출.
 */
export class HighlightManager implements vscode.Disposable {
    private readonly decorations = new DecorationRegistry();
    private readonly tokenStore = new TokenStore();
    private readonly scheduler: RefreshScheduler;

    constructor() {
        this.scheduler = new RefreshScheduler((editor, changes) => this.refresh(editor, changes));
    }

    register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.window.onDidChangeVisibleTextEditors(editors => {
                for (const editor of editors) {
                    this.refresh(editor, undefined);
                }
            }),
            vscode.workspace.onDidChangeTextDocument(event => {
                const editor = vscode.window.visibleTextEditors.find(
                    e => e.document.uri.toString() === event.document.uri.toString()
                );
                if (editor == null) {
                    return;
                }
                /*
                 * 디바운스 동안 다중 이벤트가 쌓이면 incremental은 포기 — 누적된 변경은 좌표계가
                 * 서로 얽혀 단순 적용이 어려우므로, TokenStore가 1건일 때만 windowed 재스캔을
                 * 시도하고 그 외엔 full 재스캔으로 fallback한다.
                 */
                this.scheduler.recordChanges(editor, event.contentChanges);
                this.scheduler.schedule(editor);
            }),
            vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration(CONFIG_NAMESPACE) === false) {
                    return;
                }
                this.decorations.reinit();
                this.refreshAll();
            }),
            vscode.commands.registerCommand(`${CONFIG_NAMESPACE}.toggle`, () => this.toggleEnabled()),
            this
        );

        /*
         * 디버그(Extension Development Host) 실행에서만 토큰 카테고리를 hover로 노출.
         * 프로덕션 사용자에겐 잡음이 되므로 등록 자체를 건다.
         */
        if (context.extensionMode === vscode.ExtensionMode.Development) {
            for (const language of SUPPORTED_LANGUAGES) {
                context.subscriptions.push(
                    vscode.languages.registerHoverProvider(
                        { language, scheme: 'file' },
                        { provideHover: (doc, pos) => this.provideDebugHover(doc, pos) }
                    )
                );
            }
        }

        this.refreshAll();
    }

    dispose(): void {
        this.decorations.dispose();
        this.scheduler.dispose();
    }

    private refresh(
        editor: vscode.TextEditor,
        pendingChanges: readonly vscode.TextDocumentContentChangeEvent[] | undefined
    ): void {
        const language = editor.document.languageId as SourceLanguage;
        if (SUPPORTED_LANGUAGES.has(language) === false) {
            return;
        }
        if (isEnabled() === false) {
            this.decorations.clear(editor);
            return;
        }
        const text = editor.document.getText();
        const tokens = this.tokenStore.getOrExtract(editor.document, text, pendingChanges);
        const lineStarts = buildLineStarts(text);
        this.decorations.apply(editor, tokens, lineStarts);
    }

    private refreshAll(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.refresh(editor, undefined);
        }
    }

    /*
     * workspace 설정이 정의돼 있으면 그쪽을, 아니면 global을 갱신.
     * 설정 변경은 onDidChangeConfiguration이 자동으로 받아 reinit + repaint한다.
     */
    private async toggleEnabled(): Promise<void> {
        const cfg = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
        const current = cfg.get<boolean>('enabled', true);
        const inspected = cfg.inspect<boolean>('enabled');
        const target = inspected?.workspaceValue !== undefined
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global;
        await cfg.update('enabled', !current, target);
        vscode.window.setStatusBarMessage(
            `Tailwind Pastel: ${!current ? 'enabled' : 'disabled'}`,
            2000
        );
    }

    /*
     * 디버그/검증용 hover. Extension Development Host에서만 등록되며,
     * 호버 위치의 토큰을 TokenStore 캐시에서 찾아 카테고리/anchor 정보를 보여준다.
     */
    private provideDebugHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Hover | null {
        const language = document.languageId as SourceLanguage;
        if (SUPPORTED_LANGUAGES.has(language) === false) {
            return null;
        }
        if (isEnabled() === false) {
            return null;
        }
        const offset = document.offsetAt(position);
        const tokens = this.tokenStore.getOrExtract(document, document.getText(), undefined);
        const hit = tokens.find(t => t.start <= offset && offset <= t.end);
        if (hit == null) {
            return null;
        }
        const label = CATEGORY_STYLE_MAP.get(hit.category)?.label ?? hit.category;
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**Tailwind Pastel** · \`${hit.raw}\`\n\n`);
        md.appendMarkdown(`- category: \`${hit.category}\` (${label})\n`);
        md.appendMarkdown(`- token offset: \`${hit.start}\`–\`${hit.end}\`\n`);
        md.appendMarkdown(`- anchor offset: \`${hit.anchorStart}\`–\`${hit.anchorEnd}\``);
        const range = new vscode.Range(
            document.positionAt(hit.start),
            document.positionAt(hit.end)
        );
        return new vscode.Hover(md, range);
    }
}
