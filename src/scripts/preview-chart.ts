import { CoinmetricsService } from '../services/coinmetrics';
import { ChartService } from '../services/chart';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('Fetching MVRV data...');
  const coinmetrics = new CoinmetricsService();
  const chart = new ChartService();

  const [mvrv, mvrvHistory] = await Promise.all([
    coinmetrics.getBitcoinMVRV(),
    coinmetrics.getMVRVHistory()
  ]);

  console.log(`MVRV: ${mvrv.toFixed(2)}, History: ${mvrvHistory.values.length} points`);

  console.log('Generating chart...');
  const chartImage = await chart.generateMVRVChart(mvrvHistory, mvrv);

  const outPath = join(process.cwd(), 'test-chart.png');
  writeFileSync(outPath, chartImage);
  console.log(`Chart saved to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
