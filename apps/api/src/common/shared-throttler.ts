import { createHmac } from 'node:crypto';
import { ThrottlerStorage } from '@nestjs/throttler';
import { DatabaseService } from '../database/database.service';
import { AppConfig } from '../config/config';

/** Atomic shared windows. Only HMAC keys and counters are stored, never raw IPs. */
export class SharedThrottlerStorage implements ThrottlerStorage {
  private cleanupAt = 0;
  constructor(private readonly db: DatabaseService, private readonly config: AppConfig) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, _name: string) {
    const hashed = createHmac('sha256', this.config.abuseHashKey).update(`http-rate-v1:${key}`).digest('hex');
    return this.db.transaction(async client => {
      if (Date.now() >= this.cleanupAt) {
        // A failed transaction must permit another attempt; no timer or external I/O.
        await client.query(`DELETE FROM sorteos.http_rate_limits WHERE key IN (
          SELECT key FROM sorteos.http_rate_limits WHERE expires_at<now()-interval '1 hour'
          AND blocked_until<now() ORDER BY expires_at LIMIT 1000)`);
      }
      const result = await client.query<{hits:number;expire:number;blocked:number}>(`
        INSERT INTO sorteos.http_rate_limits(key,hits,expires_at,blocked_until)
        VALUES($1,1,statement_timestamp()+$2*interval '1 millisecond','epoch')
        ON CONFLICT(key) DO UPDATE SET
          hits=CASE WHEN http_rate_limits.expires_at<=statement_timestamp() AND http_rate_limits.blocked_until<=statement_timestamp()
            THEN 1 ELSE least(http_rate_limits.hits+1,$3+1) END,
          expires_at=CASE WHEN http_rate_limits.expires_at<=statement_timestamp() AND http_rate_limits.blocked_until<=statement_timestamp()
            THEN statement_timestamp()+$2*interval '1 millisecond' ELSE http_rate_limits.expires_at END,
          blocked_until=CASE
            WHEN http_rate_limits.expires_at<=statement_timestamp() AND http_rate_limits.blocked_until<=statement_timestamp() THEN 'epoch'::timestamptz
            WHEN http_rate_limits.hits>=$3 AND http_rate_limits.blocked_until<=statement_timestamp() THEN statement_timestamp()+$4*interval '1 millisecond'
            ELSE http_rate_limits.blocked_until END
        RETURNING hits,
          greatest(0,ceil(extract(epoch FROM expires_at-statement_timestamp())))::int AS expire,
          greatest(0,ceil(extract(epoch FROM blocked_until-statement_timestamp())))::int AS blocked`,
      [hashed,ttl,limit,blockDuration]);
      const row = result.rows[0]!;
      // Retry cleanup after at most one minute; a rollback only delays disposable-counter cleanup.
      this.cleanupAt = Date.now()+60000;
      return { totalHits:row.hits,timeToExpire:row.expire,isBlocked:row.blocked>0,timeToBlockExpire:row.blocked };
    });
  }
}
