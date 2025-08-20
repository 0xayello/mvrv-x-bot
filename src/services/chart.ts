import { Resvg } from '@resvg/resvg-js';
import { format } from 'date-fns';
import { Logger } from '../utils/logger';

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

      // Preparar dados para o gráfico SVG
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
      const yMax = 4.5;
      const getY = (value: number) => chartArea.bottom - ((value - yMin) / (yMax - yMin)) * chartArea.height;
      const getX = (index: number) => chartArea.left + (index / (data.values.length - 1)) * chartArea.width;
      
      // Gerar pontos da linha MVRV
      const linePoints = data.values.map((value, i) => 
        `${getX(i)},${getY(Math.max(yMin, Math.min(yMax, value)))}`
      ).join(' ');
      
      // Gerar rótulos do eixo X
      const xLabels = [];
      for (let i = 0; i < data.times.length; i += Math.ceil(data.times.length / 6)) {
        if (i < data.times.length) {
          const date = new Date(data.times[i]);
          xLabels.push({
            x: getX(i),
            text: format(date, 'dd/MM')
          });
        }
      }

      // Render chart in a hosted HTML page and take a screenshot via Vercel OG-like capture API
      // Fallback if direct SVG -> PNG ever fails
      // Embed a font via data URL so Resvg always renders text
      let fontCss = '';
      try {
        const fontResp = await fetch('https://raw.githubusercontent.com/dejavu-fonts/dejavu-fonts/master/ttf/DejaVuSans.ttf');
        if (fontResp.ok) {
          const fontBuf = Buffer.from(await fontResp.arrayBuffer());
          const fontBase64 = fontBuf.toString('base64');
          fontCss = `@font-face { font-family: "DejaVuEmbed"; src: url(data:font/ttf;base64,${fontBase64}) format('truetype'); font-weight: 400; font-style: normal; }`;
        }
      } catch {}

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      ${fontCss}
      .title { font: 700 28px DejaVuEmbed, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #000; }
      .yl { font: 700 18px DejaVuEmbed, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #000; }
      .xl { font: 700 14px DejaVuEmbed, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #000; }
    </style>
  </defs>
  <text x="${width/2}" y="40" text-anchor="middle" class="title">Bitcoin MVRV - Últimos 180 dias</text>

  <!-- Zonas -->
  <rect x="${chartArea.left}" y="${getY(1.0)}" width="${chartArea.width}" height="${chartArea.bottom - getY(1.0)}" fill="rgba(0,255,0,0.15)" />
  <rect x="${chartArea.left}" y="${getY(3.0)}" width="${chartArea.width}" height="${getY(1.0) - getY(3.0)}" fill="rgba(255,255,0,0.2)" />
  <rect x="${chartArea.left}" y="${getY(3.5)}" width="${chartArea.width}" height="${getY(3.0) - getY(3.5)}" fill="rgba(255,140,0,0.15)" />
  <rect x="${chartArea.left}" y="${chartArea.top}" width="${chartArea.width}" height="${getY(3.5) - chartArea.top}" fill="rgba(255,0,0,0.15)" />

  <!-- Grade Y -->
  ${[0,1,2,3,4].map(i => `<line x1="${chartArea.left}" y1="${getY(i)}" x2="${chartArea.right}" y2="${getY(i)}" stroke="rgba(0,0,0,0.1)" stroke-width="1" />`).join('')}

  <!-- Linha MVRV -->
  <polyline points="${linePoints}" fill="none" stroke="rgb(0,150,255)" stroke-width="3" />

  <!-- Rótulos Y -->
  ${[0,1,2,3,4].map(i => `<text class="yl" x="${chartArea.left - 20}" y="${getY(i)+6}" text-anchor="end">${i}</text>`).join('')}

  <!-- Rótulos X -->
  ${xLabels.map(label => `<text class="xl" x="${label.x}" y="${chartArea.bottom + 25}" text-anchor="middle">${label.text}</text>`).join('')}
</svg>`;

      // Caminho A (recomendado pela comunidade): QuickChart (Chart.js SaaS)
      try {
        const monthAbbr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        // Rótulos somente no dia 01 de cada mês, usando nome do mês abreviado
        const labels = data.times.map((t) => {
          const d = new Date(t);
          if (d.getDate() !== 1) return '';
          return monthAbbr[d.getMonth()];
        });
        const config = {
        type: 'line',
        data: {
            labels,
          datasets: [
              { label: 'MVRV', data: data.values, borderColor: 'rgb(0,150,255)', borderWidth: 3, pointRadius: 0, tension: 0.35, order: 10, fill: false },
              { label: 'Red', data: data.values.map(() => 4), backgroundColor: 'rgba(255,0,0,0.18)', borderColor: 'transparent', fill: true, order: 1 },
              { label: 'Orange', data: data.values.map(() => 3.5), backgroundColor: 'rgba(255,140,0,0.18)', borderColor: 'transparent', fill: true, order: 2 },
              { label: 'Yellow', data: data.values.map(() => 3.0), backgroundColor: 'rgba(255,215,0,0.22)', borderColor: 'transparent', fill: true, order: 3 },
              { label: 'Green', data: data.values.map(() => 1.0), backgroundColor: 'rgba(0,200,0,0.18)', borderColor: 'transparent', fill: true, order: 4 }
          ]
        },
        options: {
            responsive: false,
            animation: false,
          maintainAspectRatio: false,
          plugins: {
              legend: { display: false },
              title: { display: true, text: 'Bitcoin MVRV - Últimos 180 dias', color: '#000', font: { size: 26, weight: 'bold' }, padding: { top: 16, bottom: 12 } }
            },
            layout: { padding: { left: 60, right: 60, top: 56, bottom: 56 } },
          scales: {
              y: { beginAtZero: true, min: 0, max: 4.5, grid: { color: 'rgba(0,0,0,0.08)' }, ticks: { color: '#222', font: { weight: 'bold' }, stepSize: 0.5, callback: (v: any) => String(v).replace('.', ',') } },
              x: { grid: { display: false }, ticks: { color: '#222', font: { size: 12, weight: 'bold' }, maxRotation: 0, minRotation: 0, autoSkip: false } }
            }
          }
        };

        const qcBody = {
          width,
          height,
          format: 'png',
          backgroundColor: 'transparent',
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
      } catch (e) {
        Logger.warn('QuickChart failed, trying local Resvg', { error: e instanceof Error ? e.message : String(e) });
      }

      // Caminho B: SVG -> PNG localmente (rápido, sem dependências externas)
      try {
        const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
        const png = resvg.render().asPng();
        Logger.info('Chart generated successfully with Resvg');
        return Buffer.from(png);
      } catch (e) {
        Logger.warn('Resvg failed, will fallback to remote screenshot provider', { error: e instanceof Error ? e.message : String(e) });
      }

      // Fallback: renderiza via a página /chart e captura com um provider externo (Urlbox/ScreenshotOne)
      const projectUrl = process.env.PUBLIC_BASE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
      if (!projectUrl) {
        throw new Error('Missing PUBLIC_BASE_URL or VERCEL_URL for remote screenshot fallback');
      }
      const payload = Buffer.from(JSON.stringify({ times: data.times, values: data.values })).toString('base64');
      const target = `${projectUrl}/chart?d=${encodeURIComponent(payload)}`;

      const provider = process.env.SCREENSHOT_PROVIDER || 'urlbox';
      let screenshotUrl = '';
      if (provider === 'urlbox') {
        const key = process.env.URLBOX_API_KEY; // sk_...
        if (!key) throw new Error('Missing URLBOX_API_KEY');
        const qs = new URLSearchParams({
          url: target,
          width: '1200',
          height: '675',
          deviceScaleFactor: '2',
          format: 'png',
          fresh: 'true'
        });
        screenshotUrl = `https://api.urlbox.io/v1/${key}/png?${qs.toString()}`;
      } else if (provider === 'screenshotone') {
        const key = process.env.SCREENSHOTONE_KEY;
        if (!key) throw new Error('Missing SCREENSHOTONE_KEY');
        const qs = new URLSearchParams({
          access_key: key,
          url: target,
          viewport_width: '1200',
          viewport_height: '675',
          full_page: 'false',
          format: 'png',
          block_ads: 'true'
        });
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
      Logger.error('Failed to generate chart with Resvg', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
} 