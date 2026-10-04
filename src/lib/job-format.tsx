import { Fragment } from 'react';

/**
 * Job descriptions are stored as plain text with three light conventions:
 *
 *   ## Heading
 *   - bullet point          (or "* ", or "• " pasted from Word / CareerPlug)
 *   **bold words**
 *
 * Blank lines separate paragraphs. Everything is rendered as React elements,
 * never as HTML, so nothing typed into a job post can run on the public site.
 */

type Block =
  | { kind: 'h'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] };

const BULLET = /^\s*(?:[-*•▪◦]|\d+[.)])\s+/;

export function parseDescription(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: 'ul', items: list });
    list = [];
  };

  for (const raw of src.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
    } else if (line.startsWith('#')) {
      flushPara();
      flushList();
      blocks.push({ kind: 'h', text: line.replace(/^#+\s*/, '') });
    } else if (BULLET.test(line)) {
      flushPara();
      list.push(line.replace(BULLET, ''));
    } else if (/^[A-Z][A-Za-z /&]{2,40}:$/.test(line)) {
      // "Duties:" on its own line, as CareerPlug templates write headings
      flushPara();
      flushList();
      blocks.push({ kind: 'h', text: line.slice(0, -1) });
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export function JobDescription({ text, compact = false }: { text: string; compact?: boolean }) {
  const blocks = parseDescription(text);
  return (
    <div className={compact ? 'space-y-3 text-sm' : 'space-y-4 text-[15px] sm:text-base'}>
      {blocks.map((b, i) =>
        b.kind === 'h' ? (
          <h3 key={i} className={`font-bold text-plum-700 ${compact ? 'pt-1 text-sm' : 'pt-3 text-lg'}`}>{inline(b.text)}</h3>
        ) : b.kind === 'ul' ? (
          <ul key={i} className="list-disc space-y-1.5 pl-5 leading-relaxed text-gray-700 marker:text-teal-700">
            {b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}
          </ul>
        ) : (
          <p key={i} className="leading-relaxed text-gray-700">{inline(b.text)}</p>
        )
      )}
    </div>
  );
}
