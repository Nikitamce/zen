import test from "node:test";
import assert from "node:assert/strict";
import htmlToMarkdown from "./htmlToMarkdown.js";

function text(value) {
  return { nodeType: 3, nodeValue: value, textContent: value };
}

function element(tagName, attributes = {}, children = []) {
  const node = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    attributes,
    childNodes: children,
    children: children.filter(child => child.nodeType === 1),
    style: {},
    parentElement: null,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
    },
    classList: {
      contains(name) {
        return (attributes.class || "").split(/\s+/).includes(name);
      }
    },
    querySelector(selector) {
      const match = this.querySelectorAll(selector)[0];
      return match || null;
    },
    querySelectorAll(selector) {
      const wanted = selector === "tr" ? "TR"
        : selector === "pre" ? "PRE"
        : selector === "code" ? "CODE"
        : selector === "table" ? "TABLE"
        : selector.includes("input[type=checkbox]") ? "INPUT"
        : null;
      const results = [];
      const visit = current => {
        for (const child of current.children || []) {
          if (wanted && child.tagName === wanted) results.push(child);
          visit(child);
        }
      };
      visit(this);
      return results;
    }
  };

  for (const child of children) {
    if (child.nodeType === 1) child.parentElement = node;
  }
  Object.defineProperty(node, "textContent", {
    get() {
      return children.map(child => child.textContent || "").join("");
    }
  });
  return node;
}

test("serializes headings, paragraphs and inline formatting", () => {
  const root = element("div", {}, [
    element("h2", {}, [text("Project")]),
    element("p", {}, [
      text("A "),
      element("strong", {}, [text("bold")]),
      text(" and "),
      element("em", {}, [text("clear")]),
      text(" note.")
    ])
  ]);

  assert.equal(htmlToMarkdown(root), "## Project\n\nA **bold** and *clear* note\\.");
});

test("serializes task lists and nested lists", () => {
  const checked = element("input", { type: "checkbox", checked: "checked" }, []);
  checked.checked = true;
  const taskText = element("div", { class: "task-item-content" }, [
    checked,
    element("span", {}, [text("Done")])
  ]);
  const nested = element("ul", {}, [
    element("li", {}, [text("Subtask")])
  ]);
  const root = element("div", {}, [
    element("ul", {}, [
      element("li", {}, [taskText, nested])
    ])
  ]);

  assert.equal(htmlToMarkdown(root), "- [x] Done\n  - Subtask");
});

test("serializes fenced code blocks with language labels", () => {
  const code = element("code", { class: "language-js" }, [text("console.log(1);\n")]);
  const pre = element("pre", {}, [code]);
  const root = element("div", {}, [
    element("div", { class: "code-block" }, [element("button", {}, []), pre])
  ]);

  assert.equal(htmlToMarkdown(root), "```js\nconsole.log(1);\n```");
});

test("serializes rendered Markdown tables", () => {
  const table = element("table", {}, [
    element("thead", {}, [
      element("tr", {}, [
        element("th", {}, [text("Name")]),
        element("th", { align: "right" }, [text("Count")])
      ])
    ]),
    element("tbody", {}, [
      element("tr", {}, [
        element("td", {}, [text("Alpha")]),
        element("td", {}, [text("2")])
      ])
    ])
  ]);
  const root = element("div", {}, [
    element("div", { class: "table-block" }, [table])
  ]);

  assert.equal(
    htmlToMarkdown(root),
    "| Name | Count |\n| --- | ---: |\n| Alpha | 2 |"
  );
});

test("escapes Markdown punctuation in literal text", () => {
  const root = element("div", {}, [
    element("p", {}, [text("Use * literally, and keep [brackets] and == marks.")])
  ]);

  assert.equal(
    htmlToMarkdown(root),
    "Use \\* literally, and keep \\[brackets\\] and \\=\\= marks\\."
  );
});
