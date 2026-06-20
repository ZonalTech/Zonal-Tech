/**
 * Minimal, safe markdown renderer for AI chat replies.
 *
 * Handles the small subset models actually emit — bold, inline code, links,
 * bullet lists, headings and paragraphs — by building React elements (no
 * dangerouslySetInnerHTML, so no XSS surface). Anything it doesn't recognise
 * is rendered as plain text.
 */

// Inline: **bold**, `code`, [text](url)
function renderInline(text) {
  const nodes = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/;
  let str = String(text);
  let key = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > 0) nodes.push(str.slice(0, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={key++}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(<code key={key++}>{m[3]}</code>);
    } else if (m[4] !== undefined) {
      const href = m[5];
      const safe = /^(https?:\/\/|mailto:|\/)/i.test(href);
      nodes.push(safe
        ? <a key={key++} href={href} target="_blank" rel="noreferrer">{m[4]}</a>
        : m[4]);
    }
    str = str.slice(m.index + m[0].length);
  }
  if (str) nodes.push(str);
  return nodes;
}

export default function Markdown({ text }) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  let list = null;
  let para = [];

  const flushPara = () => { if (para.length) { blocks.push({ t: "p", v: para.join(" ") }); para = []; } };
  const flushList = () => { if (list) { blocks.push({ t: "ul", v: list }); list = null; } };

  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*]\s+(.*)/);
    const heading = line.match(/^#{1,4}\s+(.*)/);
    if (bullet) { flushPara(); (list || (list = [])).push(bullet[1]); }
    else if (heading) { flushPara(); flushList(); blocks.push({ t: "h", v: heading[1] }); }
    else if (line === "") { flushPara(); flushList(); }
    else { flushList(); para.push(line); }
  }
  flushPara(); flushList();

  return (
    <div className="md">
      {blocks.map((b, i) => {
        if (b.t === "ul") return <ul key={i}>{b.v.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>;
        if (b.t === "h") return <h4 key={i}>{renderInline(b.v)}</h4>;
        return <p key={i}>{renderInline(b.v)}</p>;
      })}
    </div>
  );
}
