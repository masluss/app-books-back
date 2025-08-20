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
					handler: this.searchHandler,
				},
			},
		});
	}

	private async searchHandler(ctx: Context<{ q: string }, ApiMeta>) {
		const q = ctx.params.q;
		const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}`;
		const { data } = await axios.get(url, { timeout: 12000 });

		const docs = Array.isArray(data?.docs) ? data.docs.slice(0, 10) : [];

		const normKey = (k: string) => {
			if (!k) return k;
			if (k.startsWith("/works/")) return k;
			if (/^OL\d+W$/.test(k)) return `/works/${k}`;
			return k;
		};

		const keys: string[] = docs
			.map((d: any) => normKey(d.key))
			.filter(Boolean);

		let map: Record<string, { exists: boolean; cover_i?: number }> = {};
		if (keys.length) {
			try {
				map = (await ctx.call(
					"library.bulkLookup",
					{ keys },
					{ meta: { userId: ctx.meta.userId }, timeout: 1500 },
				)) as Record<string, { exists: boolean; cover_i?: number }>;
			} catch {
				map = {};
			}
		}

		const clean = <T extends Record<string, any>>(o: T): T =>
			Object.fromEntries(
				Object.entries(o).filter(([, v]) => v !== undefined),
			) as T;

		const docsMapped = docs.map((d: any) => {
			const keyNorm = normKey(d.key);
			const found = keyNorm ? map[keyNorm] : undefined;
			const inLib = !!found?.exists;

			let coverUrl: string | undefined;
			const coverId = (inLib ? found?.cover_i : d.cover_i) as
				| number
				| undefined;
			if (typeof coverId === "number") {
				coverUrl = inLib
					? `/api/books/library/front-cover/${coverId}`
					: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
			}

			return clean({
				key: d.key,
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
				openLibraryKeyNormalized: keyNorm,
				coverUrl,
				inMyLibrary: inLib,
			});
		});

		try {
			await ctx.call(
				"searches.record",
				{ q },
				{ meta: { userId: ctx.meta.userId } },
			);
		} catch {}

		return clean({
			start: data?.start ?? 0,
			num_found: data?.num_found ?? docsMapped.length,
			numFound: data?.numFound ?? data?.num_found,
			numFoundExact: data?.numFoundExact,
			documentation_url:
				data?.documentation_url ??
				"https://openlibrary.org/dev/docs/api/search",
			q,
			offset: data?.offset ?? null,
			docs: docsMapped,
		});
	}
}
