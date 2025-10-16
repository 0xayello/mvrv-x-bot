import { NextApiRequest, NextApiResponse } from 'next';
import { CoinGeckoService } from '../../services/coingecko';
import { CoinmetricsService } from '../../services/coinmetrics';
import { TwitterService } from '../../services/twitter';
import { Logger } from '../../utils/logger';
import { ChartService } from '../../services/chart';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Log all request headers to debug cron trigger
    Logger.info('Received request', {
      headers: req.headers,
      method: req.method,
      timestamp: new Date().toISOString(),
      isCron: req.headers['x-vercel-cron'] === '1'
    });

    // Verify request method
    if (req.method !== 'POST' && req.method !== 'GET') {
      Logger.warn('Invalid request method', { method: req.method });
      return res.status(405).json({ error: 'Method not allowed' });
    }

    Logger.info('Starting Bitcoin metrics update job', {
      timestamp: new Date().toISOString(),
      isAutomated: req.headers['x-vercel-cron'] === '1'
    });

    const coinGecko = new CoinGeckoService();
    const coinmetrics = new CoinmetricsService();
    const twitter = new TwitterService();
    const chart = new ChartService();

    // Get metrics and historical data
    const [bitcoinDominance, bitcoinMVRV, mvrvHistory] = await Promise.all([
      coinGecko.getBitcoinDominance(),
      coinmetrics.getBitcoinMVRV(),
      coinmetrics.getMVRVHistory()
    ]);

    // Generate chart
    const chartImage = await chart.generateMVRVChart(mvrvHistory);

    // Format message (updated caption template)
    const mvrvClassification = getMVRVClassification(bitcoinMVRV);
    const message = [
      `📊 O MVRV (Market Value to Realized Value) atual é ${bitcoinMVRV.toFixed(2)} - ${mvrvClassification}.`,
      'Ele mostra quanto lucro não realizado os holders de Bitcoin têm.',
      'Historicamente, <1.0 é a melhor região de compra e >3.0 de venda.'
    ].join('\n');

    // Post tweet with media
    await twitter.postTweetWithMedia(message, chartImage);

    Logger.info('Successfully completed Bitcoin metrics update');
    res.status(200).json({ 
      success: true, 
      bitcoinDominance,
      bitcoinMVRV,
      message 
    });
  } catch (error) {
    Logger.error('Failed to process Bitcoin metrics update', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function getMVRVClassification(mvrv: number): string {
  if (mvrv >= 3.5) return "alarmante";
  if (mvrv >= 3.0) return "alto";
  if (mvrv >= 1.0) return "neutro";
  return "zona de compra";
} 