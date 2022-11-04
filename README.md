# php-built-in-server extension for vscode

## Features

- 83KB extension
- PHP Hot Reloading - Automatically reloads your browser when a file is saved in the editor
- Uses php's [built in server](https://www.php.net/manual/en/features.commandline.webserver.php) - less overhead, less dependencies less stress.
- Since it's a php native feature - your built in php ini file and configurations are naturally supported

Please note per PHP docs:

> The built in web server is not intended to be a full-featured web server

This extension also does not intend to support full-featured web servers. This is for quickly running a server against a workspace with hot reloading

## Extension Settings

This extension contributes the following settings:

* `php-built-in-server.server.port`: specify a specific port number to use (defaults to first found open port)
* `php-built-in-server.server.root`: specify the starting file (defaults to index.php relative to the workspace)
* `php-built-in-server.phpExecutable`: specify the path to your php executable (this extension runs `which php` or `where php` for platforms to automatically find the executable, you only need specify one where it can't be found)
* `php-built-in-server.isHeadless`: toggle opening your browser to the server
* `php-built-in-server.globals.env-vars`: Inject envs using `putenv()`
* `php-built-in-server.globals.consts`: Inject consts using `define()`



## Usage

In your command palette type `PHP Built In Server: Start` and that's it!

A terminal will populate and your browser will open a tab to the server address

Note: This command will only display in the command palette if one is *not* running via the when expression: `!php-built-in-server.isRunning`

**Enjoy!**
