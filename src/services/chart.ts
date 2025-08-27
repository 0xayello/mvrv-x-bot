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

      const fontFamily = 'DejaVu Sans';

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#e9ecef" />
  
  <text x="${width/2}" y="50" text-anchor="middle" font-family="${fontFamily}" font-size="24" font-weight="400" fill="#000">Bitcoin MVRV - Últimos 5 anos</text>

  <rect x="${chartArea.left}" y="${getY(1.0)}" width="${chartArea.width}" height="${chartArea.bottom - getY(1.0)}" fill="rgba(40,167,69,0.25)" />
  <rect x="${chartArea.left}" y="${getY(3.0)}" width="${chartArea.width}" height="${getY(1.0) - getY(3.0)}" fill="rgba(255,193,7,0.20)" />
  <rect x="${chartArea.left}" y="${getY(3.5)}" width="${chartArea.width}" height="${getY(3.0) - getY(3.5)}" fill="rgba(255,102,0,0.22)" />
  <rect x="${chartArea.left}" y="${chartArea.top}" width="${chartArea.width}" height="${getY(3.5) - chartArea.top}" fill="rgba(220,53,69,0.25)" />

  ${[0,1,2,3,4].map(i => `<line x1="${chartArea.left}" y1="${getY(i)}" x2="${chartArea.right}" y2="${getY(i)}" stroke="rgba(0,0,0,0.1)" stroke-width="1" />`).join('')}

  <polyline points="${linePoints}" fill="none" stroke="rgb(0,150,255)" stroke-width="3" />

  ${[0,1,2,3,4].map(i => `<text x="${chartArea.left - 20}" y="${getY(i)+6}" text-anchor="end" font-family="${fontFamily}" font-size="18" font-weight="400" fill="#000">${i}</text>`).join('')}

  ${xLabels.map(label => `<text x="${label.x}" y="${chartArea.bottom + 25}" text-anchor="middle" font-family="${fontFamily}" font-size="14" font-weight="400" fill="#000">${label.text}</text>`).join('')}

  <text x="${chartArea.left + 10}" y="${getY(0.5)}" font-family="${fontFamily}" font-size="16" font-weight="400" stroke="rgba(255,255,255,0.95)" stroke-width="4" fill="#000">zona de compra</text>
  <text x="${chartArea.left + 10}" y="${getY(2.0)}" font-family="${fontFamily}" font-size="16" font-weight="400" stroke="rgba(255,255,255,0.95)" stroke-width="4" fill="#000">neutro</text>
  <text x="${chartArea.left + 10}" y="${getY(3.25)}" font-family="${fontFamily}" font-size="16" font-weight="400" stroke="rgba(255,255,255,0.95)" stroke-width="4" fill="#000">alto</text>
  <text x="${chartArea.left + 10}" y="${getY(3.75)}" font-family="${fontFamily}" font-size="16" font-weight="400" stroke="rgba(255,255,255,0.95)" stroke-width="4" fill="#000">alarmante</text>
</svg>`;

      const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf');
      const resvgOnly = new Resvg(svg, {
        fitTo: { mode: 'original' },
        font: {
          loadSystemFonts: false,
          defaultFontFamily: fontFamily,
          fontFiles: [fontPath]
        }
      });
      const pngOnly = resvgOnly.render().asPng();
      Logger.info('Chart generated successfully with Resvg-only');
      return Buffer.from(pngOnly);

      /* caminhos externos desativados */
    } catch (error) {
      Logger.error('Failed to generate chart with Resvg', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
} 