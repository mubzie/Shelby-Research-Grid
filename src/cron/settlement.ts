import cron from 'node-cron';
import AptosClient from '../services/AptosClient';
import pool from '../services/db';

/**
 * Daily settlement of accumulated read payments for each dataset.
 * Calls shelby_research::payment::settle_dataset_payments on-chain (best-effort).
 */
export async function settlePendingPayments(): Promise<{ settled: number; skipped: number }> {
  if (!process.env.DATABASE_URL) {
    console.warn('[cron] No DATABASE_URL; skipping payment settlement');
    return { settled: 0, skipped: 0 };
  }
  let settled = 0;
  let skipped = 0;
  try {
    const r = await pool.query(
      `SELECT id, uploader_addr, total_revenue_earned_millAPT FROM datasets
       WHERE total_revenue_earned_millAPT > 0`
    );
    for (const row of r.rows) {
      try {
        const totalMillAPT = Number(row.total_revenue_earned_millAPT || 0);
        const res = await AptosClient.settlePayments(row.uploader_addr, String(row.id), totalMillAPT);
        if (res.txHash && !res.txHash.startsWith('stub-')) {
          settled += 1;
        } else {
          skipped += 1;
        }
      } catch (e: any) {
        skipped += 1;
        console.warn('[cron] settlement failed for dataset', row.id, e?.message || e);
      }
    }
  } catch (e: any) {
    console.warn('[cron] settlement query failed', e?.message || e);
  }
  console.log(`[cron] settlement run: ${settled} settled, ${skipped} skipped`);
  return { settled, skipped };
}

export function startSettlementCron(expression = '0 2 * * *'): void {
  // Run every day at 02:00 server time
  cron.schedule(expression, () => {
    void settlePendingPayments();
  });
  console.log(`[cron] payment settlement scheduled (${expression})`);
}
