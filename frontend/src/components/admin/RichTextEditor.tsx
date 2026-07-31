import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { useEffect, useRef } from 'react';

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onReady?: () => void;
};

type ToolbarButtonProps = {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolbarButton({ active = false, disabled = false, label, onClick, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 rounded border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'border-blue-600 bg-blue-50 text-blue-700'
          : 'border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:text-blue-700'
      }`}
    >
      {label}
    </button>
  );
}

function setLink(editor: Editor) {
  const previousUrl = editor.getAttributes('link').href as string | undefined;
  const url = window.prompt('Nhập URL liên kết', previousUrl ?? '');

  if (url === null) {
    return;
  }

  if (url.trim() === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
}

function addImage(editor: Editor) {
  const url = window.prompt('Nhập URL hình ảnh');

  if (!url?.trim()) {
    return;
  }

  editor.chain().focus().setImage({ src: url.trim() }).run();
}

export function RichTextEditor({ onChange, onReady, value }: RichTextEditorProps) {
  const previousValueRef = useRef(value || '');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Link.configure({
        autolink: true,
        defaultProtocol: 'https',
        openOnClick: false,
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: 'rich-content-image',
        },
      }),
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'rich-editor-content',
      },
    },
    onUpdate({ editor: currentEditor }) {
      const nextHtml = currentEditor.getHTML();
      previousValueRef.current = nextHtml;
      onChange(nextHtml);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    onReady?.();
  }, [editor, onReady]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextValue = value || '';

    if (nextValue === previousValueRef.current) {
      return;
    }

    previousValueRef.current = nextValue;

    if (nextValue !== editor.getHTML()) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="rounded border border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        Đang tải editor...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-slate-300 bg-white">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-3">
        <ToolbarButton
          label="B"
          title="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="I"
          title="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="H2"
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label="H3"
          title="Heading 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarButton
          label="• List"
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="1. List"
          title="Ordered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Quote"
          title="Blockquote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          label="Link"
          title="Link"
          active={editor.isActive('link')}
          onClick={() => setLink(editor)}
        />
        <ToolbarButton label="Image" title="Insert image by URL" onClick={() => addImage(editor)} />
        <ToolbarButton
          label="Undo"
          title="Undo"
          disabled={!editor.can().chain().focus().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="Redo"
          title="Redo"
          disabled={!editor.can().chain().focus().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
