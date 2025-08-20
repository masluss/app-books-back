import { Service, ServiceBroker, Context } from "moleculer";
import { MongoClient, ObjectId } from "mongodb";
import axios from "axios";
export default class CoversService extends Service {
	private client!: MongoClient;

	constructor(broker: ServiceBroker) {
		super(broker);

		this.parseServiceSchema({
			name: "covers",

			actions: {
				stream: {
					params: { cover_i: { type: "string", min: 1 } },
					handler: this.streamHandler,
				},
			},

			async started() {
				const uri =
					process.env.MONGO_URI ||
					"mongodb://localhost:27017/moleculer_books";
				this.client = new MongoClient(uri, {});
				await this.client.connect();
				this.logger.info("COVERS connected to Mongo");
			},

			async stopped() {
				if (this.client) await this.client.close();
			},
		});
	}

	private async streamHandler(ctx: Context<{ cover_i: string }>) {

		const dbName =
			process.env.MONGO_DB ||
			(() => {
				try {
					const u = new URL(process.env.MONGO_URI || "");
					return u.pathname.replace("/", "") || "moleculer_books";
				} catch {
					return "moleculer_books";
				}
			})();

		const db = this.client.db(dbName);
		const col = db.collection("books");

		  const coverId = Number(ctx.params.cover_i);
		if (!Number.isFinite(coverId)) {
			throw new this.broker.Errors.MoleculerClientError(
				"Invalid cover id",
				400,
			);
		}

		const doc = await col.findOne<{
			coverBase64?: string;
			coverContentType?: string;
		}>({ cover_i: coverId });

		if (doc?.coverBase64) {
			const contentType = doc.coverContentType || "image/jpeg";
			const buffer = Buffer.from(doc.coverBase64, "base64");

			(ctx.meta as any).$responseType = contentType;
			(ctx.meta as any).$responseHeaders = {
				"Content-Length": String(buffer.length),
				"Cache-Control": "public, max-age=31536000, immutable",
			};

			return buffer;
		}
		const url = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
		try {
			const { data, headers } = await axios.get<ArrayBuffer>(url, {
				responseType: "arraybuffer",
				timeout: 7000,
			});
			const buffer = Buffer.from(data);

			(ctx.meta as any).$responseType =
				(headers["content-type"] as string) || "image/jpeg";
			(ctx.meta as any).$responseHeaders = {
				"Content-Length": String(buffer.length),
				"Cache-Control": "public, max-age=120",
			};

			return buffer;
		} catch {
			throw new this.broker.Errors.MoleculerClientError(
				"Cover not available",
				404,
			);
		}
	}
}
