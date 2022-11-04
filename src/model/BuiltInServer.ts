import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { FileSystemWatcher, OutputChannel, Terminal, TerminalOptions, Uri, window, workspace  } from 'vscode';
import Utils from './Utils';
import '../string.extensions';
import Consts from './Consts';
import ContextItem from './ContextItem';
import { EventEmitter } from 'stream';
import Configurations from './Configurations';

export class PHPBuiltInServerInstanceData {

    private errors: PHPBuiltInServerErrorReason[] = [];
    private ports: { server: number, socket: number } = { server: -1, socket: -1 };
    private projectDir: string | null = null;
    private phpExecutable: string | null = null;
    private phpRoot: string = Configurations.serverRoot;

    public getProjectDir(): string | null {
        return this.projectDir;
    }

    public getPHPExec(): string | null {
        return this.phpExecutable;
    }

    public getPHPRoot(): string {
        return this.phpRoot;
    }

    public getPorts(): { server: number, socket: number } {
        return this.ports;
    }

    public getErrors() {
        return this.errors;
    }

    public setProjectDir(dir: string | null) {
        if (dir !== null)
            this.projectDir = dir;
        else this.errors.push(PHPBuiltInServerErrorReason.NO_WORKSPACE_DIR);
    }

    public setPHPExec(path: string | undefined) {
        if (path !== undefined)
            this.phpExecutable = path;
        else this.errors.push(PHPBuiltInServerErrorReason.NO_PHP_EXECUTABLE);

    }

    public setServerPort(port: number | null) {
        if (port !== null)
            this.ports.server = port;
        else this.errors.push(PHPBuiltInServerErrorReason.NO_SERVER_PORT);
    }

    public setSocketPort(port: number | null) {
        if (port !== null)
            this.ports.socket = port;
        else this.errors.push(PHPBuiltInServerErrorReason.NO_SOCKET_PORT);
    }

    public get canStart() {
        return this.errors.length === 0 &&
            this.projectDir !== null &&
            this.phpExecutable !== null &&
            this.ports.server !== -1 &&
            this.ports.socket !== -1;
    }

}

export enum PHPBuiltInServerErrorReason {
    NO_WORKSPACE_DIR = "No workspace active",
    NO_PHP_EXECUTABLE = "A PHP executable not found under normal PATH conventions. Please add to your system path variable or apply one in settings",
    NO_SERVER_PORT = "No open port found to create server",
    NO_SOCKET_PORT = "No open port found to create websocket",
    CREATING_VSCODE_DIR = "Can not create .vscode folder in workspace",
    CREATING_PHP_ROUTER = "Can not create server router in .vscode",
    CREATING_WEBSOCKET = "Can not invoke websocket"
}

export class PHPBuiltInServer  {
    private data: PHPBuiltInServerInstanceData;
    private readonly TOKEN = randomUUID();
    private io: Server | undefined;
    private fsw: FileSystemWatcher;
    private errors: PHPBuiltInServerErrorReason[] = [];
    private socketIsActive: boolean = false;
    private serverIsActive: ContextItem = new ContextItem(Consts.CONTEXTS.IS_SERVER_RUNNING);
    private terminal: Terminal | undefined = undefined;
    private emitter: EventEmitter = new EventEmitter();
    private och: OutputChannel;

    private constructor(data: PHPBuiltInServerInstanceData, och: OutputChannel) {
        this.data = data;
        this.och = och;
        this.fsw = workspace.createFileSystemWatcher("**/*.*", true, false, true);
    }

    public static newInstance(och : OutputChannel): Promise<PHPBuiltInServer> {
        return new Promise(async (resolve, reject) => {
            const instance = new PHPBuiltInServerInstanceData();

            const projDir = Utils.getWorkspaceDir();
            let phpExec : string | undefined = Configurations.phpExec;
            if (phpExec) {
                try {
                    if (!existsSync(phpExec))
                        //@ts-ignore
                        instance.getErrors().push(`Can not find provided php executable '${phpExec}'`);
                } catch (error) {
                    // @ts-ignore
                    instance.getErrors().push(`Can not find provided php executable '${phpExec}'`);
                }
            }
            else phpExec = Utils.getPhpExecutable();
            const p1 = Configurations.serverPort !== undefined
                ? Configurations.serverPort
                : await Utils.getAvailablePort();
            let p2 = null;
            if (p1 !== null)
                p2 = await Utils.getAvailablePort(p1 + 1);

            instance.setPHPExec(phpExec);
            instance.setProjectDir(projDir);
            instance.setServerPort(p1);
            instance.setSocketPort(p2);

            if (!instance.canStart)
                reject(instance.getErrors());
            resolve(new PHPBuiltInServer(instance, och));
        })
    }

    public async destroy() {
        this.dispose(true);
    }

    private async dispose(sockets: boolean) {
        this.serverIsActive.value = false;

        if (sockets && this.io) {
            this.io.close(error => {
                if (error) {
                    console.log('Error closing socket', error);
                } else this.socketIsActive = false;
            })
        } else this.socketIsActive = false;

        this.terminal?.dispose();
        this.fsw.dispose();
        this.emitter.emit('close');
    }

    public onClose(callback: Function) {
        this.emitter.addListener('close', async () => {
            callback();
        })
    }

    public start(): Promise<PHPBuiltInServerInstanceData> {
        if (!Configurations.serverRoot.endsWith(".php")) {
            // @ts-ignore
            this.errors.push(`${PHPBuiltInServerErrorReason.CREATING_PHP_ROUTER} directory. The provided root file '${Configurations.serverRoot}' is not a php file`);
            return Promise.reject(this.errors);
        }

        this.applyRouter();
        this.initWebSocket();
        this.initPHPBuiltInServer();

        if (this.errors.length > 0) {
            this.emitter.emit('close');
            return Promise.reject(this.errors);
        }

        this.terminal!.show(true);

        window.onDidChangeTerminalState(() => { });
        window.onDidCloseTerminal(async t => {
            if (!this.terminal) return;

            const pid = await t.processId;
            const tid = await this.terminal?.processId;

            if (pid === tid) {
                this.och.appendLine("Terminal was closed. Destroying server resources");
                this.send('kill');
                await this.destroy();
            }
        });

        this.fsw.onDidChange((uri: Uri) => {
            const _path = uri.path.toLowerCase();
            if (!_path.includes("/.vscode") &&
                !_path.includes("/.git" ) &&
                !_path.includes("/node_modules/") &&
                !_path.includes("/test/") &&
                !_path.endsWith(".eslintrc.json") &&
                !_path.endsWith(".gitignore") &&
                !_path.endsWith(".vscodeignore") &&
                !_path.endsWith(".md") &&
                !_path.endsWith("tsconfig.json") &&
                !_path.endsWith("package.json") &&
                !_path.endsWith("package-lock.json")
            ) {
                this.send('refresh', true);
            }
        });

        this.serverIsActive.value = true;
        return Promise.resolve(this.data);
    }

    public get serverIsRunning() : boolean {
        return this.errors.length === 0 && this.socketIsActive && this.serverIsActive.value;
    }

    private applyRouter(): void {
        if (Configurations.isHeadless) return;

        try {
            if (!existsSync(join(this.data.getProjectDir()!, ".vscode")))
                mkdirSync(join(this.data.getProjectDir()!, ".vscode"));

            this.och.appendLine(`Created .vscode directory`);
        } catch (error) {
            this.och.appendLine(`Creating .vscode directory error: ${error}`);
            // @ts-ignore
            this.errors.push(`${PHPBuiltInServerErrorReason.CREATING_VSCODE_DIR}. Review output panel for full details`);
            this.och.appendLine(`${PHPBuiltInServerErrorReason.CREATING_VSCODE_DIR}: ${error}`);
            return;
        }

        let envVars: string[] = [],
            consts : string[] = [];
        for (const [key, value] of Object.entries(Configurations.globals['env-vars']))
            envVars.push(`putenv("${key}=${value}");`);

        for (const [key, value] of Object.entries(Configurations.globals.consts))
            consts.push(`define("${key}", ${value});`);

        const phprouter = readFileSync(join(__dirname, "router-template.php")).toString()
            .replaceTemplateVariable('name', Consts.EXTN.DISPLAY_NAME)
            .replaceTemplateVariable('author', Consts.EXTN.AUTHOR)
            .replaceTemplateVariable('version', Consts.EXTN.VERSION)
            .replaceTemplateVariable('port', this.data.getPorts().socket)
            .replaceTemplateVariable('token', this.TOKEN)
            .replaceTemplateVariable('homepage', Consts.EXTN.HOMEPAGE)
            .replaceTemplateVariable('globals', [...envVars, ...consts].join("\n    "));

        try {
            writeFileSync(join(this.data.getProjectDir()!, ".vscode/phpbis-router.php"), phprouter, {
                flag: 'w'
            });

            this.och.appendLine(`phpbis router added to .vscode directory`);
        } catch (error) {
            this.och.appendLine(`Creating phpbis router in .vscode/ error: ${error}`);
            // @ts-ignore
            this.errors.push(`${PHPBuiltInServerErrorReason.CREATING_PHP_ROUTER}. Review output panel for full details`);
            this.och.appendLine(`${PHPBuiltInServerErrorReason.CREATING_PHP_ROUTER}: ${error}`);
        }
    }

    private initPHPBuiltInServer() {
        if (this.errors.length !== 0) return;

        const opts : TerminalOptions = {
            name: `${Consts.EXTN.DISPLAY_NAME} ${Configurations.isHeadless ? "" : `[:${this.data.getPorts().server}]`}`,
            isTransient: Configurations.isHeadless,
            shellArgs: this.getServerArgs(),
            shellPath : Configurations.isHeadless ? undefined : this.data.getPHPExec()!
        }

        this.terminal = window.createTerminal(opts);
        if (Configurations.isHeadless)
            this.terminal.sendText(`${this.data.getPHPExec()} ${this.data.getPHPRoot()}`);
    }

    private initWebSocket() {
        if (this.errors.length !== 0 || Configurations.isHeadless) return;

        const s = createServer((req, resp) => {
            const headers = {
                "Access-Control-Allow-Origin": `http://localhost:${this.data.getPorts().server}`,
                "Access-Control-Max-Age": 2592000
            };
            resp.writeHead(200, headers);
            resp.end();
        });

        this.io = new Server(s.listen(this.data.getPorts().socket, () => {
            this.och.appendLine(`Websocket server listening on ${this.data.getPorts().socket}`);
            this.socketIsActive = true;
        }), {
            cors: {
                origin: `http://localhost:${this.data.getPorts().server}`,
                credentials : true
            }
        });

        s.on('close', async (reason: any) => {
            this.och.appendLine(`PHP Built In Server connection closed`);
            await this.dispose(false);
        })

        this.io.on('connection', client => {
            if (client.handshake.auth.token !== this.TOKEN) client.disconnect();
            console.log(`Websocket connected authenticated user ${client.handshake.auth.token}`);
        });
    }

    private getServerArgs(): string[] {
        const args = ['-H'];
        if (!Configurations.isHeadless) {
            args.push('-S', `localhost:${this.data.getPorts().server}`, '.vscode/phpbis-router.php');
        }

        return args;
    }

    private send(msg: string, headless = false) {
        if (this.socketIsActive)
            this.io!.send(msg);
        else if (Configurations.isHeadless && headless) {
            if (Configurations.clearTerminalOnSave)
                this.terminal?.sendText(Utils.getCommandForOS('cls', 'clear'));
            this.terminal?.sendText(`${this.data.getPHPExec()} ${this.data.getPHPRoot()}`);
        }
    }

}