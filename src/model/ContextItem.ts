import { commands } from "vscode";

export default class ContextItem {
    private _value: boolean = false;
    private _identifier: string;

    public constructor(id: string) {
        this._identifier = id;
    }

    public get identifier() {
        return this._identifier;
    }

    public get value() : boolean {
        return this._value;
    }

    public set value(v: boolean) {
        if (this._value === v) return;

        this._value = v;
        console.info(`Setting context item ${this._identifier} to ${v}`);
        commands.executeCommand('setContext', this._identifier, this._value);
    }
}