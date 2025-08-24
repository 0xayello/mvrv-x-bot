import { Resvg } from '@resvg/resvg-js';
import { format } from 'date-fns';
import { Logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

interface ChartData {
  times: string[];
  values: number[];
}

export class ChartService {
  async generateMVRVChart(data: ChartData): Promise<Buffer> {
    try {
      Logger.info('Generating MVRV chart with SVG/Resvg', {
        numberOfPoints: data.times.length,
        firstDate: data.times[0],
        lastDate: data.times[data.times.length - 1]
      });

      const width = 1200;
      const height = 675;
      const padding = { left: 80, right: 40, top: 80, bottom: 60 };
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
      
      const linePoints = data.values.map((value, i) => 
        `${getX(i)},${getY(Math.max(yMin, Math.min(yMax, value)))}`
      ).join(' ');
      
      const xLabels = [] as { x: number; text: string }[];
      for (let i = 0; i < data.times.length; i += Math.ceil(data.times.length / 6)) {
        if (i < data.times.length) {
          const date = new Date(data.times[i]);
          xLabels.push({ x: getX(i), text: format(date, 'dd/MM') });
        }
      }

      // Fonte local embutida: nome único e consistente
      let fontCss = '';
      try {
        const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf');
        const fontBuf = fs.readFileSync(fontPath);
        const fontBase64 = fontBuf.toString('base64');
        fontCss = `@font-face { font-family: 'DejaVuSVG'; src: url(data:font/ttf;base64,${fontBase64}) format('truetype'); font-style: normal; font-weight: 400; }`;
      } catch (e) {
        Logger.warn('Failed to embed local font, fallback to system stack', { error: e instanceof Error ? e.message : String(e) });
      }

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      ${fontCss}
      .title { font-family: 'DejaVuSVG'; font-weight: 700; font-size: 24px; fill: #000; }
      .yl { font-family: 'DejaVuSVG'; font-weight: 700; font-size: 18px; fill: #000; }
      .xl { font-family: 'DejaVuSVG'; font-weight: 700; font-size: 14px; fill: #000; }
      .ol { font-family: 'DejaVuSVG'; font-weight: 700; font-size: 16px; paint-order: stroke fill; }
    </style>
  </defs>
  
  <rect x="0" y="0" width="${width}" height="${height}" fill="#e9ecef" />
  
  <text x="${width/2}" y="50" text-anchor="middle" class="title">Bitcoin MVRV - Últimos 5 anos</text>

  <rect x="${chartArea.left}" y="${getY(1.0)}" width="${chartArea.width}" height="${chartArea.bottom - getY(1.0)}" fill="rgba(40,167,69,0.25)" />
  <rect x="${chartArea.left}" y="${getY(3.0)}" width="${chartArea.width}" height="${getY(1.0) - getY(3.0)}" fill="rgba(255,193,7,0.20)" />
  <rect x="${chartArea.left}" y="${getY(3.5)}" width="${chartArea.width}" height="${getY(3.0) - getY(3.5)}" fill="rgba(255,102,0,0.22)" />
  <rect x="${chartArea.left}" y="${chartArea.top}" width="${chartArea.width}" height="${getY(3.5) - chartArea.top}" fill="rgba(220,53,69,0.25)" />

  ${[0,1,2,3,4].map(i => `<line x1="${chartArea.left}" y1="${getY(i)}" x2="${chartArea.right}" y2="${getY(i)}" stroke="rgba(0,0,0,0.1)" stroke-width="1" />`).join('')}

  <polyline points="${linePoints}" fill="none" stroke="rgb(0,150,255)" stroke-width="3" />

  ${[0,1,2,3,4].map(i => `<text class="yl" x="${chartArea.left - 20}" y="${getY(i)+6}" text-anchor="end">${i}</text>`).join('')}

  ${xLabels.map(label => `<text class="xl" x="${label.x}" y="${chartArea.bottom + 25}" text-anchor="middle">${label.text}</text>`).join('')}

  <text class="ol" x="${chartArea.left + 10}" y="${getY(0.5)}" stroke="rgba(255,255,255,0.95)" stroke-width="4" fill="#000">zona de compra</text>
  <text class="ol" x="${chartArea.left + 10}" y="${getY(2.0)}" stroke="rgba(255,255,255,0.95)" stroke-width="4" fill="#000">neutro</text>
  <text class="ol" x="${chartArea.left + 10}" y="${getY(3.25)}" stroke="rgba(255,255,255,0.95)" stroke-width="4" fill="#000">alto</text>
  <text class="ol" x="${chartArea.left + 10}" y="${getY(3.75)}" stroke="rgba(255,255,255,0.95)" stroke-width="4" fill="#000">alarmante</text>
</svg>`;

      try {
        const maxPoints = 1000;
        const factor = Math.max(1, Math.ceil(data.values.length / maxPoints));
        const sampledValues = data.values.filter((_, i) => i % factor === 0);
        const sampledTimes = data.times.filter((_, i) => i % factor === 0);

        const monthAbbr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const labels = sampledTimes.map((t) => {
          const d = new Date(t);
          return d.getDate() === 1 ? monthAbbr[d.getMonth()] : '';
        });

        const config = {
          type: 'line',
          data: { labels, datasets: [
            { label: 'MVRV', data: sampledValues, borderColor: 'rgb(0,150,255)', borderWidth: 3, pointRadius: 0, tension: 0.35, order: 10, fill: false },
            { label: 'Green', data: sampledValues.map(() => 1.0), backgroundColor: 'rgba(40,167,69,0.25)', borderColor: 'transparent', fill: 'origin', order: 1 },
            { label: 'Yellow', data: sampledValues.map(() => 3.0), backgroundColor: 'rgba(255,193,7,0.20)', borderColor: 'transparent', fill: '-1', order: 2 },
            { label: 'Orange', data: sampledValues.map(() => 3.5), backgroundColor: 'rgba(255,102,0,0.22)', borderColor: 'transparent', fill: '-1', order: 3 },
            { label: 'Red', data: sampledValues.map(() => 4), backgroundColor: 'rgba(220,53,69,0.25)', borderColor: 'transparent', fill: '-1', order: 4 }
          ]},
          options: {
            responsive: false,
            animation: false,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: 'Bitcoin MVRV - Últimos 5 anos', color: '#000', font: { size: 24, weight: 'bold' }, padding: { top: 20, bottom: 18 } } },
            layout: { padding: { left: 60, right: 60, top: 40, bottom: 50 } },
            scales: {
              y: { beginAtZero: true, min: 0, max: 4, grid: { color: 'rgba(0,0,0,0.08)' }, ticks: { color: '#222', font: { weight: 'bold' }, stepSize: 0.5, callback: (v: any) => String(v).replace('.', ',') } },
              x: { grid: { display: false }, ticks: { color: '#222', font: { size: 12, weight: 'bold' }, maxRotation: 0, minRotation: 0, autoSkip: false } }
            }
          }
        } as any;

        const qcBody = { width, height, format: 'png', backgroundColor: '#e9ecef', version: '4.4.1', chart: config } as any;
        const qcResp = await fetch('https://quickchart.io/chart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(qcBody) });
        if (!qcResp.ok) throw new Error(`QuickChart failed: ${qcResp.status}`);
        const qcArray = await qcResp.arrayBuffer();
        Logger.info('Chart generated successfully with QuickChart');
        return Buffer.from(qcArray);
      } catch (e) {
        Logger.warn('QuickChart failed, trying local Resvg', { error: e instanceof Error ? e.message : String(e) });
      }

      try {
        const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
        const png = resvg.render().asPng();
        Logger.info('Chart generated successfully with Resvg');
        return Buffer.from(png);
      } catch (e) {
        Logger.warn('Resvg failed, will fallback to remote screenshot provider', { error: e instanceof Error ? e.message : String(e) });
      }

      const projectUrl = process.env.PUBLIC_BASE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
      if (!projectUrl) {
        throw new Error('Missing PUBLIC_BASE_URL or VERCEL_URL for remote screenshot fallback');
      }
      const payload = Buffer.from(JSON.stringify({ times: data.times, values: data.values })).toString('base64');
      const target = `${projectUrl}/chart?d=${encodeURIComponent(payload)}`;

      const provider = process.env.SCREENSHOT_PROVIDER || 'urlbox';
      let screenshotUrl = '';
      if (provider === 'urlbox') {
        const key = process.env.URLBOX_API_KEY;
        if (!key) throw new Error('Missing URLBOX_API_KEY');
        const qs = new URLSearchParams({ url: target, width: '1200', height: '675', deviceScaleFactor: '2', format: 'png', fresh: 'true' });
        screenshotUrl = `https://api.urlbox.io/v1/${key}/png?${qs.toString()}`;
      } else if (provider === 'screenshotone') {
        const key = process.env.SCREENSHOTONE_KEY;
        if (!key) throw new Error('Missing SCREENSHOTONE_KEY');
        const qs = new URLSearchParams({ access_key: key, url: target, viewport_width: '1200', viewport_height: '675', full_page: 'false', format: 'png', block_ads: 'true' });
        screenshotUrl = `https://api.screenshotone.com/take?${qs.toString()}`;
      } else {
        throw new Error('Unsupported SCREENSHOT_PROVIDER');
      }

      const resp = await fetch(screenshotUrl);
      if (!resp.ok) {
        throw new Error(`Screenshot provider failed: ${resp.status} ${await resp.text()}`);
      }
      const arrayBuffer = await resp.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      Logger.error('Failed to generate chart with Resvg', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
} 