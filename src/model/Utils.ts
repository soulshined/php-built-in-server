import { execSync } from 'child_process';
import { resolve, normalize } from 'path';
import * as portfinder from 'portfinder';
import * as vscode from 'vscode';

let phpExe : string | null = null;
let context : vscode.ExtensionContext | null = null;

export default class Utils
{
    public static get context(): vscode.ExtensionContext {
        return context!;
    }

    public static set context(v: vscode.ExtensionContext) {
        context = v;
    }

    public static get isWindows(): boolean {
        return process.platform === "win32";
    }

    public static getCommandForOS(windows: string, other: string) {
        return Utils.isWindows ? windows : other;
    }

    public static getPhpExecutable(): string | undefined {
        const command = `${process.platform === "win32" ? "where" : "which"} php`;

        if (phpExe !== null) return phpExe;

        try {
            const result = execSync(command).toString();
            phpExe = resolve(normalize(result.trim()));
            return phpExe;
        } catch (ignored) {
            return;
        }
    }

    public static getWorkspaceDir(): string | null {
        if (!vscode.window.activeTextEditor) return null;

        const folder = vscode.workspace.getWorkspaceFolder(
            vscode.Uri.parse(vscode.window.activeTextEditor.document.uri.toString())
        );

        if (!folder) return null;

        return resolve(normalize(folder.uri.fsPath));
    }

    public static async getAvailablePort(start : number = 5000): Promise<number | null> {
        portfinder.setBasePort(start);
        portfinder.setHighestPort(5999);
        const port = await portfinder.getPortPromise().catch(() => {
            console.log("Could not find open port");
            return null;
        });

        return Promise.resolve(port);
    }

    public static showOutputChannelErrorMessage(msg: string, och: vscode.OutputChannel) {
        vscode.window.showErrorMessage(msg, 'Review').then(e => {
            if (e === 'Review') och.show(true);
        })
    }

}