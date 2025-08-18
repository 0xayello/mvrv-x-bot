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
      let fontFamily = 'Open Sans';
      try {
        const fontsDir = join(process.cwd(), 'assets', 'fonts');
        const regularPath = join(fontsDir, 'OpenSans-Regular.ttf');
        const boldPath = join(fontsDir, 'OpenSans-Bold.ttf');
        if (!GlobalFonts.has(fontFamily)) {
          if (existsSync(regularPath)) {
            GlobalFonts.registerFromPath(regularPath, fontFamily);
          }
          if (existsSync(boldPath)) {
            GlobalFonts.registerFromPath(boldPath, fontFamily);
          }
          Logger.info('Font registration status', { hasFont: GlobalFonts.has(fontFamily) });
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

      const width = 800;
      const height = 400;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      const { Chart: ChartJS } = await import('chart.js/auto');

      // Set global defaults to ensure solid black text with our registered font
      ChartJS.defaults.font.family = fontFamily;
      ChartJS.defaults.color = '#000000';

      // Ensure a fully opaque background after Chart.js clears the canvas
      const backgroundFillPlugin = {
        id: 'background_fill',
        beforeDraw: (chart: any) => {
          const { ctx: c, width: w, height: h } = chart;
          c.save();
          c.globalCompositeOperation = 'destination-over';
          c.fillStyle = '#ffffff';
          c.fillRect(0, 0, w, h);
          c.restore();
        }
      };
      ChartJS.register(backgroundFillPlugin);
      
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
              yAxisID: 'y'
            },
            // Background datasets for zones
            {
              label: 'Red Zone (>3.5)',
              data: Array(data.times.length).fill(4),
              backgroundColor: redZoneGradient,
              borderColor: 'transparent',
              fill: true,
              yAxisID: 'y'
            },
            {
              label: 'Orange Zone (3.0-3.5)',
              data: Array(data.times.length).fill(3.5),
              backgroundColor: orangeZoneGradient,
              borderColor: 'transparent',
              fill: true,
              yAxisID: 'y'
            },
            {
              label: 'Yellow Zone (1.0-3.0)',
              data: Array(data.times.length).fill(3.0),
              backgroundColor: yellowZoneGradient,
              borderColor: 'transparent',
              fill: true,
              yAxisID: 'y'
            },
            {
              label: 'Green Zone (<1.0)',
              data: Array(data.times.length).fill(1.0),
              backgroundColor: greenZoneGradient,
              borderColor: 'transparent',
              fill: true,
              yAxisID: 'y'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              left: 20,
              right: 20,
              top: 30,
              bottom: 20
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Bitcoin MVRV - Últimos 180 dias',
              font: {
                size: 20,
                family: fontFamily,
                weight: 'bold'  // Make font bolder
              },
              color: '#000000',  // Pure black for text
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