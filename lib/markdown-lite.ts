/**
 * Markdown-lite: the small subset of markdown the assistant actually writes
 * (paragraphs, bold, bullet / numbered lists, simple headings, bare links),
 * parsed into a block structure the widget renders with React elements —
 * never as HTML, so model output can't inject markup. Pure and dependency-free.
 */

export type Inline = { type: "text"; text: string } | { type: "bold"; text: string } | { type: "link"; href: string };

export type Block =
  | { type: "paragraph"; lines: Inline[][] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "heading"; inlines: Inline[] };

// Bold needs non-space at both ends ("** b **" is literal); links stop at
// whitespace/brackets and shed trailing punctuation below.
const INLINE_RE = /(\*\*(?=\S)[^*\n]+?(?<=\S)\*\*|https?:\/\/[^\s<>)]+)/g;
const TRAILING_PUNCT_RE = /^(.*?)([.,;:!?]+)$/;
const LIST_RE = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/;
const HEADING_RE = /^\s*#{1,6}\s+(.*)$/;

/** Bold (**x**) and bare URLs; everything else is literal text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  for (const piece of text.split(INLINE_RE)) {
    if (!piece) continue;
    if (piece.startsWith("**") && piece.endsWith("**") && piece.length > 4) {
      out.push({ type: "bold", text: piece.slice(2, -2) });
    } else if (/^https?:\/\//.test(piece)) {
      const m = piece.match(TRAILING_PUNCT_RE);
      if (m) {
        out.push({ type: "link", href: m[1]! }, { type: "text", text: m[2]! });
      } else {
        out.push({ type: "link", href: piece });
      }
    } else {
      out.push({ type: "text", text: piece });
    }
  }
  // Merge adjacent text nodes (e.g. link punctuation + following text).
  return out.reduce<Inline[]>((acc, n) => {
    const prev = acc[acc.length - 1];
    if (n.type === "text" && prev?.type === "text") prev.text += n.text;
    else acc.push(n);
    return acc;
  }, []);
}

export function parseMarkdownLite(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: Inline[][] | null = null;
  let list: { ordered: boolean; items: Inline[][] } | null = null;

  const closeParagraph = () => {
    if (paragraph?.length) blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = null;
  };
  const closeList = () => {
    if (list?.items.length) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) {
      closeParagraph();
      closeList();
      continue;
    }
    const li = line.match(LIST_RE);
    if (li) {
      closeParagraph();
      const ordered = li[2] !== undefined;
      if (!list || list.ordered !== ordered) {
        closeList();
        list = { ordered, items: [] };
      }
      list.items.push(parseInline(li[3] ?? ""));
      continue;
    }
    const h = line.match(HEADING_RE);
    if (h) {
      closeParagraph();
      closeList();
      blocks.push({ type: "heading", inlines: parseInline(h[1] ?? "") });
      continue;
    }
    closeList();
    (paragraph ??= []).push(parseInline(line));
  }
  closeParagraph();
  closeList();
  return blocks;
}
