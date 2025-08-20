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

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .title { font: 700 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #000; }
      .yl { font: 700 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #000; }
      .xl { font: 700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #000; }
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

      const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
      const png = resvg.render().asPng();
      Logger.info('Chart generated successfully with Resvg');
      return Buffer.from(png);
    } catch (error) {
      if (browser) await browser.close();
      Logger.error('Failed to generate chart with Puppeteer', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
} 