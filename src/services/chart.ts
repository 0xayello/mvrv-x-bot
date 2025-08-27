import { Resvg } from '@resvg/resvg-js';
import { format } from 'date-fns';
import { Logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

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

      const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf');
      const fontFamily = 'EmbedDejaVu';
      let fontCss = '';
      try {
        const fontBuf = fs.readFileSync(fontPath);
        const base64 = fontBuf.toString('base64');
        fontCss = `@font-face { font-family: '${fontFamily}'; src: url(data:font/ttf;base64,${base64}) format('truetype'); font-weight: 400; font-style: normal; }`;
      } catch {}

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>${fontCss}</style>
  </defs>
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

      try {
        const resvgOnly = new Resvg(svg, {
          fitTo: { mode: 'original' },
          font: { loadSystemFonts: false, defaultFontFamily: fontFamily, fontFiles: [fontPath] }
        });
        const pngOnly = resvgOnly.render().asPng();
        Logger.info('Chart generated successfully with Resvg-only');
        return Buffer.from(pngOnly);
      } catch (e) {
        Logger.warn('Resvg failed, fallback to Canvas', { error: e instanceof Error ? e.message : String(e) });
      }

      // Fallback extremo: render manual via Canvas (@napi-rs/canvas)
      try {
        const canvas = createCanvas(width, height);
        GlobalFonts.registerFromPath(fontPath, fontFamily);
        const ctx = canvas.getContext('2d');
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
        // grid Y
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for (let i=0;i<=4;i++){ ctx.beginPath(); ctx.moveTo(chartArea.left, getY(i)); ctx.lineTo(chartArea.right, getY(i)); ctx.stroke(); }
        // linha
        ctx.strokeStyle = 'rgb(0,150,255)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        data.values.forEach((v,i)=>{ const x=getX(i), y=getY(Math.max(yMin, Math.min(yMax, v))); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
        ctx.stroke();
        // título
        ctx.font = '400 24px "'+fontFamily+'"';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText('Bitcoin MVRV - Últimos 5 anos', width/2, 50);
        // rótulos Y
        ctx.font = '400 18px "'+fontFamily+'"';
        ctx.textAlign = 'right';
        for (let i=0;i<=4;i++){ ctx.fillText(String(i), chartArea.left-20, getY(i)+6); }
        // rótulos X
        ctx.font = '400 14px "'+fontFamily+'"';
        ctx.textAlign = 'center';
        xLabels.forEach(l => ctx.fillText(l.text, l.x, chartArea.bottom+25));
        // labels zonas (stroke+fill)
        const drawOL=(t:string,y:number)=>{ ctx.lineWidth=4; ctx.strokeStyle='rgba(255,255,255,0.95)'; ctx.strokeText(t, chartArea.left+10, y); ctx.fillStyle='#000'; ctx.fillText(t, chartArea.left+10, y); };
        drawOL('zona de compra', getY(0.5));
        drawOL('neutro', getY(2.0));
        drawOL('alto', getY(3.25));
        drawOL('alarmante', getY(3.75));
        return canvas.toBuffer('image/png');
      } catch (e) {
        Logger.error('Canvas fallback failed', { error: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    } catch (error) {
      Logger.error('Failed to generate chart with Resvg', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
} 