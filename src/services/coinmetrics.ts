import { Logger } from '../utils/logger';
import { format, subDays } from 'date-fns';

interface CoinmetricsResponse {
  data: {
    asset: string;
    time: string;
    CapMVRVCur: string;
  }[];
  next_page_url?: string;
}

export class CoinmetricsService {
  private readonly BASE_URL = 'https://community-api.coinmetrics.io/v4';

  async getBitcoinMVRV(): Promise<number> {
    try {
      Logger.info('Fetching Bitcoin MVRV from Coinmetrics');
      
      // Buscar uma janela curta e pegar o último ponto disponível (evita dia sem dado)
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1);
      const startDate = subDays(endDate, 7);
      
      const url = `${this.BASE_URL}/timeseries/asset-metrics?` +
        `assets=btc&metrics=CapMVRVCur&` +
        `start_time=${format(startDate, 'yyyy-MM-dd')}&` +
        `end_time=${format(endDate, 'yyyy-MM-dd')}&pretty=true&page_size=1000`;
      
      // Using CapMVRVCur as the correct metric name for MVRV ratio
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ayello-twitter-bot/1.0 (+https://github.com/0xayello/twitter-bot.V2)',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Coinmetrics API error: ${response.status} - ${errorText}`);
      }

      const data: CoinmetricsResponse = await response.json();
      
      Logger.info('Coinmetrics raw response (window)', { count: data.data?.length ?? 0 });

      const lastPoint = data.data && data.data.length > 0 ? data.data[data.data.length - 1] : undefined;
      if (!lastPoint?.CapMVRVCur) {
        Logger.warn('No direct MVRV value received, falling back to history');
        const history = await this.getMVRVHistory();
        if (!history.values.length) {
          throw new Error('No MVRV value received');
        }
        const mvrv = history.values[history.values.length - 1];
        Logger.info('Successfully fetched Bitcoin MVRV from history fallback', {
          mvrv,
          time: history.times[history.times.length - 1]
        });
        return mvrv;
      }

      // Parse the MVRV string to number do último ponto
      const mvrv = parseFloat(lastPoint.CapMVRVCur);

      Logger.info('Successfully fetched Bitcoin MVRV', {
        mvrv,
        time: lastPoint.time
      });
      
      return mvrv;
    } catch (error) {
      Logger.error('Failed to fetch Bitcoin MVRV', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error
      });
      throw error;
    }
  }

  async getMVRVHistory(): Promise<{ times: string[], values: number[] }> {
    try {
      Logger.info('Fetching Bitcoin MVRV history from Coinmetrics');
      
      const endDate = new Date();
      const startDate = subDays(endDate, 1800);
      
      let url = `${this.BASE_URL}/timeseries/asset-metrics?` + 
        `assets=btc&metrics=CapMVRVCur&` +
        `start_time=${format(startDate, 'yyyy-MM-dd')}&` +
        `end_time=${format(endDate, 'yyyy-MM-dd')}&pretty=true&page_size=180`;

      Logger.info('Requesting full history', {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd')
      });

      let allData: { time: string; CapMVRVCur: string; }[] = [];
      
      // Fetch all pages
      while (url) {
        Logger.info('Requesting Coinmetrics data', { url });
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'ayello-twitter-bot/1.0 (+https://github.com/0xayello/twitter-bot.V2)',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Coinmetrics API error: ${response.status} - ${errorText}`);
        }

        const data: CoinmetricsResponse = await response.json();
        allData = [...allData, ...data.data];
        
        // Get next page URL if it exists
        url = data.next_page_url || '';
        
        Logger.info('Received page of data', {
          newDataPoints: data.data.length,
          totalDataPoints: allData.length,
          hasMorePages: !!url
        });
      }

      // Ordenar por data crescente para garantir cronologia correta
      allData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      Logger.info('Received all Coinmetrics history data', {
        totalDataPoints: allData.length,
        firstDate: allData[0]?.time,
        lastDate: allData[allData.length - 1]?.time
      });

      const result = {
        times: allData.map(d => d.time),
        values: allData.map(d => parseFloat(d.CapMVRVCur))
      };

      Logger.info('Processed MVRV history', {
        numberOfPoints: result.times.length,
        firstDate: result.times[0],
        lastDate: result.times[result.times.length - 1],
        daysCovered: Math.round((new Date(result.times[result.times.length - 1]).getTime() - 
                                new Date(result.times[0]).getTime()) / (1000 * 60 * 60 * 24))
      });

      return result;
    } catch (error) {
      Logger.error('Failed to fetch MVRV history', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
} 