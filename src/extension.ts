// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PHPBuiltInServer, PHPBuiltInServerErrorReason } from './model/BuiltInServer';
import Consts from './model/Consts';
import Utils from './model/Utils';
import * as open from 'open';
import Configurations from './model/Configurations';
import { dirname, normalize, relative, resolve } from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

let activeServer: PHPBuiltInServer | undefined;

const configs = {
    server: {
        port: Configurations.serverPort,
        root: Configurations.serverRoot
    },
    phpExec: Configurations.phpExec
};

export async function activate(context: vscode.ExtensionContext) {
    Utils.context = context;

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "php-built-in-server" is now active!');

    const och = vscode.window.createOutputChannel(Utils.context.extension.packageJSON.displayName);

    context.subscriptions.push(
        och,
        vscode.commands.registerCommand(Consts.COMMANDS.START, () => {
            if (activeServer) return; //prevent the command from being called by other extensions

            // The code you place here will be executed every time your command is executed
            // Display a message box to the user
            och.clear();
            och.appendLine(`${Utils.context.extension.packageJSON.displayName} loaded with configs: ${JSON.stringify(configs, null, 2)}`);

            PHPBuiltInServer.newInstance(och).then(server => {
                server.start().catch((errors : PHPBuiltInServerErrorReason[]) => {
                    //server specific errors
                    errors.forEach(async e => {
                        if (e.includes('Review output panel for full details'))
                            Utils.showOutputChannelErrorMessage(e, och);

                        else vscode.window.showErrorMessage(e);
                    });

                }).then(async data => {
                    if (!data) return;

                    activeServer = server;

                    if (Configurations.isHeadless) return;

                    let root = "";
                    if (data.getPHPRoot() !== "index.php") {
                        root = relative(data.getProjectDir()!, normalize(resolve(data.getProjectDir()!, data.getPHPRoot())));
                        if (root.toLowerCase().endsWith("index.php"))
                            root = dirname(root);

                        root = `/${root}`;
                    }
                    open(`http://localhost:${data.getPorts().server}${root}`);
                })

                server.onClose(() => activeServer = undefined );
            }).catch((errors: PHPBuiltInServerErrorReason[]) => {
                //initial errors
                if (Array.isArray(errors))
                    errors.forEach(e => {
                        vscode.window.showErrorMessage(e);
                    });
                else {
                    och.appendLine(errors);
                    Utils.showOutputChannelErrorMessage('Error loading php built in server. Review output panel for full details', och);
                }
            })
        }),
    );
}

// this method is called when your extension is deactivated
export function deactivate() {
    activeServer?.destroy();
}