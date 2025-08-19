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
            process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []
          ),
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          credentials: true
        },
        routes: [
          {
            path: "/api",
            bodyParsers: { json: true, urlencoded: { extended: true } },

            onBeforeCall: (
              ctx: Context<any, ApiMeta>,
              _route: any,
              req: IncomingMessage,
              _res: ServerResponse
            ) => {
              // evitar warning de no usado si tienes noUnusedParameters
              void _route; void _res;

              const headers = (req.headers || {}) as Record<string, string>;
              const userId =
                headers["x-user-id"] ||
                (req.socket && req.socket.remoteAddress) ||
                "anonymous";

              ctx.meta.userId = userId;
            },

            aliases: {
              "GET books/search": "books.search",
              "GET books/library/front-cover/:cover_i": "covers.stream",
              "GET books/last-search": "searches.last",
              "POST books/my-library": "library.addWithCover",
              "GET books/my-library": "library.list",
              "GET books/my-library/:id": "library.getById",
              "PUT books/my-library/:id": "library.updateReview",
              "DELETE books/my-library/:id": "library.removeById"
            },
            mappingPolicy: "restrict"
          }
        ]
      }
    });
  }
}
