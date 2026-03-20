import { Logger } from '../utils/logger';

export interface FngDataPoint {
  value: number;
  classification: string;
  timestamp: string; // ISO date
}

export interface FngHistory {
  times: string[];
  values: number[];
}

export type FngClass = 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';

export function classifyFng(value: number): FngClass {
  if (value <= 24) return 'extreme_fear';
  if (value <= 44) return 'fear';
  if (value <= 55) return 'neutral';
  if (value <= 74) return 'greed';
  return 'extreme_greed';
}

export class FearGreedService {
  /**
   * Fetch last N days of Fear & Greed data.
   * Data[0] is the most recent.
   */
  async getRecent(days: number = 8): Promise<FngDataPoint[]> {
    const url = `https://api.alternative.me/fng/?limit=${days}&format=json`;
    Logger.info('Fetching Fear & Greed data', { url, days });

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`FNG API error: ${resp.status}`);

    const json = await resp.json();
    const data: FngDataPoint[] = json.data.map((e: any) => ({
      value: parseInt(e.value),
      classification: e.value_classification,
      timestamp: new Date(parseInt(e.timestamp) * 1000).toISOString().slice(0, 10),
    }));

    Logger.info('FNG data fetched', {
      points: data.length,
      current: data[0]?.value,
      currentClass: data[0]?.classification,
    });

    return data; // index 0 = most recent
  }

  /**
   * Fetch full history for chart (up to 1000 days).
   * Returns data sorted oldest-first.
   */
  async getHistory(): Promise<FngHistory> {
    const url = 'https://api.alternative.me/fng/?limit=1000&format=json';
    Logger.info('Fetching FNG history');

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`FNG API error: ${resp.status}`);

    const json = await resp.json();
    const raw = json.data.reverse(); // oldest first

    const times = raw.map((e: any) =>
      new Date(parseInt(e.timestamp) * 1000).toISOString().slice(0, 10)
    );
    const values = raw.map((e: any) => parseInt(e.value));

    Logger.info('FNG history fetched', {
      points: values.length,
      first: times[0],
      last: times[times.length - 1],
    });

    return { times, values };
  }

  /**
   * Decide if we should post today.
   * Rules:
   *   1. Neutro (45-55) never posts
   *   2. Only post if classification CHANGED vs yesterday
   *   3. Max 1/week: skip if today's class already appeared in the last 7 days
   */
  shouldPost(recent: FngDataPoint[]): { post: boolean; reason: string; todayClass: FngClass; value: number } {
    if (recent.length < 2) {
      return { post: false, reason: 'Not enough data', todayClass: 'neutral', value: 0 };
    }

    const todayValue = recent[0].value;
    const todayClass = classifyFng(todayValue);
    const yesterdayClass = classifyFng(recent[1].value);

    // Rule 1: skip neutral
    if (todayClass === 'neutral') {
      return { post: false, reason: 'Neutral zone — skip', todayClass, value: todayValue };
    }

    // Rule 2: no change
    if (todayClass === yesterdayClass) {
      return { post: false, reason: `No classification change (${todayClass})`, todayClass, value: todayValue };
    }

    // Rule 3: max 1/week — check if today's class appeared in the last 7 days (excluding today)
    const last7 = recent.slice(1, 8); // days 1-7
    const recentClasses = last7.map(d => classifyFng(d.value));
    if (recentClasses.includes(todayClass)) {
      return {
        post: false,
        reason: `Class "${todayClass}" already appeared in last 7 days — max 1/week`,
        todayClass,
        value: todayValue,
      };
    }

    return {
      post: true,
      reason: `Classification changed: ${yesterdayClass} → ${todayClass}`,
      todayClass,
      value: todayValue,
    };
  }
}
