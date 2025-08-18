import { Service, ServiceBroker, Context } from "moleculer";
import axios from "axios";

type ApiMeta = { userId?: string };

export default class BooksService extends Service {
  constructor(broker: ServiceBroker) {
    super(broker);
    this.parseServiceSchema({
      name: "books",
      actions: {
        search: {
          params: { q: { type: "string", min: 2, trim: true } },
          cache: { ttl: 30 },
          handler: this.searchHandler
        }
      }
    });
  }

  private async searchHandler(ctx: Context<{ q: string }, ApiMeta>) {
    const q = ctx.params.q;
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}`;
    const { data } = await axios.get(url, { timeout: 5000 });

    const docs = Array.isArray(data?.docs) ? data.docs : [];

    // Normaliza key: OLxxxxxW -> /works/OLxxxxxW
    const normKey = (k: string) => {
      if (!k) return k;
      if (k.startsWith("/works/")) return k;
      if (/^OL\d+W$/.test(k)) return `/works/${k}`;
      return k;
    };

    const keys: string[] = docs.map((d: any) => normKey(d.key)).filter(Boolean);

    // Fallback si 'library' no está
    let map: Record<string, { exists: boolean; coverGridId?: string }> = {};
    if (keys.length) {
      try {
       const map = (await ctx.call(
			"library.bulkLookup",
			{ keys },
			{ timeout: 1500 }
			)) as Record<string, { exists: boolean; coverGridId?: string }>;

      } catch {
        map = {};
      }
    }

	const clean = <T extends Record<string, any>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

    const docsMapped = docs.map((d: any) => {
  const keyNorm = normKey(d.key);
  const inLib = keyNorm ? (map[keyNorm]?.exists || false) : false;
  const coverGridId = keyNorm ? map[keyNorm]?.coverGridId : undefined;

  let coverUrl: string | undefined;
  if (inLib && coverGridId)
    coverUrl = `/api/books/library/front-cover/${coverGridId}`;
  else if (typeof d.cover_i === "number")
    coverUrl = `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`;

  // ⚠️ Usamos los nombres de OpenLibrary (snake_case) y añadimos extras
  return clean({
    // Campos originales de OpenLibrary
    key: d.key,                               // ej: "/works/OL27448W"
    title: d.title,
    author_key: d.author_key || [],
    author_name: d.author_name || [],
    cover_edition_key: d.cover_edition_key,
    cover_i: d.cover_i,
    ebook_access: d.ebook_access,
    edition_count: d.edition_count,
    first_publish_year: d.first_publish_year,
    has_fulltext: d.has_fulltext,
    language: d.language,
    public_scan_b: d.public_scan_b,

    // Extras propios (no rompen compatibilidad)
    openLibraryKeyNormalized: keyNorm,
    coverUrl,
    inMyLibrary: inLib
  });
});

    // Registrar la búsqueda (no bloquear la respuesta si falla)
    try {
      await ctx.call("searches.record", { q }, { meta: { userId: ctx.meta.userId } });
    } catch {
      /* noop */
    }

    return clean({
  start: data?.start ?? 0,
  num_found: data?.num_found ?? docsMapped.length,     // OpenLibrary
  numFound: data?.numFound ?? data?.num_found,         // algunos clientes usan este
  numFoundExact: data?.numFoundExact,
  documentation_url: data?.documentation_url ?? "https://openlibrary.org/dev/docs/api/search",
  q,                                                   // eco de la query
  offset: data?.offset ?? null,
  docs: docsMapped
});
  }
}
