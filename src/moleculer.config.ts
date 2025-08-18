import { BrokerOptions, Errors } from "moleculer";

const brokerConfig: BrokerOptions = {
  logger: true,
  logLevel: "info",
  transporter: process.env.TRANSPORTER || "TCP",
  cacher: { type: "Memory", ttl: 60 },
  requestTimeout: 10_000,
  retryPolicy: {
    enabled: true, retries: 2, delay: 500, maxDelay: 2_000, factor: 2,
    check: (err) => err && err instanceof Errors.MoleculerRetryableError
  },
  circuitBreaker: {
    enabled: true, threshold: 0.5, minRequestCount: 20, halfOpenTime: 10_000
  },
  metrics: true,
  tracing: { enabled: true, exporter: { type: "Console" } }
};

export default brokerConfig;
