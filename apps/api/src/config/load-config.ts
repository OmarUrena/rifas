import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { AppConfig, parseConfig } from './config';

export function loadConfig(): AppConfig {
  if (process.env.VERCEL !== '1') {
    loadDotenv({ path: [resolve(process.cwd(), '.env'), resolve(__dirname, '../../.env')], quiet: true });
  }
  return parseConfig(process.env);
}
