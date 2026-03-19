import { NextApiRequest, NextApiResponse } from 'next';
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

    const coinmetrics = new CoinmetricsService();
    const twitter = new TwitterService();
    const chart = new ChartService();

    // Get metrics and historical data
    const [bitcoinMVRV, mvrvHistory] = await Promise.all([
      coinmetrics.getBitcoinMVRV(),
      coinmetrics.getMVRVHistory()
    ]);

    // Generate chart
    const chartImage = await chart.generateMVRVChart(mvrvHistory, bitcoinMVRV);

    // Pegar MVRV de ~7 dias atras do historico para contexto de tendencia
    const prevIndex = Math.max(0, mvrvHistory.values.length - 8);
    const previousMVRV = mvrvHistory.values[prevIndex];

    const message = generateTweetText(bitcoinMVRV, previousMVRV);

    // Post tweet with media
    await twitter.postTweetWithMedia(message, chartImage);

    Logger.info('Successfully completed Bitcoin metrics update');
    res.status(200).json({
      success: true,
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

function generateTweetText(currentMVRV: number, previousMVRV?: number): string {
  const value = currentMVRV.toFixed(2);
  const pctRaw = (currentMVRV - 1) * 100;
  const pctAbs = Math.abs(pctRaw).toFixed(0);
  let lines: string[];

  // Variações aleatórias para zonas com mais de uma opção
  const pick = (...options: string[]) => options[Math.floor(Math.random() * options.length)];

  if (currentMVRV < 0.8) {
    // Compra forte
    lines = [
      `📊 MVRV em ${value} — zona de compra forte!`,
      `Estamos na melhor região de acumulação historicamente. Holders estão com um prejuízo médio não realizado de ${pctAbs}%. Valores nesse patamar marcaram os maiores fundos do Bitcoin. Oportunidade rara. 👀`
    ];
  } else if (currentMVRV < 1.0) {
    // Compra
    lines = [
      `📊 MVRV em ${value} — zona de compra! 👀`,
      `O Bitcoin está sendo negociado abaixo do custo médio dos holders. Historicamente, essa é uma das melhores janelas de acumulação.`,
      'Fique atento: historicamente, essa região costuma anteceder grandes movimentos de alta.'
    ];
  } else if (currentMVRV < 1.25) {
    // Próximo de compra
    lines = [
      `📊 MVRV em ${value} — região interessante para compra!`,
      'Estamos próximos da região onde o preço se aproxima do custo médio dos holders.',
      'Abaixo de 1.0 = zona de compra histórica. O mercado está perto desse patamar.'
    ];
  } else if (currentMVRV < 2.0) {
    // Neutro
    lines = [
      `📊 MVRV em ${value} — neutro.`,
      `O lucro médio não realizado dos holders de Bitcoin está em +${pctAbs}%. Níveis moderados, o mercado opera dentro da normalidade histórica.`,
      'Acima de 2.0 = mercado começa a aquecer.'
    ];
  } else if (currentMVRV < 2.5) {
    // Aquecendo
    lines = [
      `📊 MVRV em ${value} — mercado aquecendo.`,
      `Holders acumulam +${pctAbs}% de lucro médio não realizado. O mercado segue saudável, mas os ganhos começam a se acumular.`,
      'Acima de 2.5 = região de cautela.'
    ];
  } else if (currentMVRV < 3.0) {
    // Atenção
    lines = [
      `📊 MVRV em ${value} — atenção! ⚠️`,
      pick(
        `Estamos em níveis historicamente associados a topos de mercado. Holders com lucros elevados tendem a realizar.`,
        `Holders com +${pctAbs}% de lucro médio. O indicador se aproxima de níveis historicamente associados a topos.`
      ),
      'Momento de atenção redobrada e gestão de risco.'
    ];
  } else {
    // Alerta máximo (3.0+)
    lines = [
      `📊 MVRV em ${value} — alerta máximo!`,
      pick(
        `O MVRV está em patamares que historicamente antecederam as maiores correções do Bitcoin. Holders com lucros extremos. Momento crítico de gestão de risco.`,
        `Holders com +${pctAbs}% de lucro médio não realizado. Estamos em níveis historicamente associados a topos de mercado.`
      ),
      'Cautela. Grandes correções partiram dessa região no passado.'
    ];
  }

  // Contexto de tendencia semanal
  if (previousMVRV !== undefined) {
    const diff = currentMVRV - previousMVRV;
    if (Math.abs(diff) >= 0.05) {
      const arrow = diff > 0 ? '📈' : '📉';
      lines.push(`${arrow} Variação semanal: ${previousMVRV.toFixed(2)} → ${value}`);
    }
  }

  return lines.join('\n\n');
} 