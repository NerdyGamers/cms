---
title: Showcase
slug: showcase
draft: false
updated: 2026-10-09T22:45:00Z
---

# Markdown Showcase

Everything this CMS can render, all on one page. View the source of this page in the repo (`content/pages/showcase.md`) to see the Markdown behind it.

## Text formatting

**Bold**, *italic*, ***bold and italic***, ~~strikethrough~~, and `inline code`.

## Headings

### Level 3 heading

#### Level 4 heading

## Links

[GitHub](https://github.com) — [a link with a title](https://github.com "Hover text")

## Images

![A random placeholder image](https://picsum.photos/seed/cms/800/400)

Images you upload through the backend live in `assets/` — reference them like `![alt text](assets/photo.png)`.

## Code blocks

```js
function greet(name) {
  return `Hello, ${name}!`;
}
console.log(greet("world"));
```

```python
def greet(name):
    return f"Hello, {name}!"

print(greet("world"))
```

```csharp
public string Greet(string name)
{
    return $"Hello, {name}!";
}
```

```bash
git add .
git commit -m "Update page"
git push
```

## Blockquotes

> The best CMS is the one you don't have to maintain.
>
> — someone, probably

## Lists

- Unordered item one
- Unordered item two
  - Nested item
  - Another nested item
- Unordered item three

1. First ordered item
2. Second ordered item
3. Third ordered item

- [x] Done task
- [ ] Open task

## Tables

| Feature   | Supported |
| --------- | --------- |
| Headings  | Yes       |
| Code blocks | Yes     |
| Tables    | Yes       |
| Drafts    | Yes       |

## Horizontal rule

---

That's everything. Now go write something real.
