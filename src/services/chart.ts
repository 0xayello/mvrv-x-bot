// VERSION DIAGNÓSTICO - Para identificar o problema das legendas

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
      Logger.info('=== DIAGNÓSTICO: Iniciando geração do gráfico ===');
      
      // DIAGNÓSTICO 1: Verificar fontes disponíveis
      let fontFamily = 'Arial'; // Começar com fonte do sistema
      try {
        Logger.info('DIAGNÓSTICO: Verificando fontes disponíveis');
        
        const fontsDir = join(process.cwd(), 'assets', 'fonts');
        const dejaVuPath = join(fontsDir, 'DejaVuSans.ttf');
        
        Logger.info('DIAGNÓSTICO: Status dos arquivos de fonte', {
          fontsDir,
          dejaVuPath,
          dejaVuExists: existsSync(dejaVuPath),
          globalFontsAvailable: typeof GlobalFonts !== 'undefined'
        });
        
        // Tentar registrar DejaVu Sans
        if (existsSync(dejaVuPath)) {
          try {
            GlobalFonts.registerFromPath(dejaVuPath, 'DejaVu Sans');
            fontFamily = 'DejaVu Sans';
            Logger.info('DIAGNÓSTICO: DejaVu Sans registrada com sucesso');
          } catch (e) {
            Logger.warn('DIAGNÓSTICO: Falha ao registrar DejaVu Sans', { error: e });
          }
        }
        
        Logger.info('DIAGNÓSTICO: Fontes registradas', {
          fontFamily,
          hasFont: GlobalFonts.has(fontFamily),
          allFamilies: GlobalFonts.families
        });
        
      } catch (e) {
        Logger.error('DIAGNÓSTICO: Erro na configuração de fontes', { error: e });
        fontFamily = 'Arial';
      }

      // DIAGNÓSTICO 2: Canvas e configuração
      const width = 800;
      const height = 600;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      Logger.info('DIAGNÓSTICO: Canvas criado', { width, height });

      // DIAGNÓSTICO 3: Forçar fundo branco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      Logger.info('DIAGNÓSTICO: Fundo branco aplicado');

      // DIAGNÓSTICO 4: Teste de texto direto no canvas
      ctx.save();
      ctx.fillStyle = '#ff0000'; // Vermelho para alta visibilidade
      ctx.font = `bold 24px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText('TESTE DIAGNÓSTICO - ESTE TEXTO DEVE APARECER', width / 2, 50);
      ctx.fillStyle = '#0000ff'; // Azul
      ctx.font = `16px ${fontFamily}`;
      ctx.fillText(`Fonte: ${fontFamily}`, width / 2, 80);
      ctx.restore();
      Logger.info('DIAGNÓSTICO: Texto de teste desenhado diretamente no canvas');

      const { Chart: ChartJS } = await import('chart.js/auto');

      // DIAGNÓSTICO 5: Configurar Chart.js
      ChartJS.defaults.font.family = fontFamily;
      ChartJS.defaults.color = '#000000';
      ChartJS.defaults.devicePixelRatio = 1; // Reduzir para simplificar
      
      Logger.info('DIAGNÓSTICO: Chart.js configurado', {
        defaultFont: ChartJS.defaults.font.family,
        defaultColor: ChartJS.defaults.color,
        devicePixelRatio: ChartJS.defaults.devicePixelRatio
      });

      // Configuração simplificada para diagnóstico
      const configuration: ChartConfiguration = {
        type: 'line',
        data: {
          labels: data.times.map((time, i) => i % 30 === 0 ? format(new Date(time), 'MM/dd') : ''),
          datasets: [
            {
              label: 'MVRV',
              data: data.values,
              borderColor: 'rgb(0, 150, 255)',
              borderWidth: 3,
              tension: 0.4,
              pointRadius: 0,
              fill: false,
            }
          ]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          animation: false,
          layout: {
            padding: {
              left: 80,
              right: 80,
              top: 120, // Mais espaço para o texto de teste
              bottom: 80
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'DIAGNÓSTICO: Bitcoin MVRV - Texto do Título',
              font: {
                size: 28,
                family: fontFamily,
                weight: 'bold'
              },
              color: '#000000',
              padding: 30
            },
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.2)'
              },
              ticks: {
                font: {
                  family: fontFamily,
                  size: 16,
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
                  size: 14,
                  weight: 'bold'
                },
                color: '#000000'
              }
            }
          }
        }
      };

      Logger.info('DIAGNÓSTICO: Configuração do Chart.js preparada');

      // @ts-ignore
      new ChartJS(ctx, configuration);
      
      Logger.info('DIAGNÓSTICO: Chart.js renderizado');

      // DIAGNÓSTICO 6: Texto adicional após Chart.js para verificar se sobrescreve
      ctx.save();
      ctx.fillStyle = '#00ff00'; // Verde para contrastar
      ctx.font = `bold 20px ${fontFamily}`;
      ctx.textAlign = 'left';
      ctx.fillText('APÓS CHART.JS - ESTE TEXTO TAMBÉM DEVE APARECER', 20, height - 30);
      ctx.restore();
      Logger.info('DIAGNÓSTICO: Texto pós-Chart.js desenhado');

      const buffer = canvas.toBuffer('image/png');
      Logger.info('=== DIAGNÓSTICO: Gráfico concluído com sucesso ===');
      
      return buffer;
    } catch (error) {
      Logger.error('DIAGNÓSTICO: Falha na geração do gráfico', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
} 