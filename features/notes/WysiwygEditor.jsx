import { h, useRef, useLayoutEffect } from "../../assets/preact.esm.js";
import renderMarkdown from "../../commons/utils/renderMarkdown.js";
import htmlToMarkdown from "../../commons/utils/htmlToMarkdown.js";

const COMMANDS = [
  { label: "B", title: "Bold", command: "bold" },
  { label: "I", title: "Italic", command: "italic" },
  { label: "S", title: "Strikethrough", command: "strikeThrough" },
  { label: "H1", title: "Heading 1", command: "formatBlock", value: "h1" },
  { label: "H2", title: "Heading 2", command: "formatBlock", value: "h2" },
  { label: "H3", title: "Heading 3", command: "formatBlock", value: "h3" },
  { label: "•", title: "Bullet list", command: "insertUnorderedList" },
  { label: "1.", title: "Numbered list", command: "insertOrderedList" },
  { label: "❞", title: "Block quote", command: "formatBlock", value: "blockquote" },
  { label: "</>", title: "Code block", command: "formatBlock", value: "pre" },
  { label: "—", title: "Horizontal rule", command: "insertHorizontalRule" }
];

export default function WysiwygEditor({ value, onChange, spellCheck, onEditorRef }) {
  const editorRef = useRef(null);
  const lastMarkdownRef = useRef(null);

  useLayoutEffect(() => {
    if (!editorRef.current || lastMarkdownRef.current === value) return;

    editorRef.current.innerHTML = renderMarkdown(value, {
      hasCodeCopyButton: false,
      hasClickableTasks: true
    });
    lastMarkdownRef.current = value;
  }, [value]);

  function handleInput(event) {
    const nextMarkdown = htmlToMarkdown(event.currentTarget);
    lastMarkdownRef.current = nextMarkdown;
    onChange(nextMarkdown);
  }

  function handleCommand(command, commandValue) {
    if (!editorRef.current) return;
    editorRef.current.focus();

    try {
      document.execCommand(command, false, commandValue || null);
      handleInput({ currentTarget: editorRef.current });
    } catch (error) {
      console.warn("WYSIWYG command failed:", command, error);
    }
  }

  function handleCreateLink() {
    const url = window.prompt("Enter link URL");
    if (url) handleCommand("createLink", url);
  }

  function handleInsertTable() {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const table = "<table><tbody><tr><th>Header 1</th><th>Header 2</th></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table><p><br></p>";
    document.execCommand("insertHTML", false, table);
    handleInput({ currentTarget: editorRef.current });
  }

  function handleToolbarMouseDown(event) {
    event.preventDefault();
  }

  function setEditorElement(element) {
    editorRef.current = element;
    if (onEditorRef) onEditorRef(element);
  }

  return (
    <div className="notes-editor-wysiwyg-wrap">
      <div className="notes-editor-wysiwyg-toolbar" role="toolbar" aria-label="Text formatting">
        {COMMANDS.map(item => (
          <button
            type="button"
            key={item.title}
            title={item.title}
            aria-label={item.title}
            onMouseDown={handleToolbarMouseDown}
            onClick={() => handleCommand(item.command, item.value)}
          >
            {item.label}
          </button>
        ))}
        <button type="button" title="Insert table" aria-label="Insert table"
          onMouseDown={handleToolbarMouseDown} onClick={handleInsertTable}>
          Table
        </button>
        <button
          type="button"
          title="Insert link"
          aria-label="Insert link"
          onMouseDown={handleToolbarMouseDown}
          onClick={handleCreateLink}
        >
          Link
        </button>
      </div>
      <div
        className="notes-editor-wysiwyg notes-editor-rendered"
        contentEditable
        suppressContentEditableWarning
        spellCheck={spellCheck}
        ref={setEditorElement}
        onInput={handleInput}
        role="textbox"
        aria-multiline="true"
        aria-label="Formatted note editor"
      />
    </div>
  );
}
