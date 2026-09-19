type Server = { stop(closeActiveConnections?: boolean): Promise<unknown> };

export function registerShutdown(server: Server, close: () => Promise<void>) {
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try {
      // Stop accepting connections, then finish in-flight requests before closing storage.
      await server.stop(false);
      await close();
      process.exit(0);
    } catch (error) {
      console.error("Graceful shutdown failed", error);
      process.exit(1);
    }
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
