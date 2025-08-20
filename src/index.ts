import "dotenv/config";
import { ServiceBroker } from "moleculer";
import brokerConfig from "./moleculer.config";

import GatewayService from "./services/gateway.service";
import BooksService from "./services/books.service";
import LibraryService from "./services/library.service";
import CoversService from "./services/covers.service";

async function main() {
  const broker = new ServiceBroker(brokerConfig);

  broker.createService(GatewayService);
  broker.createService(BooksService);
  broker.createService(LibraryService);
  broker.createService(CoversService);

  await broker.start();
}

main().catch((err) => {
  console.error("Broker failed to start:", err);
  process.exit(1);
});
