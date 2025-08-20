import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { format } from 'date-fns';
import { Logger } from '../utils/logger';

interface ChartData {
  times: string[];
  values: number[];
}

export class ChartService {
  async generateMVRVChart(data: ChartData): Promise<Buffer> {
    let browser;
    try {
      Logger.info('Generating MVRV chart with Puppeteer/HTML', {
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

      const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; background: transparent; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .chart { width: ${width}px; height: ${height}px; position: relative; background: transparent; }
    .title { position: absolute; top: 30px; left: 50%; transform: translateX(-50%); font-size: 28px; font-weight: bold; color: #000; text-shadow: 2px 2px 4px rgba(255,255,255,0.8); }
    .y-label { position: absolute; font-size: 18px; font-weight: bold; color: #000; text-shadow: 1px 1px 2px rgba(255,255,255,0.8); }
    .x-label { position: absolute; font-size: 14px; font-weight: bold; color: #000; text-shadow: 1px 1px 2px rgba(255,255,255,0.8); }
  </style>
</head>
<body>
  <div class="chart">
    <div class="title">Bitcoin MVRV - Últimos 180 dias</div>
    
    <svg width="${width}" height="${height}" style="position: absolute; top: 0; left: 0;">
      <!-- Zonas coloridas -->
      <rect x="${chartArea.left}" y="${getY(1.0)}" width="${chartArea.width}" height="${chartArea.bottom - getY(1.0)}" fill="rgba(0, 255, 0, 0.15)" />
      <rect x="${chartArea.left}" y="${getY(3.0)}" width="${chartArea.width}" height="${getY(1.0) - getY(3.0)}" fill="rgba(255, 255, 0, 0.2)" />
      <rect x="${chartArea.left}" y="${getY(3.5)}" width="${chartArea.width}" height="${getY(3.0) - getY(3.5)}" fill="rgba(255, 140, 0, 0.15)" />
      <rect x="${chartArea.left}" y="${chartArea.top}" width="${chartArea.width}" height="${getY(3.5) - chartArea.top}" fill="rgba(255, 0, 0, 0.15)" />
      
      <!-- Grade Y -->
      ${[0,1,2,3,4].map(i => `<line x1="${chartArea.left}" y1="${getY(i)}" x2="${chartArea.right}" y2="${getY(i)}" stroke="rgba(0,0,0,0.1)" stroke-width="1" />`).join('')}
      
      <!-- Linha MVRV -->
      <polyline points="${linePoints}" fill="none" stroke="rgb(0, 150, 255)" stroke-width="3" />
    </svg>
    
    <!-- Rótulos Y -->
    ${[0,1,2,3,4].map(i => `<div class="y-label" style="right: ${width - chartArea.left + 25}px; top: ${getY(i) - 9}px;">${i}</div>`).join('')}
    
    <!-- Rótulos X -->
    ${xLabels.map(label => `<div class="x-label" style="left: ${label.x - 20}px; top: ${chartArea.bottom + 25}px;">${label.text}</div>`).join('')}
  </div>
</body>
</html>`;

      // Usar puppeteer-core + @sparticuz/chromium (compatível com Vercel)
      const executablePath = await chromium.executablePath();
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width, height, deviceScaleFactor: 2 },
        executablePath,
        headless: chromium.headless
      });
      
      const page = await browser.newPage();
      await page.setContent(html);
      
      const buffer = await page.screenshot({
        type: 'png',
        omitBackground: true,
        clip: { x: 0, y: 0, width, height }
      });
      
      await browser.close();
      
      Logger.info('Chart generated successfully with Puppeteer');
      return buffer;
    } catch (error) {
      if (browser) await browser.close();
      Logger.error('Failed to generate chart with Puppeteer', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
} 