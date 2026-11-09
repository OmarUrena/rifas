// Vercel detects NestJS from a direct import in the server entrypoint.
import '@nestjs/core';
import { createApp } from './bootstrap';
import { loadConfig } from './config/load-config';
import { startupFailure } from './common/startup-error';

let startupPort: number | undefined;

async function main(): Promise<void> {
  const config = loadConfig();
  startupPort = config.port;
  const app = await createApp(config);
  try {
    await app.listen(config.port, config.host);
  } catch (error) {
    // Release pools, sweep timers and shutdown hooks when listen fails.
    await app.close().catch(() => undefined);
    throw error;
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify(startupFailure(error, startupPort))}\n`);
  process.exitCode = 1;
});
