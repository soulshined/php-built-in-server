import { workspace } from "vscode";
import Consts from "./Consts";

export default class {

    public static get serverRoot(): string {
        return this.get("root", "index.php", "server");
    }

    public static get phpExec(): string | undefined {
        return this.get("phpExecutable");
    }

    public static get serverPort(): number | undefined {
        return this.get("port", undefined, "server");
    }

    public static get isHeadless(): boolean {
        return this.get('enabled', false, 'server.headless');
    }

    public static get clearTerminalOnSave(): boolean {
        return this.get('clearTerminalOnSave', true, 'server.headless');
    }

    public static get globals(): { 'env-vars': { [key: string]: any }, 'consts': { [key: string]: any } } {
        const result = this.get("globals", { 'env-vars': {}, 'consts': {} });
        result['env-vars'] = result['env-vars'] || {};
        result.consts = result.consts || {};
        return result;
    }

    private static get(property: string, defaultValue: any = undefined, prefix: string | undefined = undefined) {
        if (prefix != undefined)
            prefix = `.${prefix}`;
        else prefix = "";

        return workspace.getConfiguration(`${Consts.EXTN.ID}${prefix}`).get(property, defaultValue);
    }

}