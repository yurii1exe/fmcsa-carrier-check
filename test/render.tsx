import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

/**
 * Rendering server components in the test suite.
 *
 * The components in this app are React Server Components: they take data,
 * return markup, and use no state, no effects and no client JavaScript.
 * Rendering them to a static string is therefore the whole of their
 * behaviour, so the tests need neither a DOM nor a headless browser — which
 * keeps them as fast as the unit tests and adds no dependency to the project.
 */
export function markup(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

/**
 * The same, for a tree with a `<Suspense>` boundary and async work under it —
 * which is what the page is. `renderToStaticMarkup` cannot wait for a
 * boundary to resolve; the streaming renderer can, and `allReady` is the
 * point at which the page a real visitor receives is complete.
 */
export async function streamedMarkup(element: ReactElement): Promise<string> {
  const { renderToReadableStream } = await import("react-dom/server.edge");
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
};

/** Tags out, entities decoded, whitespace collapsed. */
export function toText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[#a-z0-9]+;/gi, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

/** The text a reader sees, so assertions are about copy rather than markup. */
export function text(element: ReactElement): string {
  return toText(markup(element));
}

export async function streamedText(element: ReactElement): Promise<string> {
  return toText(await streamedMarkup(element));
}
