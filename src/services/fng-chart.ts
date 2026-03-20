import { Resvg } from '@resvg/resvg-js';
import { Logger } from '../utils/logger';
import { writeFileSync, existsSync } from 'fs';
import { DEJAVU_SANS_B64 } from './font-data';

interface FngChartData {
  times: string[];
  values: number[];
}

function getFngColor(v: number): string {
  if (v <= 24) return '#ea3943';  // extreme fear — red
  if (v <= 44) return '#ea8c00';  // fear — orange
  if (v <= 55) return '#f5d100';  // neutral — yellow
  if (v <= 74) return '#93d900';  // greed — lime
  return '#16c784';               // extreme greed — green
}

export class FngChartService {
  async generateChart(data: FngChartData, currentValue?: number): Promise<Buffer> {
    try {
      Logger.info('Generating FNG chart', { points: data.times.length });

      const lastValue = currentValue ?? data.values[data.values.length - 1];

      const width = 1200;
      const height = 675;
      const padding = { left: 80, right: 60, top: 80, bottom: 70 };
      const chartArea = {
        left: padding.left,
        top: padding.top,
        right: width - padding.right,
        bottom: height - padding.bottom,
        width: width - padding.left - padding.right,
        height: height - padding.top - padding.bottom,
      };

      const yMin = 0;
      const yMax = 100;
      const getY = (v: number) => chartArea.bottom - ((v - yMin) / (yMax - yMin)) * chartArea.height;
      const getX = (i: number) => chartArea.left + (i / (data.values.length - 1)) * chartArea.width;

      // Colored line segments
      let lineSegments = '';
      for (let i = 1; i < data.values.length; i++) {
        const x1 = getX(i - 1);
        const y1 = getY(Math.max(yMin, Math.min(yMax, data.values[i - 1])));
        const x2 = getX(i);
        const y2 = getY(Math.max(yMin, Math.min(yMax, data.values[i])));
        const color = getFngColor(data.values[i]);
        lineSegments += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" />`;
      }

      // X labels
      const monthAbbr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const numLabels = 10;
      const step = Math.floor(data.values.length / (numLabels - 1));
      const xLabels: { x: number; text: string }[] = [];

      for (let i = 0; i < numLabels; i++) {
        const index = (i === numLabels - 1) ? data.values.length - 1 : i * step;
        const date = new Date(data.times[index]);
        const label = `${monthAbbr[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
        xLabels.push({ x: getX(index), text: label });
      }

      // Y labels
      const yLabels = [0, 25, 50, 75, 100];

      // Zone bands
      const zones = [
        { from: 0, to: 25, color: 'rgba(234,57,67,0.12)' },
        { from: 25, to: 45, color: 'rgba(234,140,0,0.10)' },
        { from: 45, to: 55, color: 'rgba(245,209,0,0.08)' },
        { from: 55, to: 75, color: 'rgba(147,217,0,0.10)' },
        { from: 75, to: 100, color: 'rgba(22,199,132,0.12)' },
      ];

      const zoneBands = zones.map(z => {
        const y1 = getY(z.to);
        const y2 = getY(z.from);
        return `<rect x="${chartArea.left}" y="${y1}" width="${chartArea.width}" height="${y2 - y1}" fill="${z.color}" />`;
      }).join('');

      // Zone labels (right side, subtle)
      const zoneLabels = [
        { y: 12.5, text: 'Medo Extremo', color: '#ea3943' },
        { y: 35, text: 'Medo', color: '#ea8c00' },
        { y: 50, text: 'Neutro', color: '#f5d100' },
        { y: 65, text: 'Ganância', color: '#93d900' },  // changed to 'Ganância'
        { y: 87.5, text: 'Ganância Extrema', color: '#16c784' },  // changed to 'Ganância Extrema'
      ];

      const zoneLabelsSvg = zoneLabels.map(z => {
        const y = getY(z.y);
        return `<text x="${chartArea.right - 10}" y="${y + 5}" text-anchor="end" font-family="DejaVuEmbed, sans-serif" font-weight="600" font-size="11" fill="${z.color}" opacity="0.5">${z.text}</text>`;
      }).join('');

      // Current value dot
      const dotX = getX(data.values.length - 1);
      const clampedValue = Math.max(yMin, Math.min(yMax, lastValue));
      const dotY = getY(clampedValue);
      const dotColor = getFngColor(lastValue);

      // Font embedding
      const fontCss = `@font-face { font-family: "DejaVuEmbed"; src: url(data:font/ttf;base64,${DEJAVU_SANS_B64}) format('truetype'); font-weight: 400; font-style: normal; }`;

      // Write font to /tmp for Resvg
      const tmpFontPath = '/tmp/DejaVuSans.ttf';
      if (!existsSync(tmpFontPath)) {
        writeFileSync(tmpFontPath, Buffer.from(DEJAVU_SANS_B64, 'base64'));
        Logger.info('Font written to /tmp');
      }

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>${fontCss}</style>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="#0d1117" />

  <!-- Title -->
  <text x="${width / 2}" y="52" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="900" font-size="32" fill="#e6edf3">Fear &amp; Greed Index</text>
  <text x="${width / 2}" y="72" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="400" font-size="14" fill="#6e7681">Bitcoin  ·  Fonte: alternative.me</text>

  <!-- Zone bands -->
  ${zoneBands}

  <!-- Grid Y -->
  ${yLabels.map(v => `<line x1="${chartArea.left}" y1="${getY(v)}" x2="${chartArea.right}" y2="${getY(v)}" stroke="rgba(255,255,255,0.08)" stroke-width="0.8" stroke-dasharray="4,6" />`).join('')}

  <!-- Watermark -->
  <text x="${chartArea.left + chartArea.width / 2}" y="${chartArea.top + chartArea.height / 2 + 14}" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="900" font-size="62" fill="rgba(255,255,255,0.04)">@ParadigmaEdu</text>

  <!-- Zone labels -->
  ${zoneLabelsSvg}

  <!-- Line segments (colored by value) -->
  ${lineSegments}

  <!-- Current dot with glow -->
  <circle cx="${dotX}" cy="${dotY}" r="14" fill="${dotColor}22" />
  <circle cx="${dotX}" cy="${dotY}" r="5" fill="${dotColor}" filter="url(#glow)" />

  <!-- Value pill -->
  <rect x="${dotX - 50}" y="${dotY - 30}" width="42" height="22" rx="11" fill="${dotColor}" />
  <text x="${dotX - 29}" y="${dotY - 15}" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="700" font-size="13" fill="#0d1117">${lastValue}</text>

  <!-- Y labels -->
  ${yLabels.map(v => `<text x="${chartArea.left - 14}" y="${getY(v) + 6}" text-anchor="end" font-family="DejaVuEmbed, sans-serif" font-weight="700" font-size="18" fill="#8b949e">${v}</text>`).join('')}

  <!-- X labels -->
  ${xLabels.map(l => `<text x="${l.x}" y="${chartArea.bottom + 28}" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="700" font-size="16" fill="#8b949e">${l.text}</text>`).join('')}

  <!-- Border -->
  <rect x="${chartArea.left}" y="${chartArea.top}" width="${chartArea.width}" height="${chartArea.bottom - chartArea.top}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1" rx="4" />
</svg>`;

      // Render with Resvg
      try {
        const resvgOpts: any = {
          fitTo: { mode: 'original' },
          font: {
            fontFiles: [tmpFontPath],
            loadSystemFonts: false,
            defaultFontFamily: 'DejaVuEmbed',
          },
        };
        const resvg = new Resvg(svg, resvgOpts);
        const png = resvg.render().asPng();
        Logger.info('FNG chart generated with Resvg');
        return Buffer.from(png);
      } catch (e) {
        Logger.warn('Resvg failed for FNG chart', { error: e instanceof Error ? e.message : String(e) });
      }

      // Fallback: QuickChart
      const downsampleFactor = Math.max(1, Math.floor(data.times.length / 180));
      const sampledValues = data.values.filter((_, i) => i % downsampleFactor === 0);
      const sampledTimes = data.times.filter((_, i) => i % downsampleFactor === 0);

      const qcStep = Math.floor(sampledTimes.length / (numLabels - 1));
      const labelsArray = sampledTimes.map((t, index) => {
        for (let i = 0; i < numLabels; i++) {
          const labelIndex = (i === numLabels - 1) ? sampledTimes.length - 1 : i * qcStep;
          if (index === labelIndex) {
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
            { label: 'FNG', data: sampledValues, borderColor: '#f5d100', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false },
          ],
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Fear & Greed Index — Bitcoin', color: '#e6edf3', font: { size: 24, weight: 'bold' } },
          },
          scales: {
            y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#8b949e', stepSize: 25 } },
            x: { grid: { display: false }, ticks: { color: '#8b949e', maxRotation: 0, autoSkip: false } },
          },
        },
      };

      const qcResp = await fetch('https://quickchart.io/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width, height, format: 'png', backgroundColor: '#0d1117', version: '4.4.1', chart: config }),
      });
      if (!qcResp.ok) throw new Error(`QuickChart failed: ${qcResp.status}`);
      const qcArray = await qcResp.arrayBuffer();
      Logger.info('FNG chart generated with QuickChart fallback');
      return Buffer.from(qcArray);
    } catch (error) {
      Logger.error('Failed to generate FNG chart', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
}
