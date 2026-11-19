function getElementChildren(node, selector) {
  return Array.from(node.querySelectorAll(selector));
}

function escapeMarkdownText(value) {
  return value.replace(/([\\`*_{}\[\]()#+\-.!>~=<])/g, "\\$1");
}

function serializeInline(node) {
  if (node.nodeType === 3) {
    return escapeMarkdownText(node.nodeValue.replace(/\u00a0/g, " "));
  }
  if (node.nodeType !== 1) return "";

  const tag = node.tagName.toLowerCase();
  if (tag === "code") {
    if (node.parentElement?.tagName === "PRE") return node.textContent;
    return wrapInlineCode(node.textContent);
  }

  const children = Array.from(node.childNodes).map(serializeInline).join("");
  switch (tag) {
    case "strong":
    case "b": return "**" + children + "**";
    case "em":
    case "i": return "*" + children + "*";
    case "s":
    case "del":
    case "strike": return "~~" + children + "~~";
    case "mark": return "==" + children + "==";
    case "a": {
      const href = node.getAttribute("href") || "";
      return href ? "[" + children + "](" + href + ")" : children;
    }
    case "img": {
      const src = node.getAttribute("src") || "";
      const alt = node.getAttribute("alt") || "";
      return src ? "![" + alt + "](" + src + ")" : "";
    }
    case "br": return "  \n";
    case "input": return "";
    default: return children;
  }
}

function wrapInlineCode(text) {
  const tick = String.fromCharCode(96);
  const runs = text.match(/\x60+/g) || [];
  const fence = tick.repeat(Math.max(1, ...runs.map(run => run.length + 1)));
  const padding = text.startsWith(tick) || text.endsWith(tick) ? " " : "";
  return fence + padding + text + padding + fence;
}

function serializeCodeBlock(pre) {
  const code = pre.querySelector("code") || pre;
  const className = code.getAttribute("class") || "";
  const language = (className.match(/(?:^|\s)language-([\w+#.-]+)/) || [])[1] || "";
  const text = code.textContent.replace(/\n$/, "");
  const tick = String.fromCharCode(96);
  const ticks = text.match(/\x60+/g) || [];
  const fence = tick.repeat(Math.max(3, ...ticks.map(run => run.length + 1)));
  return fence + language + "\n" + text + "\n" + fence;
}

function serializeList(list, depth = 0) {
  const ordered = list.tagName.toLowerCase() === "ol";
  let nextNumber = Number.parseInt(list.getAttribute("start") || "1", 10);
  if (!Number.isFinite(nextNumber)) nextNumber = 1;

  const items = Array.from(list.children).filter(child => child.tagName?.toLowerCase() === "li");
  return items.map(item => {
    const nestedLists = Array.from(item.children)
      .filter(child => ["ul", "ol"].includes(child.tagName?.toLowerCase()));
    const checkbox = item.querySelector(
      ":scope > input[type=checkbox], :scope > .task-item-content > input[type=checkbox]"
    );
    const customNumber = Number.parseInt(item.getAttribute("value") || "", 10);
    if (Number.isFinite(customNumber)) nextNumber = customNumber;

    const marker = checkbox
      ? (checkbox.checked ? "- [x] " : "- [ ] ")
      : (ordered ? nextNumber + ". " : "- ");
    if (ordered) nextNumber += 1;

    const mainNodes = Array.from(item.childNodes)
      .filter(child => !["ul", "ol"].includes(child.tagName?.toLowerCase()));
    const itemText = mainNodes.map(serializeInline).join("").replace(/\s+$/g, "").trim();
    const nested = nestedLists.map(child => serializeList(child, depth + 1));
    return ["  ".repeat(depth) + marker + itemText, ...nested].filter(Boolean).join("\n");
  }).join("\n");
}

function serializeTable(table) {
  const rows = getElementChildren(table, "tr");
  if (rows.length === 0) return "";

  const cellTexts = row => Array.from(row.children)
    .filter(cell => ["th", "td"].includes(cell.tagName.toLowerCase()))
    .map(cell => serializeInline(cell).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim());

  const header = cellTexts(rows[0]);
  if (header.length === 0) return "";
  const alignment = Array.from(rows[0].children)
    .filter(cell => ["th", "td"].includes(cell.tagName.toLowerCase()))
    .map(cell => {
      const align = (cell.getAttribute("align") || cell.style.textAlign || "").toLowerCase();
      if (align === "center") return ":---:";
      if (align === "right") return "---:";
      return "---";
    });

  const body = rows.slice(1).map(row => {
    const cells = cellTexts(row);
    while (cells.length < header.length) cells.push("");
    return "| " + header.map((_, index) => cells[index] || "").join(" | ") + " |";
  });

  return ["| " + header.join(" | ") + " |", "| " + alignment.join(" | ") + " |", ...body].join("\n");
}

function serializeBlock(node) {
  if (node.nodeType === 3) return node.nodeValue.trim() ? node.nodeValue.trim() : "";
  if (node.nodeType !== 1) return "";

  const tag = node.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return "#".repeat(Number(tag[1])) + " " + serializeInline(node).trim();
  if (tag === "p") return serializeInline(node).trim();
  if (tag === "ul" || tag === "ol") return serializeList(node);
  if (tag === "pre") return serializeCodeBlock(node);
  if (tag === "hr") return "---";

  if (tag === "table") return serializeTable(node);

  if (tag === "blockquote") {
    const inner = Array.from(node.childNodes).map(serializeBlock).filter(Boolean).join("\n");
    return inner.split("\n").map(line => line ? "> " + line : ">").join("\n");
  }

  if (tag === "div" && node.classList.contains("code-block")) {
    const pre = node.querySelector("pre");
    return pre ? serializeCodeBlock(pre) : "";
  }
  if (tag === "div" && node.classList.contains("table-block")) {
    const table = node.querySelector("table");
    return table ? serializeTable(table) : "";
  }

  const children = Array.from(node.childNodes).map(serializeBlock).filter(Boolean);
  if (children.length > 0) return children.join("\n\n");
  return serializeInline(node).trim();
}

export default function htmlToMarkdown(root) {
  if (!root) return "";
  const markdown = Array.from(root.childNodes)
    .map(serializeBlock)
    .filter(Boolean)
    .join("\n\n");

  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
