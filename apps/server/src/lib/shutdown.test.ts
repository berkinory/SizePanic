import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function waitForFile(path: string) {
  const deadline = Date.now() + 5000;
  while (!(await Bun.file(path).exists())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${path}`);
    await Bun.sleep(10);
  }
}

for (const activeRequest of [false, true]) {
  test(`shutdown drains requests: ${activeRequest}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "shutdown-test-"));
    const modulePath = new URL("./shutdown.ts", import.meta.url).pathname;
    const code = `
      import { registerShutdown } from ${JSON.stringify(modulePath)};
      const dir = ${JSON.stringify(dir)};
      const server = Bun.serve({ port: 0, async fetch() {
        await Bun.write(dir + '/started', 'yes');
        await Bun.sleep(200);
        await Bun.write(dir + '/committed', 'yes');
        return new Response('complete');
      }});
      registerShutdown(server, async () => {
        await Bun.write(dir + '/closed', 'yes');
      });
      await Bun.write(dir + '/port', String(server.port));
    `;
    const child = Bun.spawn([process.execPath, "-e", code], {
      stdout: "pipe",
      stderr: "pipe",
    });
    try {
      await waitForFile(join(dir, "port"));
      let request: Promise<Response> | undefined;
      if (activeRequest) {
        const port = await readFile(join(dir, "port"), "utf8");
        request = fetch(`http://127.0.0.1:${port}/`);
        await waitForFile(join(dir, "started"));
      }
      child.kill("SIGTERM");
      if (activeRequest) {
        await Bun.sleep(20);
        child.kill("SIGTERM");
        expect(await (await request!).text()).toBe("complete");
        expect(await Bun.file(join(dir, "committed")).exists()).toBe(true);
      }
      expect(await child.exited).toBe(0);
      expect(await Bun.file(join(dir, "closed")).exists()).toBe(true);
    } finally {
      child.kill();
      await child.exited;
      await rm(dir, { recursive: true, force: true });
    }
  }, 10_000);
}
