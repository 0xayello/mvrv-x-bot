import { CoinGeckoService } from '../services/coingecko';
import { CoinmetricsService } from '../services/coinmetrics';
import { TwitterService } from '../services/twitter';
import { ChartService } from '../services/chart';
import { Logger } from '../utils/logger';
import { writeFileSync } from 'fs';
import { join } from 'path';

function getMVRVClassification(mvrv: number): string {
  if (mvrv >= 3.5) return "alarmante";
  if (mvrv >= 3.0) return "alto";
  if (mvrv >= 1.0) return "neutro";
  return "zona de compra";
}

async function test() {
  try {
    Logger.info('Starting test...');

    // Test CoinGecko and Coinmetrics
    const coinGecko = new CoinGeckoService();
    const coinmetrics = new CoinmetricsService();
    const chart = new ChartService();
    
    // Get all data
    Logger.info('Fetching data...');
    const [dominance, mvrv, mvrvHistory] = await Promise.all([
      coinGecko.getBitcoinDominance(),
      coinmetrics.getBitcoinMVRV(),
      coinmetrics.getMVRVHistory()
    ]);
    
    if (typeof dominance !== 'number' || isNaN(dominance)) {
      throw new Error('Invalid dominance value received');
    }
    
    if (typeof mvrv !== 'number' || isNaN(mvrv)) {
      throw new Error('Invalid MVRV value received');
    }
    
    Logger.info('Data fetch successful', { 
      dominance, 
      mvrv,
      historyPoints: mvrvHistory.values.length 
    });

    // Generate and save chart
    Logger.info('Generating chart...');
    const chartImage = await chart.generateMVRVChart(mvrvHistory);
    
    // Save chart locally for inspection
    const testImagePath = join(process.cwd(), 'test-chart.png');
    writeFileSync(testImagePath, chartImage);
    Logger.info('Chart saved locally for inspection', { path: testImagePath });

    // Test Twitter
    Logger.info('Initializing Twitter service...');
    const twitter = new TwitterService();
    
    const mvrvClassification = getMVRVClassification(mvrv);
    const message = [
      `📊 O MVRV (Market Value to Realized Value) está em ${mvrv.toFixed(2)} – ${mvrvClassification}.`,
      'Ele indica o lucro médio não realizado dos holders de Bitcoin.',
      'Historicamente, < 1.0 sinaliza boas compras e > 3.0 zonas de venda.'
    ].join('\n\n');
    
    Logger.info('Attempting to post tweet with chart...', { message });
    
    await twitter.postTweetWithMedia(message, chartImage);
    Logger.info('Twitter test successful');

  } catch (error) {
    Logger.error('Test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    // Exit with error code
    process.exit(1);
  }
}

test(); 