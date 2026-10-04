export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-cream-50">
      <div className="bg-pine-950 pb-10 pt-32" />
      <article className="prose-legal mx-auto max-w-3xl px-6 py-16">
        {children}
      </article>
      <style>{`
        .prose-legal h1 { font-family: var(--font-display); font-size: 2.5rem; font-weight: 600; line-height: 1.1; color: var(--color-pine-950); margin-bottom: 0.5rem; }
        .prose-legal h2 { font-family: var(--font-display); font-size: 1.5rem; font-weight: 600; color: var(--color-pine-900); margin-top: 2.25rem; margin-bottom: 0.75rem; }
        .prose-legal p, .prose-legal li { line-height: 1.75; color: rgb(24 63 55 / 0.9); margin-bottom: 0.9rem; }
        .prose-legal ul { list-style: disc; padding-left: 1.4rem; margin-bottom: 1rem; }
        .prose-legal .updated { font-size: 0.85rem; color: var(--color-pine-500); margin-bottom: 2rem; }
        .prose-legal a { color: var(--color-pine-600); text-decoration: underline; }
      `}</style>
    </div>
  );
}
