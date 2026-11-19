function useMarkdownFormatter({ textareaRef, setContent, contentRef, wysiwygRef }) {
  function insertIntoWysiwyg(text) {
    const editor = wysiwygRef?.current;
    if (!editor) return false;

    editor.focus();
    const imageMatch = text.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const image = document.createElement("img");
      image.setAttribute("alt", imageMatch[1]);
      image.setAttribute("src", imageMatch[2]);

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          range.insertNode(image);
          range.setStartAfter(image);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          document.execCommand("insertHTML", false, image.outerHTML);
        }
      } else {
        document.execCommand("insertHTML", false, image.outerHTML);
      }
    } else {
      document.execCommand("insertText", false, text);
    }

    editor.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function insertAtCursor(text) {
    if (textareaRef.current === null) {
      insertIntoWysiwyg(text);
      return;
    }

    const textarea = textareaRef.current;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const beforeText = textarea.value.substring(0, startPos);
    const afterText = textarea.value.substring(endPos);
    const nextContent = beforeText + text + afterText;

    if (contentRef) contentRef.current = nextContent;
    setContent(nextContent);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = startPos + text.length;
        textareaRef.current.selectionEnd = startPos + text.length;
        textareaRef.current.focus();
      }
    }, 0);
  }

  function applyMarkdownFormat(format, placeholder = "") {
    if (textareaRef.current === null) {
      return;
    }

    const textarea = textareaRef.current;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const beforeText = textarea.value.substring(0, startPos);
    const afterText = textarea.value.substring(endPos);
    const selectedText = textarea.value.substring(startPos, endPos);

    let formattedText = "";
    let cursorOffset = 0;

    switch (format) {
      case "bold":
        formattedText = `**${selectedText || placeholder}**`;
        cursorOffset = selectedText ? formattedText.length : 2;
        break;
      case "italic":
        formattedText = `*${selectedText || placeholder}*`;
        cursorOffset = selectedText ? formattedText.length : 1;
        break;
      case "strikethrough":
        formattedText = `~~${selectedText || placeholder}~~`;
        cursorOffset = selectedText ? formattedText.length : 2;
        break;
      case "highlight":
        formattedText = `==${selectedText || placeholder}==`;
        cursorOffset = selectedText ? formattedText.length : 2;
        break;
      case "code":
        formattedText = "`" + (selectedText || placeholder) + "`";
        cursorOffset = selectedText ? formattedText.length : 1;
        break;
      case "h1":
        formattedText = `# ${selectedText || placeholder}`;
        cursorOffset = selectedText ? formattedText.length : 2;
        break;
      case "h2":
        formattedText = `## ${selectedText || placeholder}`;
        cursorOffset = selectedText ? formattedText.length : 3;
        break;
      case "h3":
        formattedText = `### ${selectedText || placeholder}`;
        cursorOffset = selectedText ? formattedText.length : 4;
        break;
      case "ul":
        formattedText = `- ${selectedText || placeholder}`;
        cursorOffset = selectedText ? formattedText.length : 2;
        break;
      case "ol":
        formattedText = `1. ${selectedText || placeholder}`;
        cursorOffset = selectedText ? formattedText.length : 3;
        break;
      case "todo":
        formattedText = `- [ ] ${selectedText || placeholder}`;
        cursorOffset = selectedText ? formattedText.length : 6;
        break;
      case "quote":
        formattedText = `> ${selectedText || placeholder}`;
        cursorOffset = selectedText ? formattedText.length : 2;
        break;
      case "hr":
        formattedText = "
---
";
        cursorOffset = formattedText.length;
        break;
      case "link":
        if (selectedText) {
          formattedText = `[${selectedText}](url)`;
          cursorOffset = formattedText.length - 4;
        } else {
          formattedText = `[${placeholder}](url)`;
          cursorOffset = 1;
        }
        break;
      default:
        return;
    }

    const nextContent = beforeText + formattedText + afterText;
    if (contentRef) contentRef.current = nextContent;
    setContent(nextContent);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = startPos + cursorOffset;
        textareaRef.current.selectionStart = newPosition;
        textareaRef.current.selectionEnd = newPosition;
        textareaRef.current.focus();
      }
    }, 0);
  }

  return {
    insertAtCursor,
    applyMarkdownFormat
  };
}

export default useMarkdownFormatter;
