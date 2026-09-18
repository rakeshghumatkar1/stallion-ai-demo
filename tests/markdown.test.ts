import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdownLite } from "@/lib/markdown-lite";

describe("markdown-lite inline", () => {
  it("parses bold and bare links, leaving other text literal", () => {
    expect(parseInline("**Ceremony:** 19 March 2027 at https://example.com/x, see <b>no</b>")).toEqual([
      { type: "bold", text: "Ceremony:" },
      { type: "text", text: " 19 March 2027 at " },
      { type: "link", href: "https://example.com/x" },
      { type: "text", text: ", see <b>no</b>" },
    ]);
  });

  it("does not treat a lone or empty ** as bold", () => {
    expect(parseInline("a ** b ****")).toEqual([{ type: "text", text: "a ** b ****" }]);
  });
});

describe("markdown-lite blocks", () => {
  it("turns the assistant's typical reply into paragraphs and a bullet list", () => {
    const text = [
      "Digital Stallion Awards India 2027 is the 3rd edition.",
      "",
      "- **Ceremony:** 19 March 2027",
      "- **Venue:** To be announced",
      "",
      "The awards distinguish between campaign and individual awards.",
    ].join("\n");
    const blocks = parseMarkdownLite(text);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list", "paragraph"]);
    const list = blocks[1];
    expect(list.type === "list" && list.ordered).toBe(false);
    expect(list.type === "list" && list.items[0]).toEqual([
      { type: "bold", text: "Ceremony:" },
      { type: "text", text: " 19 March 2027" },
    ]);
  });

  it("handles a list directly after a paragraph line, numbered lists, and headings", () => {
    const blocks = parseMarkdownLite("Steps:\n1. Fill the form\n2) Pay the fee\n### Note\nDone");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list", "heading", "paragraph"]);
    const list = blocks[1];
    expect(list.type === "list" && list.ordered).toBe(true);
    expect(list.type === "list" && list.items.length).toBe(2);
  });

  it("keeps single newlines inside a paragraph as separate lines", () => {
    const [p] = parseMarkdownLite("line one\nline two");
    expect(p?.type === "paragraph" && p.lines.length).toBe(2);
  });

  it("returns nothing for empty input", () => {
    expect(parseMarkdownLite("   \n\n")).toEqual([]);
  });
});
