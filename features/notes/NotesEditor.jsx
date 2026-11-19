import { h, useState, useRef, useEffect, useLayoutEffect, useCallback } from "../../assets/preact.esm.js"
import ApiClient from '../../commons/http/ApiClient.js';
import NotesEditorTags from "../tags/NotesEditorTags.jsx";
import NotesEditorFormattingToolbar from './NotesEditorFormattingToolbar.jsx';
import TableOfContents from './TableOfContents.jsx';
import TemplatePicker from '../templates/TemplatePicker.jsx';
import renderMarkdown from '../../commons/utils/renderMarkdown.js';
import { toggleTaskAtLine } from '../../commons/utils/toggleTaskLine.js';
import handleCodeCopyClick from '../../commons/utils/handleCodeCopyClick.js';
import navigateTo from '../../commons/utils/navigateTo.js';
import isMobile from '../../commons/utils/isMobile.js';
import NoteDeleteModal from './NoteDeleteModal.jsx';
import TableEditorModal from './TableEditorModal.jsx';
import Lightbox from '../../commons/components/Lightbox.jsx';
import NotesEditorMenu from './NotesEditorMenu.jsx';
import Button from '../../commons/components/Button.jsx';
import { showToast } from '../../commons/components/Toast.jsx';
import { closeModal, openModal } from '../../commons/components/Modal.jsx';
import { useNotes } from "../../commons/contexts/NotesContext.jsx";
import { useLayout } from "../../commons/contexts/LayoutContext.jsx";
import { useVisibleHeadings } from "./useVisibleHeadings.js";
import { useCollapsibleHeadings } from "./useCollapsibleHeadings.js";
import useEditorKeyboardShortcuts from "./useEditorKeyboardShortcuts.js";
import useImageUpload from "./useImageUpload.js";
import useMarkdownFormatter from "./useMarkdownFormatter.js";
import useAutoSave from "./useAutoSave.js";
import useNoteVersions from "./useNoteVersions.js";
import useRefreshOnTabFocus from "./useRefreshOnTabFocus.js";
import useNewNoteTag from "./useNewNoteTag.js";
import SpellcheckPreferences from "../../commons/preferences/SpellcheckPreferences.js";
import "./NotesEditor.css";
import { SidebarCloseIcon, SidebarOpenIcon, BackIcon } from "../../commons/components/Icon.jsx";
import EditorModePreferences from "../../commons/preferences/EditorModePreferences.js";

export default function NotesEditor({ isNewNote, isModal, isExpandable = false, onClose }) {
  const { selectedNote, setSelectedNote, handleNoteChange, handlePinToggle } = useNotes();
  const { isEditorExpanded, toggleEditorExpanded, openSidePanelNote } = useLayout();

  if (!isNewNote && selectedNote === null) {
    return null;
  }

  const [isEditable, setIsEditable] = useState(isNewNote);
  const [title, setTitle] = useState(selectedNote?.title || "");
  const [content, setContent] = useState(selectedNote?.content || "");
  const [tags, setTags] = useState(selectedNote?.tags || []);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [editorMode, setEditorMode] = useState(() => EditorModePreferences.getMode());

  const titleRef = useRef(null);
  const textareaRef = useRef(null);
  const contentRef = useRef(null);
  const editorRef = useRef(null);
  const contentValueRef = useRef(content);
  contentValueRef.current = content;
  const contentValueRef = useRef(content);
  contentValueRef.current = content;

  const visibleHeadings = useVisibleHeadings(contentRef, content, isEditable, isEditorExpanded);
  const { handleHeadingClick } = useCollapsibleHeadings(contentRef, selectedNote?.noteId);

  const { insertAtCursor, applyMarkdownFormat } = useMarkdownFormatter({
    textareaRef,
    setContent
  });

  useNewNoteTag({ isNewNote, setTags });

  const tagsRef = useRef(tags);
  tagsRef.current = tags;

  function replaceNote(newNote) {
    setTitle(newNote.title);
    setContent(newNote.content);
    setTags(newNote.tags || []);
    setSelectedNote(newNote);
  }

  const { handleVersionsClick } = useNoteVersions({
    note: selectedNote,
    onRestored: replaceNote,
    // Wrapped because useAutoSave is initialised below this call
    cancelAutoSave: () => cancelAutoSave()
  });

  const { scheduleAutoSave, cancelAutoSave } = useAutoSave({
    isNewNote,
    noteId: selectedNote?.noteId,
    titleRef,
    textareaRef,
    tagsRef,
    contentRef: contentValueRef
  });

  useRefreshOnTabFocus({
    note: selectedNote,
    isEditable,
    onRefresh: replaceNote
  });

  const {
    isDraggingOver,
    attachments,
    fileInputRef,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleImageDrop,
    handleDropzoneClick,
    handleFileInputChange,
    resetAttachments
  } = useImageUpload({ insertAtCursor });

  let contentArea = null;

  useLayoutEffect(() => {
    titleRef.current.textContent = title;
  }, [title]);

  useEffect(() => {
    if (isNewNote === true || (isEditable === true && titleRef.current?.textContent === "")) {
      titleRef.current?.focus();
    }

    if (isNewNote !== true) {
      document.title = title === "" ? "Zen" : title;
    }
  }, []);

  useEffect(() => {
    // The scrolling container belongs to the page and outlives this remount
    const scrollContainer = editorRef.current?.closest(".notes-editor-container");
    if (scrollContainer !== null && scrollContainer !== undefined) {
      scrollContainer.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    handleTextAreaHeight();
  }, [content, isEditable]);

  const handleSaveClick = useCallback(() => {
    const currentTitle = titleRef.current?.textContent || "";
    const currentContent = contentValueRef.current;

    const note = {
      title: currentTitle,
      content: currentContent,
      tags: tags,
    };

    setTitle(currentTitle);
    setContent(currentContent);

    let promise = null;
    setIsSaveLoading(true);
    cancelAutoSave();

    if (isNewNote) {
      promise = ApiClient.createNote(note);
    } else {
      promise = ApiClient.updateNote(selectedNote.noteId, note);
    }

    promise
      .then(note => {
        setIsEditable(false);
        resetAttachments();

        if (isNewNote && !onClose) {
          navigateTo(`/notes/${note.noteId}`, true, true);
        }

        handleNoteChange();
      })
      .catch(() => { })
      .finally(() => {
        setIsSaveLoading(false);
      });
  }, [content, tags, isNewNote, selectedNote, handleNoteChange, resetAttachments]);

  const { handleKeyDown } = useEditorKeyboardShortcuts({
    isEditable,
    isModal,
    isExpanded: isEditorExpanded,
    isExpandable,
    textareaRef,
    onSave: handleSaveClick,
    onEdit: handleEditClick,
    onClose: handleCloseClick,
    onExpandToggle: handleExpandToggleClick,
    onInsertAtCursor: insertAtCursor,
    onFormatText: applyMarkdownFormat
  });

  function handleEditorActions(action, placeholder) {
    if (action !== "insertTable" && action !== "editTable") {
      applyMarkdownFormat(action, placeholder);
      return;
    }

    const textarea = textareaRef.current;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const isEditing = action === "editTable";
    const selectedText = textarea.value.substring(startPos, endPos);

    const beforeText = textarea.value.substring(0, startPos);
    const afterText = textarea.value.substring(endPos);

    function handleConfirm(tableMarkdown) {
      closeModal();
      setContent(beforeText + tableMarkdown + afterText);
    }

    openModal(<TableEditorModal isEditing={isEditing} selectedText={selectedText} beforeText={beforeText} afterText={afterText} onConfirm={handleConfirm} onCloseClick={() => closeModal()} />);
  }

  function handleContentInput(e) {
    contentValueRef.current = e.target.value;
    setContent(e.target.value);
    handleTextAreaHeight();
    scheduleAutoSave();
  }

  function handleModeChange(nextMode) {
    const latestContent = textareaRef.current?.value ?? contentValueRef.current;
    contentValueRef.current = latestContent;
    setContent(latestContent);
    setEditorMode(nextMode);
    EditorModePreferences.setMode(nextMode);
  }

  function handleWysiwygInput(e) {
    const nextMarkdown = htmlToMarkdown(e.currentTarget);
    contentValueRef.current = nextMarkdown;
    setContent(nextMarkdown);
    scheduleAutoSave();
  }

  function renderEditableContent() {
    if (editorMode === "markdown") {
      return (
        <textarea className="notes-editor-textarea" placeholder="Write here..." spellCheck={spellcheckValue}
          ref={textareaRef} value={content} onInput={handleContentInput} />
      );
    }

    if (editorMode === "split") {
      return (
        <div className="notes-editor-split-view">
          <textarea className="notes-editor-textarea notes-editor-split-source" placeholder="Write Markdown here..."
            spellCheck={spellcheckValue} ref={textareaRef} value={content} onInput={handleContentInput} />
          <div className="notes-editor-rendered notes-editor-split-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content, { hasCodeCopyButton: true, hasClickableTasks: false }) }}
            onClick={handleRenderedContentClick} />
        </div>
      );
    }

    if (editorMode === "wysiwyg") {
      return (
        <div className="notes-editor-wysiwyg notes-editor-rendered" contentEditable suppressContentEditableWarning
          spellCheck={spellcheckValue} onInput={handleWysiwygInput}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content, { hasCodeCopyButton: false, hasClickableTasks: false }) }} />
      );
    }

    return (
      <div className="notes-editor-live-preview">
        <div className="notes-editor-live-rendered notes-editor-rendered"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content, { hasCodeCopyButton: false, hasClickableTasks: false }) }}
          onClick={handleLivePreviewClick}
        />
        <textarea className="notes-editor-live-source" placeholder="Write here..." spellCheck={spellcheckValue}
          ref={textareaRef} value={content} onInput={handleContentInput} aria-label="Markdown source" />
      </div>
    );
  }

  function handleLivePreviewClick(e) {
    const preview = e.currentTarget;
    const box = preview.getBoundingClientRect();
    const scrollY = preview.scrollTop || 0;
    const x = e.clientX - box.left;
    const y = e.clientY - box.top + scrollY;
    const textarea = textareaRef.current;
    if (!textarea) return;

    // The live preview visually overlays the Markdown textarea. Clicking a
    // visible line positions the caret in the matching source line.
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
    const lineIndex = Math.max(0, Math.floor(y / lineHeight));
    const lines = contentValueRef.current.split("\n");
    const safeLineIndex = Math.min(lineIndex, Math.max(0, lines.length - 1));
    let position = 0;
    for (let i = 0; i < safeLineIndex; i++) position += lines[i].length + 1;
    const line = lines[safeLineIndex] || "";
    const characterIndex = Math.min(line.length, Math.max(0, Math.floor(x / 8)));
    position += characterIndex;
    textarea.focus();
    textarea.setSelectionRange(position, position);
  }

function handleTextAreaHeight() {
    if (textareaRef.current === null) {
      return;
    }

    const textarea = textareaRef.current;
    // scrollHeight is height of content and padding
    // It doesn't include border, margin, or scrollbar
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  }

  function handleEditClick() {
    // Trashed notes are read-only until restored.
    if (selectedNote?.isDeleted === true) {
      return;
    }

    setIsEditable(true);
  }

  function handleEditCancelClick() {
    cancelAutoSave();

    if (isNewNote) {
      if (onClose) {
        onClose();
      } else {
        navigateTo("/", true, true);
      }
    } else {
      // Reset current edits
      setTitle(selectedNote?.title || "");
      setContent(selectedNote?.content || "");
      setTags(selectedNote?.tags || []);
      setIsEditable(false);
    }
  }

  // https://blixtdev.com/how-to-use-contenteditable-with-react/
  function handleTitleChange(e) {
    const newTitle = e.target.textContent;
    setTitle(newTitle);
  }

  function handleAddTag(tag) {
    setTags((prevTags) => [...prevTags, tag]);
  }

  function handleRemoveTag(tag) {
    setTags((prevTags) => prevTags.filter(t => t.tagId !== tag.tagId));
  }

  function handleCloseClick() {
    cancelAutoSave();

    if (onClose) {
      onClose();
    } else {
      navigateTo("/", true, isNewNote);
    }
  }

  function handleDeleteClick() {
    openModal(
      <NoteDeleteModal
        onDeleteClick={handleDeleteConfirmClick}
        onCloseClick={handleDeleteCloseClick}
      />);
  }

  function handleDeleteConfirmClick() {
    cancelAutoSave();

    ApiClient.deleteNote(selectedNote.noteId)
      .then(() => {
        handleDeleteCloseClick();
        if (onClose) {
          onClose();
        } else {
          navigateTo("/", true);
        }
        handleNoteChange();
      })
      .catch(() => { });
  }

  function handleDeleteCloseClick() {
    closeModal();
  }

  function handleArchiveClick() {
    ApiClient.archiveNote(selectedNote.noteId)
      .then(() => {
        showToast("Note archived.");
        handleNoteChange();
      })
      .catch(() => { });
  }

  function handleUnarchiveClick() {
    ApiClient.unarchiveNote(selectedNote.noteId)
      .then(() => {
        showToast("Note unarchived.");
        handleNoteChange();
      })
      .catch(() => { });
  }

  function handleRestoreClick() {
    ApiClient.restoreNote(selectedNote.noteId)
      .then(() => {
        handleNoteChange();
      })
      .catch(() => { });
  }

  function buildNoteMarkdown() {
    const currentTitle = titleRef.current?.textContent || "";
    const currentContent = contentValueRef.current;

    if (currentTitle.trim() === "") {
      return currentContent;
    }

    return `# ${currentTitle}\n\n${currentContent}`;
  }

  function handleCopyClick() {
    navigator.clipboard.writeText(buildNoteMarkdown())
      .then(() => {
        showToast("Note copied.");
      })
      .catch(() => {
        showToast("Couldn't copy note.");
      });
  }

  function handleShareClick() {
    const currentTitle = titleRef.current?.textContent || "";

    navigator.share({ title: currentTitle, text: buildNoteMarkdown() })
      .catch(error => {
        if (error.name === "AbortError") {
          return;
        }
        showToast("Couldn't share note.");
      });
  }

  function handleExpandToggleClick() {
    if (isExpandable !== true) {
      return;
    }
    toggleEditorExpanded();
  }

  function closeLightbox() {
    closeModal();
  }

  function handleTaskCheckboxClick(checkbox) {
    if (selectedNote?.isDeleted === true) {
      return;
    }

    const lineIndex = parseInt(checkbox.getAttribute('data-line'), 10);
    const newContent = toggleTaskAtLine(content, lineIndex);
    if (newContent === null) {
      return;
    }

    contentValueRef.current = newContent;
    setContent(newContent);

    if (isNewNote === true) {
      return;
    }

    const note = {
      title: title,
      content: newContent,
      tags: tags,
    };

    ApiClient.updateNote(selectedNote.noteId, note)
      .then(() => {
        handleNoteChange();
      })
      .catch(() => { });
  }

  function handleRenderedContentClick(e) {
    if (handleCodeCopyClick(e) === true) {
      return;
    }

    if (handleHeadingClick(e) === true) {
      return;
    }

    const checkbox = e.target.closest('.task-list-item-checkbox[data-line]');
    if (checkbox !== null) {
      handleTaskCheckboxClick(checkbox);
      return;
    }

    const image = e.target.closest('.notes-editor-rendered img');
    if (image !== null) {
      const filename = image.src.substring(image.src.lastIndexOf('/') + 1);
      const selectedImage = {
        url: image.src,
        filename: filename,
        aspectRatio: image.naturalWidth / image.naturalHeight,
      };
      openModal(<Lightbox selectedImage={selectedImage} imageDetails={[selectedImage]} onClose={closeLightbox} />);
      return;
    }

    const link = e.target.closest('a[data-note-id]');
    if (link === null) {
      return;
    }
    e.preventDefault();
    const noteId = parseInt(link.getAttribute('data-note-id'), 10);

    // Shift opens the side panel; Cmd/Ctrl stays the browser's new-tab gesture.
    if (e.shiftKey === true) {
      openSidePanelNote(noteId);
      return;
    }

    navigateTo(`/notes/${noteId}`);
  }

  function handlePinClick() {
    if (handlePinToggle && selectedNote) {
      handlePinToggle(selectedNote.noteId, selectedNote.isPinned);
    }
  }

  function handleUnpinClick() {
    if (handlePinToggle && selectedNote) {
      handlePinToggle(selectedNote.noteId, selectedNote.isPinned);
    }
  }

  function handleTemplateApply(templateTitle, templateContent, templateTags) {
    if (templateTitle && templateTitle.trim() !== "") {
      setTitle(templateTitle);
    }

    setContent(templateContent);

    if (templateTags && templateTags.length > 0) {
      setTags(templateTags);
    }

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const length = templateContent.length;
        textareaRef.current.selectionStart = length;
        textareaRef.current.selectionEnd = length;
      }
    }, 0);
  }

  const spellcheckValue = SpellcheckPreferences.isEnabled() ? "true" : "false";

  if (isEditable) {
    contentArea = renderEditableContent();
  } else if (title === "" && content === "") {
    contentArea = (
      <div className="notes-editor-empty-text">Empty note</div>
    );
  } else {
    contentArea = (
      <div className="notes-editor-rendered has-foldable-headings" ref={contentRef} dangerouslySetInnerHTML={{ __html: renderMarkdown(content, { hasCodeCopyButton: true, hasClickableTasks: selectedNote?.isDeleted !== true }) }} onClick={handleRenderedContentClick} />
    );
  }

  const imagePreviewItems = attachments.map((file, index) => {
    const imageUrl = URL.createObjectURL(file);
    return (
      <img src={imageUrl} alt={`Attachment ${index}`} />
    );
  });

  let templatePicker = null;
  if (isNewNote === true && isEditable === true && title === "" && content === "") {
    templatePicker = <TemplatePicker onTemplateApply={handleTemplateApply} />;
  }

  let imageDropzone = null;
  let imageAttachmentPreview = null;
  if (isEditable === true) {
    imageDropzone = (
      <div
        className={`notes-editor-image-dropzone ${isDraggingOver ? "is-dragging-over" : ""}`}
        onDrop={handleImageDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleDropzoneClick}>
        Click to upload or drag and drop images
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={handleFileInputChange}
          style={{ display: "none" }}
        />
      </div>
    );
    imageAttachmentPreview = (
      <div className="notes-editor-image-attachment-preview">{imagePreviewItems}</div>
    );
  }

  return (
    <div className="notes-editor" tabIndex="0" onPaste={handlePaste} ref={editorRef}>
      <Toolbar
        note={selectedNote}
        isNewNote={isNewNote}
        isEditable={isEditable}
        isModal={isModal}
        isSaveLoading={isSaveLoading}
        isExpanded={isEditorExpanded}
        isExpandable={isExpandable}
        onSaveClick={handleSaveClick}
        onEditClick={handleEditClick}
        onEditCancelClick={handleEditCancelClick}
        onDeleteClick={handleDeleteClick}
        onArchiveClick={handleArchiveClick}
        onUnarchiveClick={handleUnarchiveClick}
        onRestoreClick={handleRestoreClick}
        onExpandToggleClick={handleExpandToggleClick}
        onPinClick={handlePinClick}
        onUnpinClick={handleUnpinClick}
        onCopyClick={handleCopyClick}
        onShareClick={handleShareClick}
        onVersionsClick={handleVersionsClick}
      />
      <div className="notes-editor-header">
        <div className="notes-editor-title" contentEditable={isEditable} spellCheck={spellcheckValue} ref={titleRef} onBlur={handleTitleChange} />
      </div>
      <NotesEditorTags tags={tags} isEditable={isEditable} canCreateTag onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} />
      {imageDropzone}
      {imageAttachmentPreview}
      {isEditable && <EditorModeSwitcher mode={editorMode} onChange={handleModeChange} />}
      {isEditable && editorMode !== "wysiwyg" && <NotesEditorFormattingToolbar isEditable={isEditable} onFormat={handleEditorActions} />}
      <div className="notes-editor-content">
        {contentArea}
      </div>
      {templatePicker}
      <TableOfContents noteId={selectedNote?.noteId} content={content} isExpanded={isEditorExpanded} isEditable={isEditable} isNewNote={isNewNote} visibleHeadings={visibleHeadings} />
    </div>
  );
}

function Toolbar({ note, isNewNote, isEditable, isModal, isSaveLoading, isExpanded, isExpandable, onSaveClick, onEditClick, onEditCancelClick, onDeleteClick, onArchiveClick, onUnarchiveClick, onRestoreClick, onExpandToggleClick, onPinClick, onUnpinClick, onCopyClick, onShareClick, onVersionsClick }) {
  const saveButtonText = isSaveLoading ? "Saving..." : "Save";

  function handleClick(e) {
    if (e.target.className !== "notes-editor-toolbar") {
      e.stopPropagation();
      return;
    }

    document.querySelector(".notes-editor-container").scrollTo({ top: 0, behavior: 'smooth' });
  }

  const actions = {
    left: [
      {
        key: 'expand',
        condition: isExpandable === true && !isMobile(),
        component: <Button variant="ghost" onClick={onExpandToggleClick}>
          {isExpanded ? <SidebarCloseIcon /> : <SidebarOpenIcon />}
        </Button>
      },
      {
        key: 'back',
        condition: isMobile() && !isNewNote,
        component: <Button variant="ghost" onClick={() => window.history.back()}><BackIcon /></Button>
      }
    ],
    right: [
      {
        key: 'save',
        condition: isEditable,
        component: <Button variant="ghost" isDisabled={isSaveLoading} onClick={onSaveClick}>{saveButtonText}</Button>
      },
      {
        key: 'cancel',
        condition: isEditable,
        component: <Button variant="ghost" onClick={onEditCancelClick}>Cancel</Button>
      },
      {
        key: 'edit',
        condition: !isEditable && note?.isDeleted !== true,
        component: <Button variant="ghost" onClick={onEditClick}>Edit</Button>
      }
    ]
  };

  const leftToolbarActions = actions.left
    .filter(action => action.condition)
    .map(action => action.component);

  const rightToolbarActions = actions.right
    .filter(action => action.condition)
    .map(action => action.component);

  return (
    <div className="notes-editor-toolbar" onClick={handleClick}>
      <div className="left-toolbar">
        {leftToolbarActions}
      </div>
      <div className="right-toolbar">
        {rightToolbarActions}
        <NotesEditorMenu
          note={note}
          isNewNote={isNewNote}
          onPinClick={onPinClick}
          onUnpinClick={onUnpinClick}
          onArchiveClick={onArchiveClick}
          onUnarchiveClick={onUnarchiveClick}
          onRestoreClick={onRestoreClick}
          onDeleteClick={onDeleteClick}
          onCopyClick={onCopyClick}
          onShareClick={onShareClick}
          onVersionsClick={onVersionsClick}
          isModal={isModal}
        />
      </div>
    </div>
  );
}




function EditorModeSwitcher({ mode, onChange }) {
  const modes = [
    { id: "live", label: "Live Preview" },
    { id: "split", label: "Split View" },
    { id: "markdown", label: "Markdown" },
    { id: "wysiwyg", label: "WYSIWYG" }
  ];
  return (
    <div className="notes-editor-mode-switcher" role="group" aria-label="Editor mode">
      {modes.map(item => (
        <button type="button" key={item.id}
          className={`notes-editor-mode-button ${mode === item.id ? "is-active" : ""}`}
          aria-pressed={mode === item.id} onClick={() => onChange(item.id)}>{item.label}</button>
      ))}
    </div>
  );
}

function htmlToMarkdown(root) {
  const inline = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes).map(inline).join("");
    if (tag === "strong" || tag === "b") return `**${children}**`;
    if (tag === "em" || tag === "i") return `*${children}*`;
    if (tag === "s" || tag === "del" || tag === "strike") return `~~${children}~~`;
    if (tag === "code" && node.parentElement?.tagName !== "PRE") return "`" + children + "`";
    if (tag === "a") return `[${children}](${node.getAttribute("href") || ""})`;
    if (tag === "br") return "\\n";
    if (tag === "img") return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src") || ""})`;
    return children;
  };
  const block = node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return inline(node);
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return "\\n" + "#".repeat(Number(tag[1])) + " " + inline(node) + "\\n";
    if (tag === "p" || tag === "div") return "\\n" + Array.from(node.childNodes).map(block).join("") + "\\n";
    if (tag === "blockquote") return "\\n" + inline(node).split("\\n").map(line => "> " + line).join("\\n") + "\\n";
    if (tag === "ul" || tag === "ol") {
      const items = Array.from(node.children).filter(child => child.tagName.toLowerCase() === "li");
      return "\\n" + items.map((item, index) => {
        const checkbox = item.querySelector(":scope > input[type=checkbox]");
        const prefix = checkbox ? (checkbox.checked ? "- [x] " : "- [ ] ") : (tag === "ol" ? (index + 1) + ". " : "- ");
        return prefix + Array.from(item.childNodes).filter(child => child.tagName?.toLowerCase() !== "ul" && child.tagName?.toLowerCase() !== "ol").map(inline).join("").trim();
      }).join("\\n") + "\\n";
    }
    if (tag === "pre") return "\\n```\\n" + node.textContent.replace(/\\n+$/, "") + "\\n```\\n";
    if (tag === "hr") return "\\n---\\n";
    if (tag === "table") {
      const rows = Array.from(node.querySelectorAll("tr"));
      if (!rows.length) return "";
      const cells = row => Array.from(row.children).map(cell => inline(cell).replace(/\\|/g, "\\\\|").trim());
      const header = cells(rows[0]);
      return "\\n| " + header.join(" | ") + " |\\n| " + header.map(() => "---").join(" | ") + " |\\n" +
        rows.slice(1).map(row => "| " + cells(row).join(" | ") + " |").join("\\n") + "\\n";
    }
    return Array.from(node.childNodes).map(block).join("");
  };
  return Array.from(root.cloneNode(true).childNodes).map(block).join("").replace(/\\n{3,}/g, "\\n\\n").trim();
}
