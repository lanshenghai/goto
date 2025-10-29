const vscode = require('vscode');
const { diffJson } = require('diff');

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

module.exports = { showDiff };
