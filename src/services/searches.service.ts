import { Service, ServiceBroker, Context } from "moleculer";
import DbService from "moleculer-db";
import MongoAdapter from "moleculer-db-adapter-mongo";

type ApiMeta = { userId?: string };

export default class SearchesService extends Service {
  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: "searches",
      mixins: [DbService],

      adapter: new MongoAdapter(
        process.env.MONGO_URI || "mongodb://localhost:27017/moleculer_books",
        { useNewUrlParser: true, useUnifiedTopology: true }
      ),
      collection: "searches",

      settings: {
        fields: ["_id", "userId", "q", "createdAt"],
        entityValidator: {
          userId: { type: "string", optional: true },
          q: { type: "string", min: 1, trim: true },
          createdAt: { type: "date", optional: true }
        }
      },

      actions: {
        record: {
          params: { q: { type: "string", min: 1, trim: true } },
          async handler(ctx: Context<{ q: string }, ApiMeta>) {
            const userId = ctx.meta.userId || "anonymous";
            const col = (this.adapter as any).collection;
            await col.insertOne({ userId, q: ctx.params.q, createdAt: new Date() });
            return true;
          }
        },

        last: {
          async handler(ctx: Context<unknown, ApiMeta>) {
            const userId = ctx.meta.userId || "anonymous";
            const col = (this.adapter as any).collection;
            const items = await col
              .find({ userId })
              .sort({ createdAt: -1 })
              .limit(5)
              .toArray();

            return items.map((d: any) => ({ q: d.q, at: d.createdAt }));
          }
        }
      },

      methods: {
        async afterConnected(this: any) {
          await this.adapter.collection.createIndex({ userId: 1, createdAt: -1 });
        }
      }
    });
  }
}
