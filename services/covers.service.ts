import { Service, ServiceBroker, Context } from "moleculer";
import { MongoClient, ObjectId } from "mongodb";

export default class CoversService extends Service {
  private client!: MongoClient;

  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: "covers",

      actions: {
        /**
         * GET /api/books/library/front-cover/:id
         * :id = _id del libro en MongoDB (colección "books")
         * Responde la imagen desde coverBase64 / coverContentType guardados en el documento.
         */
        stream: {
          params: { id: { type: "string", min: 12 } },
          handler: this.streamHandler
        }
      },

      // Conexión a Mongo para leer desde la colección "books"
      async started() {
        const uri = process.env.MONGO_URI || "mongodb://localhost:27017/moleculer_books";
        this.client = new MongoClient(uri, { });
        await this.client.connect();
        this.logger.info("COVERS connected to Mongo");
      },

      async stopped() {
        if (this.client) await this.client.close();
      }
    });
  }

  private async streamHandler(ctx: Context<{ id: string }>) {
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

    const bookId = new ObjectId(ctx.params.id);
  const doc = await col.findOne({ _id: bookId });
  if (!doc) throw new this.broker.Errors.MoleculerClientError("Not found", 404);
  if (!doc.coverBase64) throw new this.broker.Errors.MoleculerClientError("Cover not available", 404);

  const contentType = doc.coverContentType || "image/jpeg";
  const buffer = Buffer.from(doc.coverBase64, "base64");

  (ctx.meta as any).$responseType = contentType;
  (ctx.meta as any).$responseHeaders = {
    "Content-Length": String(buffer.length),
    "Cache-Control": "public, max-age=31536000, immutable"
  };

  return buffer;
}
}
