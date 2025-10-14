import { Logger } from '../utils/logger';

interface GlobalData {
  data: {
    market_cap_percentage: {
      btc: number;
    };
  };
}

export class CoinGeckoService {
  private readonly BASE_URL = 'https://api.coingecko.com/api/v3';

  async getBitcoinDominance(): Promise<number> {
    try {
      Logger.info('Fetching Bitcoin dominance from CoinGecko');
      
      const response = await fetch(`${this.BASE_URL}/global`, {
        headers: {
          'User-Agent': 'ayello-twitter-bot/1.0 (+https://github.com/0xayello/twitter-bot.V2)',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CoinGecko API error: ${response.status} - ${errorText}`);
      }

      const data: GlobalData = await response.json();
      
      if (typeof data.data.market_cap_percentage?.btc !== 'number') {
        throw new Error('Invalid Bitcoin dominance data received');
      }

      const dominance = data.data.market_cap_percentage.btc;

      Logger.info('Successfully fetched Bitcoin dominance', {
        dominance: dominance
      });
      
      return dominance;
    } catch (error) {
      Logger.error('Failed to fetch Bitcoin dominance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error
      });
      throw error;
    }
  }
} 