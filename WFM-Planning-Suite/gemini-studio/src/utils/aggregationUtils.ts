import { HistoricalRow, ForecastRow, SizingResultRow, IntervalScheduleCoverage } from '../types';

export type AggregationLevel = 'interval' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export function getWeekLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setHours(0, 0, 0, 0);
    // Set to nearest Thursday: current date + 4 - current day number
    // make Sunday's day number 7
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    // Get first day of year
    const yearStart = new Date(d.getFullYear(), 0, 1);
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo < 10 ? '0' : ''}${weekNo}`;
  } catch {
    return dateStr;
  }
}

export function getMonthLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('default', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr.substring(0, 7);
  }
}

export function getYearLabel(dateStr: string): string {
  return dateStr.substring(0, 4) || 'Unknown';
}

// 1. Aggregate Historical/Cleansed Data
export interface AggregatedHistorical {
  label: string;
  rawVolume: number;
  cleansedVolume: number;
  avgAht: number;
  anomalyCount: number;
}

export function aggregateHistorical(
  data: HistoricalRow[],
  level: AggregationLevel,
  channel: string
): AggregatedHistorical[] {
  const filtered = data.filter(d => d.channel === channel);
  if (filtered.length === 0) return [];

  if (level === 'interval') {
    // Intraday average per interval
    const intervals = Array.from(new Set(filtered.map(d => d.interval))).sort();
    return intervals.map(inter => {
      const match = filtered.filter(d => d.interval === inter);
      const avgRaw = match.reduce((sum, d) => sum + d.volume, 0) / (match.length || 1);
      const avgCleansed = match.reduce((sum, d) => sum + (d.cleansedVolume !== undefined ? d.cleansedVolume : d.volume), 0) / (match.length || 1);
      const avgAht = match.reduce((sum, d) => sum + (d.cleansedAht !== undefined ? d.cleansedAht : d.aht), 0) / (match.length || 1);
      const anomalyCount = match.filter(d => d.isAnomaly).length;

      return {
        label: inter,
        rawVolume: Math.round(avgRaw * 10) / 10,
        cleansedVolume: Math.round(avgCleansed * 10) / 10,
        avgAht: Math.round(avgAht),
        anomalyCount
      };
    });
  }

  // Group by periods
  const groups: Record<string, { raw: number; cleansed: number; ahtSum: number; ahtCount: number; anomalies: number }> = {};

  filtered.forEach(d => {
    let key = d.date;
    if (level === 'weekly') key = getWeekLabel(d.date);
    else if (level === 'monthly') key = getMonthLabel(d.date);
    else if (level === 'yearly') key = getYearLabel(d.date);

    if (!groups[key]) {
      groups[key] = { raw: 0, cleansed: 0, ahtSum: 0, ahtCount: 0, anomalies: 0 };
    }

    groups[key].raw += d.volume;
    groups[key].cleansed += d.cleansedVolume !== undefined ? d.cleansedVolume : d.volume;
    groups[key].ahtSum += (d.cleansedAht !== undefined ? d.cleansedAht : d.aht) * (d.cleansedVolume !== undefined ? d.cleansedVolume : d.volume);
    groups[key].ahtCount += d.cleansedVolume !== undefined ? d.cleansedVolume : d.volume;
    if (d.isAnomaly) {
      groups[key].anomalies++;
    }
  });

  return Object.keys(groups).sort().map(key => {
    const g = groups[key];
    const avgAht = g.ahtCount > 0 ? g.ahtSum / g.ahtCount : 0;
    return {
      label: key,
      rawVolume: Math.round(g.raw),
      cleansedVolume: Math.round(g.cleansed),
      avgAht: Math.round(avgAht),
      anomalyCount: g.anomalies
    };
  });
}

// 2. Aggregate Forecasting Data
export interface AggregatedForecast {
  label: string;
  actualVolume: number;
  forecastVolume: number;
  variance: number;
}

export function aggregateForecast(
  historical: HistoricalRow[],
  forecast: ForecastRow[],
  level: AggregationLevel,
  channel: string
): AggregatedForecast[] {
  // If interval, forecast might match future dates, but we want high-level grouping.
  // By default for forecast view, let's group by daily, weekly, monthly, yearly
  const cleanHist = historical.filter(d => d.channel === channel);
  const cleanForecast = forecast.filter(d => d.channel === channel);

  // Group keys for both actual and forecast
  const actualGroups: Record<string, number> = {};
  const forecastGroups: Record<string, number> = {};

  cleanHist.forEach(d => {
    let key = d.date;
    if (level === 'weekly') key = getWeekLabel(d.date);
    else if (level === 'monthly') key = getMonthLabel(d.date);
    else if (level === 'yearly') key = getYearLabel(d.date);

    actualGroups[key] = (actualGroups[key] || 0) + (d.cleansedVolume !== undefined ? d.cleansedVolume : d.volume);
  });

  cleanForecast.forEach(d => {
    let key = d.date;
    if (level === 'weekly') key = getWeekLabel(d.date);
    else if (level === 'monthly') key = getMonthLabel(d.date);
    else if (level === 'yearly') key = getYearLabel(d.date);

    forecastGroups[key] = (forecastGroups[key] || 0) + d.volume;
  });

  // Combine keys to build a chronological timeline
  const allKeys = Array.from(new Set([...Object.keys(actualGroups), ...Object.keys(forecastGroups)])).sort();

  // For chart clarity, if interval level is selected, we map 7 days actual vs 7 days forecast by day or interval.
  if (level === 'interval') {
    // If interval, group by HH:MM interval average
    const intervals = Array.from(new Set([...cleanHist.map(d => d.interval), ...cleanForecast.map(d => d.interval)])).sort();
    return intervals.map(inter => {
      const matchHist = cleanHist.filter(d => d.interval === inter);
      const matchForecast = cleanForecast.filter(d => d.interval === inter);

      const avgHist = matchHist.reduce((sum, d) => sum + (d.cleansedVolume !== undefined ? d.cleansedVolume : d.volume), 0) / (matchHist.length || 1);
      const avgForecast = matchForecast.reduce((sum, d) => sum + d.volume, 0) / (matchForecast.length || 1);

      return {
        label: inter,
        actualVolume: Math.round(avgHist * 10) / 10,
        forecastVolume: Math.round(avgForecast * 10) / 10,
        variance: Math.round((avgForecast - avgHist) * 10) / 10
      };
    });
  }

  return allKeys.map(key => {
    const act = actualGroups[key] || 0;
    const fore = forecastGroups[key] || 0;
    return {
      label: key,
      actualVolume: Math.round(act),
      forecastVolume: Math.round(fore),
      variance: Math.round(fore - act)
    };
  });
}

// 3. Aggregate Sizing Results
export interface AggregatedSizing {
  label: string;
  volume: number;
  workloadHrs: number;
  rawRequired: number;
  finalRequired: number;
}

export function aggregateSizing(
  data: SizingResultRow[],
  level: AggregationLevel,
  channel: string
): AggregatedSizing[] {
  const filtered = data.filter(d => d.channel === channel);
  if (filtered.length === 0) return [];

  if (level === 'interval') {
    const intervals = Array.from(new Set(filtered.map(d => d.interval))).sort();
    return intervals.map(inter => {
      const match = filtered.filter(d => d.interval === inter);
      const avgVol = match.reduce((sum, d) => sum + d.volume, 0) / (match.length || 1);
      const avgWorkload = match.reduce((sum, d) => sum + d.workloadHrs, 0) / (match.length || 1);
      const avgRaw = match.reduce((sum, d) => sum + d.rawRequiredAgents, 0) / (match.length || 1);
      const avgFinal = match.reduce((sum, d) => sum + d.finalRequiredAgents, 0) / (match.length || 1);

      return {
        label: inter,
        volume: Math.round(avgVol * 10) / 10,
        workloadHrs: Math.round(avgWorkload * 10) / 10,
        rawRequired: Math.round(avgRaw),
        finalRequired: Math.round(avgFinal)
      };
    });
  }

  const groups: Record<string, { vol: number; workload: number; rawRequiredSum: number; finalRequiredSum: number; count: number }> = {};

  filtered.forEach(d => {
    let key = d.date;
    if (level === 'weekly') key = getWeekLabel(d.date);
    else if (level === 'monthly') key = getMonthLabel(d.date);
    else if (level === 'yearly') key = getYearLabel(d.date);

    if (!groups[key]) {
      groups[key] = { vol: 0, workload: 0, rawRequiredSum: 0, finalRequiredSum: 0, count: 0 };
    }

    groups[key].vol += d.volume;
    groups[key].workload += d.workloadHrs;
    // For staffing counts over grouped periods, we take the average or peak requirement
    // Real planners look at PEAK or average required staffing per interval in that period.
    // Let's use the average required staffing per interval to show accurate capacity curves.
    groups[key].rawRequiredSum += d.rawRequiredAgents;
    groups[key].finalRequiredSum += d.finalRequiredAgents;
    groups[key].count++;
  });

  return Object.keys(groups).sort().map(key => {
    const g = groups[key];
    return {
      label: key,
      volume: Math.round(g.vol),
      workloadHrs: Math.round(g.workload * 10) / 10,
      rawRequired: Math.round(g.rawRequiredSum / (g.count || 1)),
      finalRequired: Math.round(g.finalRequiredSum / (g.count || 1))
    };
  });
}
