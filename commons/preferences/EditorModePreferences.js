const EDITOR_MODE_KEY = "editor-mode";
const VALID_MODES = ["live", "split", "markdown", "wysiwyg"];

function getMode() {
  try {
    const stored = localStorage.getItem(EDITOR_MODE_KEY);
    return VALID_MODES.includes(stored) ? stored : "live";
  } catch {
    return "live";
  }
}

function setMode(mode) {
  if (!VALID_MODES.includes(mode)) return;
  try {
    localStorage.setItem(EDITOR_MODE_KEY, mode);
  } catch {
  }
}

export default { getMode, setMode };
