import { Service, ServiceBroker, Context } from "moleculer";
import DbService from "moleculer-db";
import MongoAdapter from "moleculer-db-adapter-mongo";
import axios from "axios";

export default class LibraryService extends Service {
	constructor(broker: ServiceBroker) {
		super(broker);

		this.parseServiceSchema({
			name: "library",
			mixins: [DbService],

			adapter: new MongoAdapter(
				process.env.MONGO_URI ||
					"mongodb://localhost:27017/moleculer_books",
				{ useNewUrlParser: true, useUnifiedTopology: true },
			),
			collection: "books",

			settings: {
				fields: [
					"_id",
					"userId",
					"openLibraryKey",
					"title",
					"authors",
					"firstPublishYear",
					"cover_i",
					"coverBase64",
					"coverContentType",
					"review",
					"rating",
					"createdAt",
					"updatedAt",
				],
				entityValidator: {
					userId: { type: "string", optional: true },
					openLibraryKey: "string",
					title: "string",
					authors: { type: "array", optional: true, items: "string" },
					firstPublishYear: { type: "number", optional: true },
					cover_i: { type: "number", optional: true },
					coverBase64: { type: "string", optional: true },
					coverContentType: { type: "string", optional: true },
					review: { type: "string", optional: true, max: 2000 },
					rating: { type: "number", optional: true, min: 0, max: 5 },
				},
			},

			actions: {
				bulkLookup: {
					params: {
						keys: { type: "array", min: 1, items: "string" },
					},
					handler: this.bulkLookupHandler,
				},

				// opcional: lo dejo por compatibilidad
				add: {
					params: {
						openLibraryKey: "string",
						title: "string",
						authors: {
							type: "array",
							optional: true,
							items: "string",
						},
						firstPublishYear: { type: "number", optional: true },
					},
					handler: this.addHandler,
				},

				// ✅ Acción principal: guarda el libro y si no mandan coverBase64, la descarga desde OpenLibrary
				addWithCover: {
					params: {
						openLibraryKey: "string",
						title: "string",
						authors: {
							type: "array",
							optional: true,
							items: "string",
						},
						firstPublishYear: { type: "number", optional: true },
						cover_i: {
							type: "number",
							optional: true,
							convert: true,
						},
						coverBase64: { type: "string", optional: true },
						coverContentType: { type: "string", optional: true },
						cover_edition_key: { type: "string", optional: true },
						review: { type: "string", optional: true, max: 2000 },
						rating: {
							type: "number",
							optional: true,
							min: 0,
							max: 5,
						},
					},
					async handler(ctx) {
						let coverBase64 = ctx.params.coverBase64;
						let coverContentType =
							ctx.params.coverContentType || "image/jpeg";

						if (!coverBase64) {
							const url =
								ctx.params.coverUrl ||
								(await this.resolveCoverUrl(
									ctx.params.openLibraryKey,
									ctx.params.cover_i,
									ctx.params.cover_edition_key,
								));
							if (url) {
								try {
									const { data } =
										await axios.get<ArrayBuffer>(url, {
											responseType: "arraybuffer",
											timeout: 7000,
										});
									coverBase64 =
										Buffer.from(data).toString("base64");
									coverContentType = url.endsWith(".png")
										? "image/png"
										: "image/jpeg";
								} catch (e) {
									this.logger.warn(
										"No se pudo descargar la portada desde OpenLibrary",
										{ url, error: (e as Error).message },
									);
								}
							}
						}

						const userId =
							(ctx.meta?.userId as string) || "anonymous";
						const col = (this.adapter as any).collection;
						const now = new Date();
						const doc: any = {
							userId,
							openLibraryKey: ctx.params.openLibraryKey,
							title: ctx.params.title,
							authors: ctx.params.authors || [],
							firstPublishYear: ctx.params.firstPublishYear,
							cover_i: ctx.params.cover_i ?? undefined,
							review: ctx.params.review,
							rating: ctx.params.rating,
							updatedAt: now,
						};

						if (coverBase64) {
							doc.coverBase64 = coverBase64;
							doc.coverContentType = coverContentType;
						}

						const res = await col.findOneAndUpdate(
							{ userId, openLibraryKey: doc.openLibraryKey },
							{
								$setOnInsert: { createdAt: now },
								$set: doc,
								$unset: { cover: "" },
							},
							{ upsert: true, returnOriginal: false },
						);
						await this.entityChanged("upsert", res.value, ctx);
						return res.value;
					},
				},

				getById: {
					params: { id: "string" },
					async handler(ctx) {
						const userId =
							(ctx.meta?.userId as string) || "anonymous";
						const { ObjectId } = await import("mongodb");
						const col = (this.adapter as any).collection;
						const doc = await col.findOne({
							_id: new ObjectId(ctx.params.id),
							userId,
						});

						if (!doc)
							throw new this.broker.Errors.MoleculerClientError(
								"Not found",
								404,
							);
						return doc;
					},
				},

				updateReview: {
					params: {
						id: "string",
						review: { type: "string", optional: true, max: 2000 },
						rating: {
							type: "number",
							optional: true,
							min: 0,
							max: 5,
						},
					},
					async handler(ctx) {
						const userId =
							(ctx.meta?.userId as string) || "anonymous";
						const { ObjectId } = await import("mongodb");
						const col = (this.adapter as any).collection;
						const $set: any = { updatedAt: new Date() };
						if (ctx.params.review !== undefined)
							$set.review = ctx.params.review;
						if (ctx.params.rating !== undefined)
							$set.rating = ctx.params.rating;

						const res = await col.findOneAndUpdate(
							{userId, _id: new ObjectId(ctx.params.id) },
							{ $set },
							{ returnDocument: "after" },
						);
						if (!res.value)
							throw new this.broker.Errors.MoleculerClientError(
								"Not found",
								404,
							);
						await this.entityChanged("updated", res.value, ctx);
						return res.value;
					},
				},

				removeById: {
					params: { id: "string" },
					async handler(ctx) {
						const { ObjectId } = await import("mongodb");
						const col = (this.adapter as any).collection;
						const res = await col.findOneAndDelete({
							_id: new ObjectId(ctx.params.id),
						});
						if (!res.value)
							throw new this.broker.Errors.MoleculerClientError(
								"Not found",
								404,
							);
						await this.entityChanged("removed", res.value, ctx);
						return { ok: true };
					},
				},

				list: {
					cache: {
						keys: ["title", "author", "hasReview", "page", "limit"],
					},
					params: {
						title: { type: "string", optional: true, trim: true },
						author: { type: "string", optional: true, trim: true },
						hasReview: { type: "boolean", optional: true },
						page: {
							type: "number",
							optional: true,
							convert: true,
							min: 1,
							default: 1,
						},
						limit: {
							type: "number",
							optional: true,
							convert: true,
							min: 1,
							max: 100,
							default: 20,
						},
					},
					async handler(ctx) {
						const userId =
							(ctx.meta?.userId as string) || "anonymous";
						const { title, author, hasReview, page, limit } =
							ctx.params as any;
						const col = (this.adapter as any).collection;
						const query: any = { userId };

						if (title)
							query.title = { $regex: new RegExp(title, "i") };
						if (author)
							query.authors = {
								$elemMatch: { $regex: new RegExp(author, "i") },
							};

						if (hasReview === true) {
							query.review = { $exists: true, $ne: "" };
						} else if (hasReview === false) {
							query.$or = [
								{ review: { $exists: false } },
								{ review: null },
								{ review: "" },
							];
						}

						const skip = (page - 1) * limit;
						const [items, total] = await Promise.all([
							col
								.find(query)
								.sort({ updatedAt: -1 })
								.skip(skip)
								.limit(limit)
								.toArray(),
							col.countDocuments(query),
						]);
						return { page, limit, total, items };
					},
				},
			},

			methods: {
				async afterConnected(this: any) {
					await this.adapter.collection.createIndex(
						{ userId: 1, openLibraryKey: 1 },
						{ unique: true },
					);
					await this.adapter.collection.createIndex({
						userId: 1,
						updatedAt: -1,
					});
					await this.adapter.collection.createIndex({
						userId: 1,
						title: 1,
					});
					await this.adapter.collection.createIndex({
						userId: 1,
						authors: 1,
					});
				},

				// Resuelve la URL de la portada usando los datos disponibles
				async resolveCoverUrl(
					this: any,
					openLibraryKey?: string,
					cover_i?: number,
					cover_edition_key?: string,
				): Promise<string | undefined> {
					// Prioridad 1: cover_i directo
					if (typeof cover_i === "number") {
						return `https://covers.openlibrary.org/b/id/${cover_i}-L.jpg`;
					}
					// Prioridad 2: cover_edition_key (OLID)
					if (cover_edition_key) {
						return `https://covers.openlibrary.org/b/olid/${cover_edition_key}-L.jpg`;
					}
					// Prioridad 3: consultar el work para sacar "covers"
					if (openLibraryKey) {
						try {
							const workUrl = `https://openlibrary.org${openLibraryKey}.json`;
							const { data } = await axios.get(workUrl, {
								timeout: 5000,
							});
							const id =
								Array.isArray(data?.covers) &&
								data.covers.length
									? data.covers[0]
									: undefined;
							if (typeof id === "number") {
								return `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
							}
						} catch (e) {
							this.logger.warn(
								"No se pudo resolver portada desde work",
								{
									openLibraryKey,
									error: (e as Error).message,
								},
							);
						}
					}
					return undefined;
				},
			},
		});
	}

	private async bulkLookupHandler(ctx: Context<{ keys: string[] }>) {
		const userId = (ctx.meta as any).userId || "anonymous";
		const col = (this.adapter as any).collection;
		const docs = await col
			.find({ openLibraryKey: { $in: ctx.params.keys } })
			.toArray();

		const map: Record<string, { exists: boolean }> = {};
		ctx.params.keys.forEach((k) => (map[k] = { exists: false }));

		for (const d of docs as any[]) {
			map[d.openLibraryKey] = { exists: true };
		}
		return map;
	}

	private async addHandler(
		ctx: Context<{
			openLibraryKey: string;
			title: string;
			authors?: string[];
			firstPublishYear?: number;
		}>,
	) {
		const entity: any = {
			openLibraryKey: ctx.params.openLibraryKey,
			title: ctx.params.title,
			authors: ctx.params.authors || [],
			firstPublishYear: ctx.params.firstPublishYear,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const col = (this.adapter as any).collection;
		const res = await col.findOneAndUpdate(
			{ openLibraryKey: entity.openLibraryKey },
			{ $set: entity },
			{ upsert: true, returnOriginal: false },
		);
		return res.value;
	}
}
