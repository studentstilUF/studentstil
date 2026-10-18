/**
 * Små hjälpfunktioner för att arbeta med sidan (DOM).
 * Vi bygger element med h() och textContent i stället för innerHTML, så att
 * text från databasen aldrig kan tolkas som HTML/JavaScript (skydd mot XSS).
 */

/** Hämtar ett element via id och kontrollerar att det är av rätt typ. */
export function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Elementet #${id} saknas på sidan.`);
  return element;
}

type AttrValue = string | number | boolean | undefined;
type Child = Node | string | null | undefined | false;

/** h('p', { class: 'muted' }, 'Hej') → <p class="muted">Hej</p> */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, AttrValue>> = {},
  ...children: readonly Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) element.append(child);
  }
  return element;
}

/** Filtrerar bort tomma barn (null/false), t.ex. inför element.replaceChildren(...nodes(...)). */
export function nodes(...children: readonly Child[]): (Node | string)[] {
  return children.filter(
    (child): child is Node | string => child !== null && child !== undefined && child !== false,
  );
}

/** Laddar ner en fil som skapats i webbläsaren (CSV, PNG, PDF). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/** Mobil eller dator? Avgör om Swish-appen öppnas direkt eller om vi visar QR-kod. */
export function isMobileDevice(): boolean {
  return (
    /Android|iPhone|iPad|iPod/iu.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/u.test(navigator.userAgent))
  );
}
