import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
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
  async generateMVRVChart(data: ChartData, headerLines?: string[]): Promise<Buffer> {
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

      // Use Twitter-friendly 16:9 aspect ratio to avoid aggressive cropping
      const width = 1200;
      const height = 675;
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
              left: 40,
              right: 40,
              top: 60,
              bottom: 40
            }
          },
          plugins: {
            title: {
              display: false
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
                  weight: 'bold'  // Make font bolder
                },
                color: '#000000'  // Pure black for text
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                font: {
                  family: fontFamily,
                  size: 10,
                  weight: 'bold'  // Make font bolder
                },
                color: '#000000',  // Pure black for text
                maxRotation: 45,
                minRotation: 45,
                autoSkip: false,
                callback: function(val, index) {
                  const date = new Date(data.times[index]);
                  
                  // Show only first day of each month
                  return date.getDate() === 1 ? format(date, 'dd/MM') : '';
                }
              }
            }
          }
        }
      };

      // @ts-ignore - Canvas context type mismatch, but it works
      new ChartJS(ctx, configuration);

      // Desenhar cabeçalho incorporando a frase dentro da imagem
      if (headerLines && headerLines.length) {
        const paddingX = 40;
        const top = 12;
        const headerHeight = 100;
        const left = paddingX;
        const right = width - paddingX;

        ctx.save();
        ctx.globalAlpha = 1;
        // faixa semi-opaca para melhor legibilidade
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.fillRect(left, top, right - left, headerHeight);
        ctx.strokeRect(left, top, right - left, headerHeight);

        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 24px ${Chart.defaults.font?.family || 'sans-serif'}`;
        const centerX = (left + right) / 2;
        const line1 = headerLines[0] || '';
        ctx.fillText(line1, centerX, top + 34);

        if (headerLines[1]) {
          ctx.font = `bold 18px ${Chart.defaults.font?.family || 'sans-serif'}`;
          ctx.fillText(headerLines[1], centerX, top + 72);
        }

        ctx.restore();
      }

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