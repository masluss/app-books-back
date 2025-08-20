import { Service, ServiceBroker, Context } from "moleculer";
import ApiGateway from "moleculer-web";
import { IncomingMessage, ServerResponse } from "http";

type ApiMeta = { userId?: string };

export default class GatewayService extends Service {
	constructor(broker: ServiceBroker) {
		super(broker);

		this.parseServiceSchema({
			name: "API",
			mixins: [ApiGateway],
			settings: {
				port: process.env.PORT ? Number(process.env.PORT) : 3001,
				cors: {
					origin: ["http://localhost:3000"].concat(
						process.env.CORS_ORIGIN
							? [process.env.CORS_ORIGIN]
							: [],
					),
					methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
					credentials: true,
				},
				routes: [
					{
						path: "/api",
						bodyParsers: {
							json: true,
							urlencoded: { extended: true },
						},

						onBeforeCall: (
							ctx: Context<any, ApiMeta>,
							_route: any,
							req: IncomingMessage,
							_res: ServerResponse,
						) => {
							void _route;
							void _res;

							const headers = (req.headers || {}) as Record<
								string,
								string
							>;
							const userId =
								headers["userid"] ||
								headers["x-user-id"] ||
								(req.socket && req.socket.remoteAddress) ||
								"anonymous";

							ctx.meta.userId = userId;
						},
						onAfterCall: (
							_ctx: Context<any, ApiMeta>,
							_route: any,
							req: any,
							res: ServerResponse,
							data: any,
						) => {
							const alias = req.$alias?.name as
								| string
								| undefined;
							const action = req.$action?.name as
								| string
								| undefined;

							const is = (a?: string, n?: string) =>
								a && alias?.toLowerCase() === n?.toLowerCase();
							if (
								is(alias, "GET books/search") ||
								action === "books.search"
							) {
								res.setHeader(
									"Cache-Control",
									"public, max-age=600, stale-while-revalidate=60",
								);
								res.setHeader(
									"Vary",
									"Accept, Accept-Encoding",
								);
							}

							if (
								is(
									alias,
									"GET books/library/front-cover/:cover_i",
								) ||
								action === "covers.stream"
							) {
								res.setHeader(
									"Cache-Control",
									"public, max-age=86400, immutable",
								);
								res.setHeader(
									"Vary",
									"Accept, Accept-Encoding",
								);
							}
							const privateAliases = new Set([
								"GET books/last-search",
								"POST books/my-library",
								"GET books/my-library",
								"GET books/my-library/:id",
								"PUT books/my-library/:id",
								"DELETE books/my-library/:id",
							]);

							if (alias && privateAliases.has(alias)) {
								res.setHeader(
									"Cache-Control",
									"private, no-store",
								);
								res.setHeader(
									"Vary",
									"userid, Accept, Accept-Encoding",
								);
							}

							return data;
						},
						aliases: {
							"GET books/search": "books.search",
							"GET books/library/front-cover/:cover_i":
								"covers.stream",
							"GET books/last-search": "searches.last",
							"POST books/my-library": "library.addWithCover",
							"GET books/my-library": "library.list",
							"GET books/my-library/:id": "library.getById",
							"PUT books/my-library/:id": "library.updateReview",
							"DELETE books/my-library/:id": "library.removeById",
						},
						mappingPolicy: "restrict",
					},
				],
			},
		});
	}
}
