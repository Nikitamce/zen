import { h, useState } from "../../assets/preact.esm.js";
import AutoSavePreferences from "../../commons/preferences/AutoSavePreferences.js";
import SpellcheckPreferences from "../../commons/preferences/SpellcheckPreferences.js";
import EditorModePreferences from "../../commons/preferences/EditorModePreferences.js";
import Toggle from "../../commons/components/Toggle.jsx";
import SettingsRow from "./SettingsRow.jsx";
import SettingsSection from "./SettingsSection.jsx";
import { FileCheckIcon, SpellCheckIcon } from "../../commons/components/Icon.jsx";

export default function EditorPane() {
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(() => AutoSavePreferences.isEnabled());
  const [isSpellcheckEnabled, setIsSpellcheckEnabled] = useState(() => SpellcheckPreferences.isEnabled());
  const [editorMode, setEditorMode] = useState(() => EditorModePreferences.getMode());

  function handleAutoSaveChange(newValue) {
    setIsAutoSaveEnabled(newValue);
    AutoSavePreferences.setEnabled(newValue);
  }

  function handleSpellcheckChange(newValue) {
    setIsSpellcheckEnabled(newValue);
    SpellcheckPreferences.setEnabled(newValue);
  }

  function handleEditorModeChange(e) {
    setEditorMode(e.target.value);
    EditorModePreferences.setMode(e.target.value);
  }

  return (
    <div className="settings-tab-content">
      <SettingsSection title="Writing" description="Configure how the note editor behaves while you write.">
        <div className="settings-card">
          <SettingsRow icon={<FileCheckIcon />} label="Auto Save" description="Automatically save notes while you type">
            <Toggle isEnabled={isAutoSaveEnabled} onChange={handleAutoSaveChange} />
          </SettingsRow>
          <SettingsRow icon={<SpellCheckIcon />} label="Spellcheck" description="Highlight misspelled words while you write">
            <Toggle isEnabled={isSpellcheckEnabled} onChange={handleSpellcheckChange} />
          </SettingsRow>
          <SettingsRow label="Default editor mode" description="Choose how notes open when you start editing">
            <select value={editorMode} onChange={handleEditorModeChange}>
              <option value="live">Live Preview</option>
              <option value="split">Split View</option>
              <option value="markdown">Markdown</option>
              <option value="wysiwyg">WYSIWYG</option>
            </select>
          </SettingsRow>
        </div>
      </SettingsSection>
    </div>
  );
}
