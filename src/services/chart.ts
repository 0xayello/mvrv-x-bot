import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { Resvg } from '@resvg/resvg-js';
import { Chart, ChartConfiguration } from 'chart.js';
import { format } from 'date-fns';
import { Logger } from '../utils/logger';
import { join } from 'path';
import { existsSync } from 'fs';

interface ChartData {
  times: string[];
  values: number[];
}

export class ChartService {
  async generateMVRVChart(data: ChartData): Promise<Buffer> {
    try {
      Logger.info('Generating MVRV chart with data', {
        numberOfPoints: data.times.length,
        firstDate: data.times[0],
        lastDate: data.times[data.times.length - 1],
        dateRange: `${Math.round((new Date(data.times[data.times.length - 1]).getTime() - 
                                 new Date(data.times[0]).getTime()) / (1000 * 60 * 60 * 24))} days`
      });

      // Ensure a known font is available in server environments (e.g., Vercel)
      // If no valid TTF is present, we fall back to 'sans-serif'
      let fontFamily = 'Open Sans';
      try {
        const fontsDir = join(process.cwd(), 'assets', 'fonts');
        const dejaVuPath = join(fontsDir, 'DejaVuSans.ttf');
        const regularPath = join(fontsDir, 'OpenSans-Regular.ttf');
        const boldPath = join(fontsDir, 'OpenSans-Bold.ttf');
        if (existsSync(dejaVuPath)) {
          try {
            GlobalFonts.registerFromPath(dejaVuPath, 'DejaVu Sans');
            fontFamily = 'DejaVu Sans';
            Logger.info('Registered DejaVu Sans font');
          } catch {}
        }
        if (!GlobalFonts.has(fontFamily)) {
          if (existsSync(regularPath)) {
            GlobalFonts.registerFromPath(regularPath, fontFamily);
          }
          if (existsSync(boldPath)) {
            GlobalFonts.registerFromPath(boldPath, fontFamily);
          }
          Logger.info('Font registration status', { hasFont: GlobalFonts.has(fontFamily), family: fontFamily });
        }
        if (!GlobalFonts.has(fontFamily)) {
          fontFamily = 'sans-serif';
        }
      } catch (e) {
        Logger.warn('Failed to register fonts. Falling back to system fonts.', {
          error: e instanceof Error ? e.message : 'Unknown error'
        });
        fontFamily = 'sans-serif';
      }

      // Use simpler 4:3 aspect ratio with more padding
      const width = 800;
      const height = 600;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      const { Chart: ChartJS } = await import('chart.js/auto');

      // Set global defaults to ensure solid black text with our registered font
      ChartJS.defaults.font.family = fontFamily;
      ChartJS.defaults.color = '#000000';
      ChartJS.defaults.devicePixelRatio = 2;

      // Remove overlay labels; usaremos um cabeçalho dedicado incorporado na imagem
      
      // Create background gradients with more vibrant colors
      const redZoneGradient = ctx.createLinearGradient(0, 0, 0, height);
      redZoneGradient.addColorStop(0, 'rgba(255, 0, 0, 0.2)');  // More vibrant red
      redZoneGradient.addColorStop(1, 'rgba(255, 0, 0, 0.2)');

      const orangeZoneGradient = ctx.createLinearGradient(0, 0, 0, height);
      orangeZoneGradient.addColorStop(0, 'rgba(255, 140, 0, 0.2)');  // More vibrant orange
      orangeZoneGradient.addColorStop(1, 'rgba(255, 140, 0, 0.2)');

      const yellowZoneGradient = ctx.createLinearGradient(0, 0, 0, height);
      yellowZoneGradient.addColorStop(0, 'rgba(255, 255, 0, 0.25)');  // More vibrant yellow
      yellowZoneGradient.addColorStop(1, 'rgba(255, 255, 0, 0.25)');

      const greenZoneGradient = ctx.createLinearGradient(0, 0, 0, height);
      greenZoneGradient.addColorStop(0, 'rgba(0, 255, 0, 0.2)');  // More vibrant green
      greenZoneGradient.addColorStop(1, 'rgba(0, 255, 0, 0.2)');

      // Background is now handled by the Chart.js plugin above

      const configuration: ChartConfiguration = {
        type: 'line',
        data: {
          labels: data.times.map(time => format(new Date(time), 'dd/MM')),
          datasets: [
            // MVRV line
            {
              label: 'MVRV',
              data: data.values,
              borderColor: 'rgb(0, 150, 255)',  // More vibrant blue
              borderWidth: 2.5,  // Slightly thicker line
              tension: 0.4,
              pointRadius: 0,
              fill: false,
              yAxisID: 'y',
              order: 10
            },
            // Background datasets for zones
            {
              label: 'Red Zone (>3.5)',
              data: Array(data.times.length).fill(4),
              backgroundColor: redZoneGradient,
              borderColor: 'transparent',
              fill: true,
              yAxisID: 'y',
              order: 1
            },
            {
              label: 'Orange Zone (3.0-3.5)',
              data: Array(data.times.length).fill(3.5),
              backgroundColor: orangeZoneGradient,
              borderColor: 'transparent',
              fill: true,
              yAxisID: 'y',
              order: 2
            },
            {
              label: 'Yellow Zone (1.0-3.0)',
              data: Array(data.times.length).fill(3.0),
              backgroundColor: yellowZoneGradient,
              borderColor: 'transparent',
              fill: true,
              yAxisID: 'y',
              order: 3
            },
            {
              label: 'Green Zone (<1.0)',
              data: Array(data.times.length).fill(1.0),
              backgroundColor: greenZoneGradient,
              borderColor: 'transparent',
              fill: true,
              yAxisID: 'y',
              order: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          animations: {
            colors: false,
            x: false,
            y: false
          },
          layout: {
            padding: {
              left: 60,
              right: 60,
              top: 80,
              bottom: 60
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Bitcoin MVRV - Últimos 180 dias',
              font: {
                size: 24,
                family: fontFamily,
                weight: 'bold'
              },
              color: '#000000',
              padding: 20
            },
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                font: {
                  family: fontFamily,
                  size: 14,
                  weight: 'bold'
                },
                color: '#000000'
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: {
                  family: fontFamily,
                  size: 12,
                  weight: 'bold'
                },
                color: '#000000',
                maxRotation: 0,
                minRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8,
                callback: function(val, index) {
                  const date = new Date(data.times[index]);
                  return date.getDate() === 1 ? format(date, 'MM/dd') : '';
                }
              }
            }
          }
        }
      };

      // @ts-ignore - Canvas context type mismatch, but it works
      new ChartJS(ctx, configuration);

      // Drástica mudança: renderizar as legendas (título e eixos) como SVG e rasterizar via resvg,
      // sobrepondo no PNG final para garantir fidelidade tipográfica em qualquer ambiente
      const svgTitle = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    @font-face { font-family: 'DejaVu Sans'; src: url('assets/fonts/DejaVuSans.ttf'); }
    .title { font: 700 24px '${fontFamily}', 'DejaVu Sans', sans-serif; fill: #000; }
  </style>
  <text x="${width/2}" y="40" text-anchor="middle" class="title">Bitcoin MVRV - Últimos 180 dias</text>
</svg>`;
      try {
        const resvg = new Resvg(svgTitle, { fitTo: { mode: 'original' } });
        const svgPng = resvg.render().asPng();
        const img = await loadImage(Buffer.from(svgPng));
        ctx.drawImage(img, 0, 0);
      } catch {}

      const buffer = canvas.toBuffer('image/png');
      Logger.info('Chart generated successfully');
      return buffer;
    } catch (error) {
      Logger.error('Failed to generate chart', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
} 