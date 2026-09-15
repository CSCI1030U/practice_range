// Code editor wrapper (Ace).
// Single-file ace from CDN, Python mode, dark theme, soft tabs of 4.

export class CodeEditor {
  constructor(containerId) {
    const editor = ace.edit(containerId);
    editor.setTheme("ace/theme/dracula");
    editor.session.setMode("ace/mode/python");
    editor.session.setTabSize(4);
    editor.session.setUseSoftTabs(true);
    editor.setOptions({
      fontSize: "13.5pt",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      showPrintMargin: false,
      highlightActiveLine: true,
      wrap: false,
    });
    this.editor = editor;
  }

  getValue() { return this.editor.getValue(); }
  setValue(v) { this.editor.setValue(v, -1); }
  focus() { this.editor.focus(); }
  setReadOnly(b) { this.editor.setReadOnly(b); }
}
