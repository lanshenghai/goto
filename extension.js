// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');

const { diffJson } = require('diff');

let lastComparison = {};

function showDiff(a, b) {
  const diffs = diffJson(a, b);
  const panel = vscode.window.createWebviewPanel(
	'pythonDiffView',
	'Python Variable Diff',
	vscode.ViewColumn.Two,
	{ enableScripts: true }
  );

  const html = diffs.map(d => {
	const color = d.added ? 'lightgreen' : d.removed ? 'salmon' : 'transparent';
	return `<pre style="background:${color};margin:0">${escapeHtml(d.value)}</pre>`;
  }).join('');

  panel.webview.html = `<html><body style="font-family: monospace; padding:10px"><h3>Differences</h3>${html}</body></html>`;
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}


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
	context.subscriptions.push(
		vscode.commands.registerCommand('goto.helloWorld', goto),
		vscode.commands.registerCommand('goto.compare', compareVariables),
		vscode.commands.registerCommand('goto.compareWithClipboard', compareWithClipboard),
		vscode.commands.registerCommand('goto.lastCompare', repeatLastCompare)
	);
}

async function goto() {
	// The code you place here will be executed every time your command is executed
	let input = await vscode.window.showInputBox({
		placeHolder: 'Enter the file path',
		prompt: 'Please enter the file path you want to go to'
	});
	if (input) {
		input = input.trim();
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
}

function parsePythonJsonResult(raw) {
    const trimmed = raw.slice(1, -1);
    const unescaped = trimmed.replace(/\\"/g, '"').replace(/\\'/g, "'");
    return JSON.parse(unescaped);
}

async function getActiveDebugVariable(variableName) {
	const session = vscode.debug.activeDebugSession;
	if (!session) {
		vscode.window.showErrorMessage('No active debug session found');
		return;
	}
	const threads = await session.customRequest('threads');
	const threadId = threads.threads[0]?.id;
	if (!threadId) {
		vscode.window.showErrorMessage('No active thread found');
		return;
	}

	const stackTrace = await session.customRequest('stackTrace', { threadId });
	const frameId = stackTrace.stackFrames[0]?.id;
	if (!frameId) {
		vscode.window.showErrorMessage('No stack frame found');
		return;
	}

	const expression = `__import__('json').dumps(${variableName}, default=str)`;

	const result = await session.customRequest('evaluate', {
		expression,
		frameId,
		context: 'watch' // 或 'repl'
	});	
	return  parsePythonJsonResult(result.result);
}

async function getSelectedVariable() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No active editor found');
		return;
	}

	const selection = editor.selection;
	let selectedText = editor.document.getText(selection).trim();
	if (!selectedText) {
		vscode.window.showErrorMessage('No text selected');
		return;
	}
	const targetVar = await getActiveDebugVariable(selectedText.trim())
	if (!targetVar) {
		vscode.window.showErrorMessage(`Variable "${selectedText.trim()}" not found in local scope`);
		return;
	}
	return targetVar;
}

async function getInputVariable() {
	let input = await vscode.window.showInputBox({
		placeHolder: 'Enter the variable to compare with',
		prompt: 'Please enter the variable you want to compare with'
	});
	if (!input) {
		vscode.window.showErrorMessage('No input received for comparison');
		return;
	}
	const targetVar = await getActiveDebugVariable(input.trim());
	if (!targetVar) {
		vscode.window.showErrorMessage(`Variable "${input.trim()}" not found in local scope`);
		return;
	}
	lastComparison.input = input;
	return targetVar;
}

async function getClipboardVariable() {
	let clipboardText = await vscode.env.clipboard.readText();
	if (!clipboardText) {
		vscode.window.showErrorMessage('Clipboard is empty');
		return;
	}
	const targetVar = await getActiveDebugVariable(clipboardText.trim());
	if (!targetVar) {
		vscode.window.showErrorMessage(`Variable "${clipboardText.trim()}" not found in local scope`);
		return;
	}
	lastComparison.input = clipboardText;
	return targetVar;
}

async function compareVariables() {
	const selectedText = await getSelectedVariable();
	if (!selectedText) {
		return;
	}

	const inputVar = await getInputVariable();
	if (!inputVar) {
		return;
	}
	
	showDiff(selectedText, inputVar);

	// Store last comparison
	lastComparison.selectedText = selectedText;
}

async function compareWithClipboard() {
	const selectedText = await getSelectedVariable();
	if (!selectedText) {
		return;
	}
	
	const clipboardVar = await getClipboardVariable();
	if (!clipboardVar) {
		return;
	}

	showDiff(selectedText, clipboardVar);

	// Store last comparison
	lastComparison.selectedText = selectedText;
}



async function repeatLastCompare() {
	if (!lastComparison.selectedText || !lastComparison.input) {
		vscode.window.showErrorMessage('No previous comparison found');
		return;
	}

	const inputVar = await getActiveDebugVariable(lastComparison.input.trim());
	if (!inputVar) {
		vscode.window.showErrorMessage(`Variable "${lastComparison.input.trim()}" not found in local scope`);
		return;
	}
	showDiff(lastComparison.selectedText, inputVar);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
