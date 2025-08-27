import { createCanvas } from '@napi-rs/canvas';
import { format } from 'date-fns';
import { Logger } from '../utils/logger';


interface ChartData {
  times: string[];
  values: number[];
}

export class ChartService {
  async generateMVRVChart(data: ChartData): Promise<Buffer> {
    try {
      Logger.info('Generating MVRV chart with Canvas', {
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
      const clamp = (v: number) => Math.max(yMin, Math.min(yMax, v));
      const getY = (value: number) => chartArea.bottom - ((value - yMin) / (yMax - yMin)) * chartArea.height;
      const getX = (index: number) => chartArea.left + (index / (data.values.length - 1)) * chartArea.width;

      const monthStep = Math.ceil(data.times.length / 6);
      const xLabels: { x: number; text: string }[] = [];
      for (let i = 0; i < data.times.length; i += monthStep) {
        const d = new Date(data.times[i]);
        xLabels.push({ x: getX(i), text: format(d, 'dd/MM') });
      }

      // Use system fonts only - no custom font registration
      const fontFamily = 'Arial';
      Logger.info('Using system font only', { fontFamily });

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.globalAlpha = 1;

      // fundo
      ctx.fillStyle = '#e9ecef';
      ctx.fillRect(0, 0, width, height);

      // zonas
      ctx.fillStyle = 'rgba(220,53,69,0.25)';
      ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, getY(3.5) - chartArea.top);
      ctx.fillStyle = 'rgba(255,102,0,0.22)';
      ctx.fillRect(chartArea.left, getY(3.5), chartArea.width, getY(3.0) - getY(3.5));
      ctx.fillStyle = 'rgba(255,193,7,0.20)';
      ctx.fillRect(chartArea.left, getY(3.0), chartArea.width, getY(1.0) - getY(3.0));
      ctx.fillStyle = 'rgba(40,167,69,0.25)';
      ctx.fillRect(chartArea.left, getY(1.0), chartArea.width, chartArea.bottom - getY(1.0));

      // grade Y
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(chartArea.left, getY(i)); ctx.lineTo(chartArea.right, getY(i)); ctx.stroke(); }

      // linha MVRV
      ctx.strokeStyle = 'rgb(0,150,255)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      data.values.forEach((v, i) => { const x = getX(i), y = getY(clamp(v)); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();

      // título - texto muito mais visível
      ctx.font = 'bold 28px ' + fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      // Outline branco grosso
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText('Bitcoin MVRV - Últimos 5 anos', width / 2, 50);
      // Texto preto por cima
      ctx.fillStyle = '#000000';
      ctx.fillText('Bitcoin MVRV - Últimos 5 anos', width / 2, 50);

      // rótulos Y - números maiores e mais visíveis
      ctx.font = 'bold 20px ' + fontFamily;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) { 
        ctx.lineWidth = 5; 
        ctx.strokeStyle = '#ffffff'; 
        ctx.strokeText(String(i), chartArea.left - 20, getY(i)); 
        ctx.fillStyle = '#000000'; 
        ctx.fillText(String(i), chartArea.left - 20, getY(i)); 
      }

      // rótulos X - datas maiores e mais visíveis  
      ctx.font = 'bold 16px ' + fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      xLabels.forEach(l => { 
        ctx.lineWidth = 4; 
        ctx.strokeStyle = '#ffffff'; 
        ctx.strokeText(l.text, l.x, chartArea.bottom + 25); 
        ctx.fillStyle = '#000000'; 
        ctx.fillText(l.text, l.x, chartArea.bottom + 25); 
      });

      // labels zonas - textos maiores e mais contrastantes
      const drawOL = (t: string, y: number) => {
        ctx.lineWidth = 5; 
        ctx.strokeStyle = '#ffffff'; 
        ctx.strokeText(t, chartArea.left + 10, y);
        ctx.fillStyle = '#000000'; 
        ctx.fillText(t, chartArea.left + 10, y);
      };
      ctx.font = 'bold 18px ' + fontFamily;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawOL('zona de compra', getY(0.5));
      drawOL('neutro', getY(2.0));
      drawOL('alto', getY(3.25));
      drawOL('alarmante', getY(3.75));

      return canvas.toBuffer('image/png');
    } catch (error) {
      Logger.error('Failed to generate chart (Canvas pipeline)', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
} 