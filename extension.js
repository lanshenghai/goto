// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "goto" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('goto.helloWorld', async function () {
		// The code you place here will be executed every time your command is executed
        const input = await vscode.window.showInputBox({
            placeHolder: 'Enter the file path',
            prompt: 'Please enter the file path you want to go to'
        });
        if (input) {
			let parts = input.split('::');
            if (parts.length !== 3) {
                vscode.window.showErrorMessage('Invalid input format. Use filePath::functionName');
                return;
            }			

            const filePath = parts[0];
			const className = parts[1];
            const functionName = parts[2];

            try {
				const files = await vscode.workspace.findFiles(`**/${filePath}`);
				if (files.length === 0) {
					vscode.window.showErrorMessage(`File ${filePath} not found`);
					return;
				}
				const document = await vscode.workspace.openTextDocument(files[0]);
                const editor = await vscode.window.showTextDocument(document);

				const text = document.getText();
				const classPosition = text.indexOf(`class ${className}`);

				const functionPosition = text.indexOf(`def ${functionName}`, classPosition);
				if (functionPosition === -1) {
					vscode.window.showErrorMessage(`Function ${functionName} not found in class ${className}`);
					return;
				}

				const functionLinePosition = document.positionAt(functionPosition);
				editor.selection = new vscode.Selection(functionLinePosition, functionLinePosition);
				editor.revealRange(new vscode.Range(functionLinePosition, functionLinePosition));

                vscode.window.showInformationMessage(`Opened file: ${filePath} and jumped to function: ${functionName}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
            }
        } else {
            vscode.window.showInformationMessage('No input received');
        }
	});

	context.subscriptions.push(disposable);
}


// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
