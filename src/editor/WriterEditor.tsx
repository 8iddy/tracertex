import { useEffect, useRef, useState } from "react";
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, REDO_COMMAND, UNDO_COMMAND, type EditorState, type ElementNode, type LexicalEditor, type TextFormatType } from "lexical";
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Bold, Heading2, Italic, List, ListOrdered, Pilcrow, Quote, Redo2, RemoveFormatting, Undo2 } from "lucide-react";
import type { EventSource } from "./eventTypes";

interface WriterEditorProps {
  initialText?: string;
  onTextChange: (text: string, source: EventSource) => void;
  onSelectionChange?: (anchor: number, focus: number) => void;
  onFocusChange?: (focused: boolean) => void;
  onComposition?: (phase: "start" | "update" | "end", text: string, position: number) => void;
  onHistory?: (action: "undo" | "redo") => void;
  ariaLabel?: string;
  minimal?: boolean;
  disabled?: boolean;
}

function initialEditorState(text: string): () => void {
  return () => {
    const root = $getRoot();
    root.clear();
    const parts = text.split("\n");
    for (const part of parts) {
      const paragraph = $createParagraphNode();
      if (part) paragraph.append($createTextNode(part));
      root.append(paragraph);
    }
  };
}

function Toolbar({ onHistory }: { onHistory?: (action: "undo" | "redo") => void }) {
  const [editor] = useLexicalComposerContext();
  const button = (label: string, icon: React.ReactNode, action: () => void) => <button type="button" className="editor-tool" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={action}>{icon}</button>;
  const format = (type: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  const setBlock = (factory: () => ElementNode) => editor.update(() => { const selection = $getSelection(); if ($isRangeSelection(selection)) $setBlocksType(selection, factory) });
  return <div className="editor-toolbar" aria-label="Text formatting">
    {button("Undo", <Undo2 size={16} />, () => { onHistory?.("undo"); editor.dispatchCommand(UNDO_COMMAND, undefined) })}
    {button("Redo", <Redo2 size={16} />, () => { onHistory?.("redo"); editor.dispatchCommand(REDO_COMMAND, undefined) })}
    <span className="tool-divider" />
    {button("Bold", <Bold size={16} />, () => format("bold"))}
    {button("Italic", <Italic size={16} />, () => format("italic"))}
    <span className="tool-divider" />
    {button("Paragraph", <Pilcrow size={16} />, () => setBlock(() => $createParagraphNode()))}
    {button("Heading", <Heading2 size={16} />, () => setBlock(() => $createHeadingNode("h2")))}
    {button("Bulleted list", <List size={16} />, () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined))}
    {button("Numbered list", <ListOrdered size={16} />, () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined))}
    {button("Remove list", <RemoveFormatting size={16} />, () => editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined))}
    {button("Block quote", <Quote size={16} />, () => setBlock(() => $createQuoteNode()))}
  </div>;
}

function CapturePlugin({ onTextChange, onSelectionChange }: Pick<WriterEditorProps, "onTextChange" | "onSelectionChange">) {
  const source = useRef<EventSource>("unknown");
  const previousText = useRef<string | undefined>(undefined);
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const beforeInput = (event: InputEvent) => { source.current = event.inputType === "insertFromPaste" ? "paste" : event.isComposing ? "composition" : "keyboard" };
    const paste = () => { source.current = "paste" };
    root.addEventListener("beforeinput", beforeInput);
    root.addEventListener("paste", paste);
    return () => { root.removeEventListener("beforeinput", beforeInput); root.removeEventListener("paste", paste) };
  }, [editor]);
  const handleChange = (state: EditorState) => state.read(() => {
    const text = $getRoot().getTextContent();
    const documentChanged = previousText.current !== undefined && previousText.current !== text;
    onTextChange(text, source.current);
    previousText.current = text;
    source.current = "unknown";
    const selection = $getSelection();
    if (!documentChanged && $isRangeSelection(selection)) onSelectionChange?.(selection.anchor.offset, selection.focus.offset);
  });
  return <OnChangePlugin onChange={handleChange} ignoreSelectionChange={false} />;
}

function EditorBridge({ onEditor }: { onEditor: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => onEditor(editor), [editor, onEditor]);
  return null;
}

function EditablePlugin({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.setEditable(!disabled), [disabled, editor]);
  return null;
}

export function WriterEditor({ initialText = "", onTextChange, onSelectionChange, onFocusChange, onComposition, onHistory, ariaLabel = "Writing editor", minimal = false, disabled = false }: WriterEditorProps) {
  const [wordCount, setWordCount] = useState(initialText.trim() ? initialText.trim().split(/\s+/).length : 0);
  const position = useRef(0);
  const editorRef = useRef<LexicalEditor | null>(null);
  const config = {
    namespace: "TracerTextWriter",
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode],
    editorState: initialEditorState(initialText),
    theme: { paragraph: "editor-paragraph", heading: { h2: "editor-heading" }, quote: "editor-quote", list: { ul: "editor-list", ol: "editor-list" }, text: { bold: "editor-bold", italic: "editor-italic" } },
    onError: (error: Error) => { throw error },
  };
  const handleText = (text: string, source: EventSource) => { setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0); onTextChange(text, source) };
  const handleSelection = (anchor: number, focus: number) => { position.current = focus; onSelectionChange?.(anchor, focus) };
  return <LexicalComposer initialConfig={config}>
    <div className="editor-shell">
      {!minimal && <Toolbar onHistory={onHistory} />}
      <div className={`editor-surface${minimal ? " editor-surface-minimal" : ""}${disabled ? " editor-disabled" : ""}`} onFocus={() => onFocusChange?.(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onFocusChange?.(false) }} onCompositionStart={() => onComposition?.("start", "", position.current)} onCompositionUpdate={(event) => onComposition?.("update", event.data, position.current)} onCompositionEnd={(event) => onComposition?.("end", event.data, position.current)}>
        <RichTextPlugin contentEditable={<ContentEditable className="editor-input" aria-label={ariaLabel} />} placeholder={<div className="editor-placeholder">Start writing here…</div>} ErrorBoundary={LexicalErrorBoundary} />
        <HistoryPlugin />
        <ListPlugin />
        <CapturePlugin onTextChange={handleText} onSelectionChange={handleSelection} />
        <EditorBridge onEditor={(editor) => { editorRef.current = editor }} />
        <EditablePlugin disabled={disabled} />
      </div>
      {!minimal && <div className="editor-footer"><span>{wordCount} {wordCount === 1 ? "word" : "words"}</span><span>Saved locally</span></div>}
    </div>
  </LexicalComposer>;
}
