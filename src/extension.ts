'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { openFileInPane, FilePane, changeTracker, toggleTracking } from './codeOperations';
import { initCache, updateCache } from './fileOperations';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.switch', async () => {
        openFileInPane(FilePane.Current);
    });

    context.subscriptions.push(disposable);

    let switchRightPaneDisposable = vscode.commands.registerCommand('extension.switchRightPane', async () => {
        openFileInPane(FilePane.Right);
    });

    context.subscriptions.push(switchRightPaneDisposable);

    let switchLeftPaneDisposable = vscode.commands.registerCommand('extension.switchLeftPane', async () => {
        openFileInPane(FilePane.Left);
    });

    context.subscriptions.push(switchLeftPaneDisposable);

    let toggleChangeTrackingDisposable = vscode.commands.registerCommand('extension.toggleTracker', async () => {
        toggleTracking();
    });

    context.subscriptions.push(toggleChangeTrackingDisposable);
    context.subscriptions.push(changeTracker)

    initCache();
    let fsWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, true, false);
    fsWatcher.onDidCreate((uri:vscode.Uri) => updateCache(uri, true));
    fsWatcher.onDidDelete((uri: vscode.Uri) => updateCache(uri, false));
    context.subscriptions.push(fsWatcher);

    let onConfigChange = () => {
        let cfg = vscode.workspace.getConfiguration('headerSourceSwitch');
        if (cfg.get<boolean>('always') && !changeTracker.isTracking()) {
            toggleTracking();
        }
    };
    onConfigChange.call(this);

    let configurationChangeDisposable = vscode.workspace.onDidChangeConfiguration(onConfigChange);
    context.subscriptions.push(configurationChangeDisposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}