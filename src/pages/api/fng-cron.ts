import { NextApiRequest, NextApiResponse } from 'next';
import { FearGreedService, FngClass } from '../../services/feargreed';
import { FngChartService } from '../../services/fng-chart';
import { TwitterService } from '../../services/twitter';
import { Logger } from '../../utils/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    Logger.info('FNG cron triggered', {
      method: req.method,
      isCron: req.headers['x-vercel-cron'] === '1',
      timestamp: new Date().toISOString(),
    });

    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const fng = new FearGreedService();
    const forcePost = req.query.force === '1';

    // 1. Check if we should post (classification change + max 1/week)
    const recent = await fng.getRecent(8);
    const decision = fng.shouldPost(recent);

    Logger.info('FNG post decision', {
      value: decision.value,
      class: decision.todayClass,
      shouldPost: decision.post,
      reason: decision.reason,
      forcePost,
    });

    if (!decision.post && !forcePost) {
      return res.status(200).json({
        success: true,
        posted: false,
        value: decision.value,
        class: decision.todayClass,
        reason: decision.reason,
      });
    }

    // 2. Generate chart
    const chartService = new FngChartService();
    const history = await fng.getHistory();
    const chartImage = await chartService.generateChart(history, decision.value);

    // 3. Generate tweet text
    const message = generateFngTweet(decision.value, decision.todayClass);

    // 4. Post tweet with chart
    const twitter = new TwitterService();
    await twitter.postTweetWithMedia(message, chartImage);

    Logger.info('FNG tweet posted successfully', { value: decision.value, class: decision.todayClass });

    return res.status(200).json({
      success: true,
      posted: true,
      value: decision.value,
      class: decision.todayClass,
      message,
    });
  } catch (error) {
    Logger.error('FNG cron failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function generateFngTweet(value: number, fngClass: FngClass): string {
  let lines: string[];

  switch (fngClass) {
    case 'extreme_fear':
      lines = [
        `📊 Fear & Greed em ${value} — Medo Extremo!`,
        'Historicamente, momentos assim se provaram grandes zonas de acumulação do Bitcoin.',
        'Quando todos têm medo, poucos aproveitam. 👀',
      ];
      break;

    case 'fear':
      lines = [
        `📊 Fear & Greed em ${value} — Medo.`,
        'Historicamente, momentos assim costumam ser boas janelas de acumulação.',
      ];
      break;

    case 'greed':
      lines = [
        `📊 Fear & Greed em ${value} — Ganância.`,
        'Historicamente, quando o sentimento atinge esses níveis, correções costumam estar próximas.',
      ];
      break;

    case 'extreme_greed':
      lines = [
        `📊 Fear & Greed em ${value} — Ganância Extrema! ⚠️`,
        'Euforia no mercado. Historicamente, níveis assim antecederam correções significativas.',
        'Cautela. Quando todos estão gananciosos, o risco aumenta.',
      ];
      break;

    default:
      // Neutral — should never reach here due to shouldPost() filtering
      lines = [`📊 Fear & Greed em ${value} — Neutro.`];
      break;
  }

  return lines.join('\n\n');
}
