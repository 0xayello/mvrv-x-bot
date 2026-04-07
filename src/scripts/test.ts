import { CoinmetricsService } from '../services/coinmetrics';
import { ChartService } from '../services/chart';
import { Logger } from '../utils/logger';
import { writeFileSync } from 'fs';
import { join } from 'path';

function generateTweetText(currentMVRV: number, previousMVRV?: number): string {
  const value = currentMVRV.toFixed(2);
  const pctRaw = (currentMVRV - 1) * 100;
  const pctAbs = Math.abs(pctRaw).toFixed(0);
  let lines: string[];

  const pick = (...options: string[]) => options[Math.floor(Math.random() * options.length)];

  if (currentMVRV < 0.8) {
    lines = [
      `📊 MVRV em ${value} — zona historicamente forte de acumulação`,
      `Estamos na melhor região de acumulação historicamente. Holders estão com um prejuízo médio não realizado de ${pctAbs}%. Valores nesse patamar marcaram os maiores fundos do Bitcoin. Oportunidade rara. 👀`
    ];
  } else if (currentMVRV < 1.0) {
    lines = [
      `📊 MVRV em ${value} — zona histórica de acumulação 👀`,
      `O Bitcoin está sendo negociado abaixo do custo médio dos holders. Historicamente, essa é uma das melhores janelas de acumulação.`,
      'Fique atento: historicamente, essa região costuma anteceder grandes movimentos de alta.'
    ];
  } else if (currentMVRV < 1.25) {
    lines = [
      `📊 MVRV em ${value} — região historicamente favorável para acumulação`,
      'Estamos próximos da região onde o preço se aproxima do custo médio dos holders.',
      'Abaixo de 1.0 = zona histórica de acumulação. O mercado está perto desse patamar.'
    ];
  } else if (currentMVRV < 2.0) {
    lines = [
      `📊 MVRV em ${value} — neutro.`,
      `O lucro médio não realizado dos holders de Bitcoin está em +${pctAbs}%.`,
      'Níveis moderados, o mercado opera dentro da normalidade histórica.',
      'MVRV < 1.0 = região histórica de acumulação | > 3.0 = região historicamente associada a topos.'
    ];
  } else if (currentMVRV < 2.5) {
    lines = [
      `📊 MVRV em ${value} — mercado aquecendo.`,
      `Holders acumulam +${pctAbs}% de lucro médio não realizado. O mercado segue saudável, mas os ganhos começam a se acumular.`,
      'Acima de 2.5 = região de cautela.'
    ];
  } else if (currentMVRV < 3.0) {
    lines = [
      `📊 MVRV em ${value} — atenção ⚠️`,
      pick(
        `Estamos em níveis historicamente associados a topos de mercado. Holders com lucros elevados tendem a realizar.`,
        `Holders com +${pctAbs}% de lucro médio. O indicador se aproxima de níveis historicamente associados a topos.`
      ),
      'Momento de atenção redobrada e gestão de risco.'
    ];
  } else {
    lines = [
      `📊 MVRV em ${value} — alerta máximo`,
      pick(
        `O MVRV está em patamares que historicamente antecederam as maiores correções do Bitcoin. Holders com lucros extremos. Momento crítico de gestão de risco.`,
        `Holders com +${pctAbs}% de lucro médio não realizado. Estamos em níveis historicamente associados a topos de mercado.`
      ),
      'Cautela. Grandes correções partiram dessa região no passado.'
    ];
  }

  if (previousMVRV !== undefined) {
    const diff = currentMVRV - previousMVRV;
    if (Math.abs(diff) >= 0.05) {
      const arrow = diff > 0 ? '📈' : '📉';
      lines.push(`${arrow} Variação semanal: ${previousMVRV.toFixed(2)} → ${value}`);
    }
  }

  return lines.join('\n\n');
}

async function test() {
  try {
    Logger.info('Starting test...');

    const coinmetrics = new CoinmetricsService();
    const chart = new ChartService();

    Logger.info('Fetching data...');
    const [mvrv, mvrvHistory] = await Promise.all([
      coinmetrics.getBitcoinMVRV(),
      coinmetrics.getMVRVHistory()
    ]);

    if (typeof mvrv !== 'number' || isNaN(mvrv)) {
      throw new Error('Invalid MVRV value received');
    }

    Logger.info('Data fetch successful', {
      mvrv,
      historyPoints: mvrvHistory.values.length
    });

    // Generate and save chart
    Logger.info('Generating chart...');
    const chartImage = await chart.generateMVRVChart(mvrvHistory, mvrv);
    
    // Save chart locally for inspection
    const testImagePath = join(process.cwd(), 'test-chart.png');
    writeFileSync(testImagePath, chartImage);
    Logger.info('Chart saved locally for inspection', { path: testImagePath });

    // Gerar copy dinamica
    const prevIndex = Math.max(0, mvrvHistory.values.length - 8);
    const previousMVRV = mvrvHistory.values[prevIndex];
    const message = generateTweetText(mvrv, previousMVRV);

    Logger.info('Generated tweet text', { message });

    // Save chart only (no tweet posting) — use test-bot para postar
    Logger.info('Test complete. Chart saved. Tweet text generated (not posted).');

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