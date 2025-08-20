import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
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

      // Restore original Twitter-friendly 16:9 aspect ratio
      const width = 1200;
      const height = 675;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // MUDANÇA DRÁSTICA: Renderização 100% via Canvas puro
      // Elimina qualquer problema de Chart.js com fontes/transparência
      
      // 1. Configurar canvas com fundo transparente
      ctx.save();
      ctx.globalAlpha = 1;
      
      // 2. Definir área do gráfico
      const padding = { left: 80, right: 40, top: 80, bottom: 60 };
      const chartArea = {
        left: padding.left,
        top: padding.top,
        right: width - padding.right,
        bottom: height - padding.bottom,
        width: width - padding.left - padding.right,
        height: height - padding.top - padding.bottom
      };
      
      // 3. Desenhar zonas coloridas
      const yMin = 0;
      const yMax = 4.5;
      const getY = (value: number) => chartArea.bottom - ((value - yMin) / (yMax - yMin)) * chartArea.height;
      
      // Zona verde (0-1.0)
      ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
      ctx.fillRect(chartArea.left, getY(1.0), chartArea.width, chartArea.bottom - getY(1.0));
      
      // Zona amarela (1.0-3.0)
      ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
      ctx.fillRect(chartArea.left, getY(3.0), chartArea.width, getY(1.0) - getY(3.0));
      
      // Zona laranja (3.0-3.5)
      ctx.fillStyle = 'rgba(255, 140, 0, 0.15)';
      ctx.fillRect(chartArea.left, getY(3.5), chartArea.width, getY(3.0) - getY(3.5));
      
      // Zona vermelha (3.5+)
      ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
      ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, getY(3.5) - chartArea.top);
      
      // 4. Desenhar grade Y
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = getY(i);
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
      }
      
      // 5. Desenhar linha MVRV
      if (data.values.length > 0) {
        const getX = (index: number) => chartArea.left + (index / (data.values.length - 1)) * chartArea.width;
        
        ctx.strokeStyle = 'rgb(0, 150, 255)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        for (let i = 0; i < data.values.length; i++) {
          const x = getX(i);
          const y = getY(Math.max(yMin, Math.min(yMax, data.values[i])));
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      
      // 6. Desenhar texto com fallbacks robustos
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Título principal
      ctx.font = `bold 24px ${fontFamily}`;
      ctx.fillText('Bitcoin MVRV - Últimos 180 dias', width / 2, 40);
      
      // Rótulos do eixo Y
      ctx.textAlign = 'right';
      ctx.font = `bold 14px ${fontFamily}`;
      for (let i = 0; i <= 4; i++) {
        ctx.fillText(i.toString(), chartArea.left - 10, getY(i));
      }
      
      // Rótulos do eixo X (meses)
      ctx.textAlign = 'center';
      ctx.font = `bold 12px ${fontFamily}`;
      for (let i = 0; i < data.times.length; i += Math.ceil(data.times.length / 6)) {
        if (i < data.times.length) {
          const date = new Date(data.times[i]);
          const x = chartArea.left + (i / (data.values.length - 1)) * chartArea.width;
          ctx.fillText(format(date, 'dd/MM'), x, chartArea.bottom + 30);
        }
      }
      
      ctx.restore();

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