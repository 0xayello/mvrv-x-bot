import { Resvg } from '@resvg/resvg-js';
import { Logger } from '../utils/logger';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ChartData {
  times: string[];
  values: number[];
}

export class ChartService {
  async generateMVRVChart(data: ChartData, currentMVRV?: number): Promise<Buffer> {
    try {
      Logger.info('Generating MVRV chart', {
        numberOfPoints: data.times.length,
        firstDate: data.times[0],
        lastDate: data.times[data.times.length - 1]
      });

      const lastValue = currentMVRV ?? data.values[data.values.length - 1];

      const width = 1200;
      const height = 675;
      const padding = { left: 80, right: 60, top: 80, bottom: 70 };
      const chartArea = {
        left: padding.left,
        top: padding.top,
        right: width - padding.right,
        bottom: height - padding.bottom,
        width: width - padding.left - padding.right,
        height: height - padding.top - padding.bottom
      };

      const yMin = 0;
      const yMax = 4;
      const getY = (value: number) => chartArea.bottom - ((value - yMin) / (yMax - yMin)) * chartArea.height;
      const getX = (index: number) => chartArea.left + (index / (data.values.length - 1)) * chartArea.width;

      // Pontos da linha MVRV
      const linePoints = data.values.map((value, i) =>
        `${getX(i)},${getY(Math.max(yMin, Math.min(yMax, value)))}`
      ).join(' ');

      // Labels do eixo X
      const monthAbbr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const xLabels = [];
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear().toString().slice(-2);
      const totalPoints = data.times.length;
      const numLabels = 10;
      const step = Math.floor(totalPoints / (numLabels - 1));

      for (let i = 0; i < numLabels; i++) {
        let index: number;
        let labelText: string;

        if (i === numLabels - 1) {
          index = totalPoints - 1;
          labelText = `${monthAbbr[currentMonth]} ${currentYear}`;
        } else {
          index = i * step;
          const date = new Date(data.times[index]);
          labelText = `${monthAbbr[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
        }

        xLabels.push({ x: getX(index), text: labelText });
      }

      // Font embedding
      let fontCss = '';
      try {
        const fontPath = join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf');
        const fontBuf = readFileSync(fontPath);
        const fontBase64 = fontBuf.toString('base64');
        fontCss = `@font-face { font-family: "DejaVuEmbed"; src: url(data:font/ttf;base64,${fontBase64}) format('truetype'); font-weight: 400; font-style: normal; }`;
      } catch {
        // Fallback fonts will be used
      }

      const dotX = getX(data.values.length - 1);
      const clampedValue = Math.max(yMin, Math.min(yMax, lastValue));
      const dotY = getY(clampedValue);
      const valueLabel = lastValue.toFixed(2).replace('.', ',');

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      ${fontCss}
    </style>
    <linearGradient id="zoneGrad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="rgba(30,120,50,0.25)" />
      <stop offset="25%" stop-color="rgba(30,120,50,0.12)" />
      <stop offset="40%" stop-color="rgba(170,120,20,0.14)" />
      <stop offset="58%" stop-color="rgba(180,100,30,0.20)" />
      <stop offset="78%" stop-color="rgba(190,65,35,0.25)" />
      <stop offset="100%" stop-color="rgba(200,50,45,0.30)" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="#0d1117" />

  <!-- Titulo -->
  <text x="${width / 2}" y="52" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="900" font-size="32" fill="#e6edf3">MVRV do Bitcoin</text>
  <text x="${width / 2}" y="72" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="400" font-size="14" fill="#6e7681">Ultimos 5 anos  ·  Fonte: Coinmetrics</text>

  <!-- Zona gradiente -->
  <rect x="${chartArea.left}" y="${chartArea.top}" width="${chartArea.width}" height="${chartArea.bottom - chartArea.top}" fill="url(#zoneGrad)" rx="4" />

  <!-- Grid Y pontilhado (sutil) -->
  ${[1, 2, 3].map(i => `<line x1="${chartArea.left}" y1="${getY(i)}" x2="${chartArea.right}" y2="${getY(i)}" stroke="rgba(255,255,255,0.08)" stroke-width="0.8" stroke-dasharray="4,6" />`).join('')}

  <!-- Watermark centralizado -->
  <text x="${chartArea.left + chartArea.width / 2}" y="${chartArea.top + chartArea.height / 2 + 14}" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="900" font-size="62" fill="rgba(255,255,255,0.04)">@ParadigmaEdu</text>

  <!-- Linha MVRV -->
  <polyline points="${linePoints}" fill="none" stroke="#f7931a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

  <!-- Ponto atual com glow -->
  <circle cx="${dotX}" cy="${dotY}" r="14" fill="rgba(247,147,26,0.15)" />
  <circle cx="${dotX}" cy="${dotY}" r="5" fill="#f7931a" filter="url(#glow)" />

  <!-- Label do valor atual -->
  <rect x="${dotX - 50}" y="${dotY - 30}" width="42" height="22" rx="11" fill="#f7931a" />
  <text x="${dotX - 29}" y="${dotY - 15}" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="700" font-size="13" fill="#0d1117">${valueLabel}</text>

  <!-- Labels Y -->
  ${[1, 2, 3].map(i => `<text x="${chartArea.left - 14}" y="${getY(i) + 6}" text-anchor="end" font-family="DejaVuEmbed, sans-serif" font-weight="700" font-size="18" fill="#8b949e">${i}</text>`).join('')}

  <!-- Labels X -->
  ${xLabels.map(label => `<text x="${label.x}" y="${chartArea.bottom + 28}" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="700" font-size="16" fill="#8b949e">${label.text}</text>`).join('')}

  <!-- Borda sutil na area do chart -->
  <rect x="${chartArea.left}" y="${chartArea.top}" width="${chartArea.width}" height="${chartArea.bottom - chartArea.top}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1" rx="4" />

</svg>`;

      // Caminho A (primario): Resvg local
      try {
        const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
        const png = resvg.render().asPng();
        Logger.info('Chart generated successfully with Resvg');
        return Buffer.from(png);
      } catch (e) {
        Logger.warn('Resvg failed, trying QuickChart fallback', { error: e instanceof Error ? e.message : String(e) });
      }

      // Caminho B (fallback): QuickChart
      const downsampleFactor = Math.max(1, Math.floor(data.times.length / 180));
      const sampledTimes = data.times.filter((_, i) => i % downsampleFactor === 0);
      const sampledValues = data.values.filter((_, i) => i % downsampleFactor === 0);

      const qcTotalPoints = sampledTimes.length;
      const qcStep = Math.floor(qcTotalPoints / (numLabels - 1));

      const labelsArray = sampledTimes.map((t, index) => {
        for (let i = 0; i < numLabels; i++) {
          const labelIndex = (i === numLabels - 1) ? qcTotalPoints - 1 : i * qcStep;
          if (index === labelIndex) {
            if (i === numLabels - 1) {
              return `${monthAbbr[currentMonth]} ${currentYear}`;
            }
            const d = new Date(t);
            return `${monthAbbr[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
          }
        }
        return '';
      });

      const config = {
        type: 'line',
        data: {
          labels: labelsArray,
          datasets: [
            { label: 'MVRV', data: sampledValues, borderColor: '#58a6ff', borderWidth: 3, pointRadius: 0, tension: 0.35, order: 10, fill: false },
            { label: 'Green', data: sampledValues.map(() => 1.0), backgroundColor: 'rgba(46,160,67,0.20)', borderColor: 'transparent', fill: 'origin', order: 1 },
            { label: 'Yellow', data: sampledValues.map(() => 3.0), backgroundColor: 'rgba(210,153,34,0.18)', borderColor: 'transparent', fill: '-1', order: 2 },
            { label: 'Orange', data: sampledValues.map(() => 3.5), backgroundColor: 'rgba(219,109,40,0.20)', borderColor: 'transparent', fill: '-1', order: 3 },
            { label: 'Red', data: sampledValues.map(() => 4), backgroundColor: 'rgba(248,81,73,0.22)', borderColor: 'transparent', fill: '-1', order: 4 }
          ]
        },
        options: {
          responsive: false,
          animation: false,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Bitcoin MVRV - Ultimos 5 anos', color: '#e6edf3', font: { size: 24, weight: 'bold' }, padding: { top: 20, bottom: 18 } }
          },
          layout: { padding: { left: 60, right: 60, top: 40, bottom: 50 } },
          scales: {
            y: { beginAtZero: true, min: 0, max: 4, grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#8b949e', font: { weight: 'bold' }, stepSize: 0.5, callback: (v: any) => String(v).replace('.', ',') } },
            x: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 12, weight: 'bold' }, maxRotation: 0, minRotation: 0, autoSkip: false } }
          }
        }
      };

      const qcBody = {
        width,
        height,
        format: 'png',
        backgroundColor: '#0d1117',
        version: '4.4.1',
        chart: config
      } as any;

      const qcResp = await fetch('https://quickchart.io/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qcBody)
      });
      if (!qcResp.ok) throw new Error(`QuickChart failed: ${qcResp.status}`);
      const qcArray = await qcResp.arrayBuffer();
      Logger.info('Chart generated successfully with QuickChart');
      return Buffer.from(qcArray);
    } catch (error) {
      Logger.error('Failed to generate chart', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
