import { HistoricalRow, CleansingMethod, ImputationMethod } from '../types';

/**
 * Generates realistic contact center historical data for planner simulation.
 * Includes typical daily curves (double-peak morning/afternoon), weekend reductions, and anomalies.
 */
export function generateSampleHistoricalData(
  days: number = 30, 
  channels: string[] = ['voice', 'chat', 'email']
): HistoricalRow[] {
  const data: HistoricalRow[] = [];
  const intervals = [
    '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30',
    '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30',
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
  ];

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Seed curves
  // Daily curve (volume weight by interval index 0 to 47)
  const getDailyWeight = (idx: number) => {
    if (idx < 14) return 0.05 + (idx / 14) * 0.15; // 12am to 7am: very low
    if (idx >= 14 && idx < 20) return 0.2 + ((idx - 14) / 6) * 0.6; // 7am to 10am: morning surge
    if (idx >= 20 && idx < 26) return 0.8 - ((idx - 20) / 6) * 0.2; // 10am to 1pm: lunch dip
    if (idx >= 26 && idx < 34) return 0.6 + ((idx - 26) / 8) * 0.35; // 1pm to 5pm: afternoon peak
    return 0.95 - ((idx - 34) / 13) * 0.9; // 5pm to 11:30pm: decline
  };

  const getChannelBase = (chan: string) => {
    switch (chan) {
      case 'voice': return { vol: 120, aht: 280 };
      case 'chat': return { vol: 80, aht: 360 };
      case 'email': return { vol: 40, aht: 500 };
      case 'complaint': return { vol: 15, aht: 650 };
      case 'social_media': return { vol: 30, aht: 240 };
      case 'outbound': return { vol: 50, aht: 180 };
      default: return { vol: 50, aht: 300 };
    }
  };

  let idCounter = 1;

  for (let d = 0; d < days; d++) {
    const currentDate = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendFactor = isWeekend ? 0.35 : 1.0;

    channels.forEach(chan => {
      const base = getChannelBase(chan);
      intervals.forEach((inter, idx) => {
        const dailyWeight = getDailyWeight(idx);
        // Base Volume
        let volume = Math.round(
          base.vol * dailyWeight * weekendFactor * (0.85 + Math.random() * 0.3)
        );
        // Base AHT
        let aht = Math.round(
          base.aht * (0.9 + Math.random() * 0.2)
        );

        // Inject some intentional anomalies/outliers for cleansing demo
        // e.g. Day 10, idx 18 (9:00 AM) Voice has a massive spike (telephony outage / system storm)
        let isAnomaly = false;
        let anomalyReason = '';

        if (d === 10 && idx === 18 && chan === 'voice') {
          volume = Math.round(volume * 5.2);
          aht = Math.round(aht * 2.2);
          isAnomaly = true;
          anomalyReason = 'Outage spike';
        }
        // Day 18, idx 24 (12:00 PM) Chat has zero volume (system glitch)
        else if (d === 18 && idx === 24 && chan === 'chat') {
          volume = 0;
          isAnomaly = true;
          anomalyReason = 'Reporting zero drop';
        }
        // Random moderate anomalies (e.g., promotional campaigns or marketing events)
        else if (Math.random() < 0.005) {
          volume = Math.round(volume * 2.8);
          isAnomaly = true;
          anomalyReason = 'Campaign traffic spike';
        }

        const timestamp = `${dateStr}T${inter}:00`;

        data.push({
          id: `h-${idCounter++}`,
          timestamp,
          date: dateStr,
          time: inter,
          interval: inter,
          volume,
          aht,
          channel: chan,
          isAnomaly,
          anomalyReason
        });
      });
    });
  }

  return data;
}

/**
 * Recommends the best cleansing method based on dataset metrics.
 */
export function recommendCleansingMethod(data: HistoricalRow[]): {
  method: CleansingMethod;
  explanation: string;
} {
  if (data.length === 0) {
    return { method: 'none', explanation: 'No data available to analyze.' };
  }

  // Calculate some properties of volume
  const volumes = data.map(d => d.volume);
  const n = volumes.length;
  const mean = volumes.reduce((sum, v) => sum + v, 0) / n;
  const std = Math.sqrt(volumes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n);
  const cv = mean > 0 ? std / mean : 0; // Coefficient of Variation

  if (cv > 1.2) {
    return {
      method: 'moving_median',
      explanation: 'Highly seasonal / variable data. Rolling Median is recommended as it isolates short spike anomalies while preserving daily peaking patterns.'
    };
  } else if (cv > 0.6) {
    return {
      method: 'iqr',
      explanation: 'Moderate dispersion. Interquartile Range (IQR) is recommended to clip reporting outages and severe glitches safely without skewing standard deviations.'
    };
  } else {
    return {
      method: 'zscore',
      explanation: 'Stable baseline distributions. Z-Score is highly efficient at targeting standard statistical outliers (at 2.5σ thresholds).'
    };
  }
}

/**
 * Cleanses data and marks anomalies using the specified method.
 */
export function detectAndCleanseAnomalies(
  data: HistoricalRow[], 
  method: CleansingMethod,
  thresholdFactor: number = 2.5, // e.g., Z-Score limit, or IQR multiplier
  imputationMethod: ImputationMethod = 'mean'
): HistoricalRow[] {
  if (method === 'none') {
    return data.map(d => ({
      ...d,
      isAnomaly: false,
      anomalyReason: undefined,
      cleansedVolume: d.volume,
      cleansedAht: d.aht
    }));
  }

  // Group by channel and interval to perform statistical calculations within peers
  // Standardizing comparisons across matching timeslots is crucial (e.g. comparing 9am to other 9ams, rather than 9am to midnight)
  const channelAndIntervalGroups: Record<string, HistoricalRow[]> = {};
  data.forEach(row => {
    const key = `${row.channel}_${row.interval}`;
    if (!channelAndIntervalGroups[key]) {
      channelAndIntervalGroups[key] = [];
    }
    channelAndIntervalGroups[key].push(row);
  });

  const updatedRowsMap = new Map<string, HistoricalRow>();

  Object.entries(channelAndIntervalGroups).forEach(([key, group]) => {
    // Sort group by date to ensure proper sequence for rolling median and forward-fill
    const sortedByDate = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const volumes = sortedByDate.map(g => g.volume);
    const ahts = sortedByDate.map(g => g.aht);
    const n = sortedByDate.length;
    
    if (n < 3) {
      // Not enough sample points, do not cleanse
      sortedByDate.forEach(row => {
        updatedRowsMap.set(row.id, {
          ...row,
          cleansedVolume: row.volume,
          cleansedAht: row.aht
        });
      });
      return;
    }

    // Baseline Group Calculations
    const meanVol = volumes.reduce((a, b) => a + b, 0) / n;
    const stdVol = Math.sqrt(volumes.reduce((sum, v) => sum + Math.pow(v - meanVol, 2), 0) / n) || 1;

    const meanAht = ahts.reduce((a, b) => a + b, 0) / n;
    const stdAht = Math.sqrt(ahts.reduce((sum, v) => sum + Math.pow(v - meanAht, 2), 0) / n) || 1;

    const sortedVolAsc = [...volumes].sort((a, b) => a - b);
    const medianVol = sortedVolAsc[Math.floor(n / 2)];

    const sortedAhtAsc = [...ahts].sort((a, b) => a - b);
    const medianAht = sortedAhtAsc[Math.floor(n / 2)];

    // Detection Run
    sortedByDate.forEach((row, sIdx) => {
      let volOutlier = false;
      let ahtOutlier = false;
      let reason = '';

      if (method === 'zscore') {
        const zVol = Math.abs(row.volume - meanVol) / stdVol;
        const zAht = Math.abs(row.aht - meanAht) / stdAht;

        volOutlier = zVol > thresholdFactor;
        ahtOutlier = zAht > thresholdFactor;

        if (volOutlier && ahtOutlier) reason = 'Z-Score: Vol & AHT outlier';
        else if (volOutlier) reason = 'Z-Score: Volume spike';
        else if (ahtOutlier) reason = 'Z-Score: AHT spike';
      } 
      else if (method === 'iqr') {
        const q1Vol = sortedVolAsc[Math.floor(n * 0.25)];
        const q3Vol = sortedVolAsc[Math.floor(n * 0.75)];
        const iqrVol = q3Vol - q1Vol;
        const lowerBoundVol = q1Vol - (thresholdFactor * 0.6) * iqrVol; // Scaling threshold
        const upperBoundVol = q3Vol + (thresholdFactor * 0.6) * iqrVol;

        const q1Aht = sortedAhtAsc[Math.floor(n * 0.25)];
        const q3Aht = sortedAhtAsc[Math.floor(n * 0.75)];
        const iqrAht = q3Aht - q1Aht;
        const lowerBoundAht = q1Aht - (thresholdFactor * 0.6) * iqrAht;
        const upperBoundAht = q3Aht + (thresholdFactor * 0.6) * iqrAht;

        volOutlier = row.volume < lowerBoundVol || row.volume > upperBoundVol;
        ahtOutlier = row.aht < lowerBoundAht || row.aht > upperBoundAht;

        if (volOutlier && ahtOutlier) reason = 'IQR: Volume & AHT anomaly';
        else if (volOutlier) reason = 'IQR: Volume outlier';
        else if (ahtOutlier) reason = 'IQR: AHT outlier';
      } 
      else if (method === 'moving_median') {
        const start = Math.max(0, sIdx - 2);
        const end = Math.min(n - 1, sIdx + 2);
        const localVols = sortedByDate.slice(start, end + 1).map(x => x.volume);
        const localAhts = sortedByDate.slice(start, end + 1).map(x => x.aht);

        const medVol = [...localVols].sort((a,b)=>a-b)[Math.floor(localVols.length / 2)];
        const medAht = [...localAhts].sort((a,b)=>a-b)[Math.floor(localAhts.length / 2)];

        const deviationsVol = localVols.map(v => Math.abs(v - medVol));
        const madVol = [...deviationsVol].sort((a,b)=>a-b)[Math.floor(deviationsVol.length / 2)] || 1;

        const deviationsAht = localAhts.map(a => Math.abs(a - medAht));
        const madAht = [...deviationsAht].sort((a,b)=>a-b)[Math.floor(deviationsAht.length / 2)] || 1;

        volOutlier = Math.abs(row.volume - medVol) > (thresholdFactor * 1.5) * madVol;
        ahtOutlier = Math.abs(row.aht - medAht) > (thresholdFactor * 1.5) * madAht;

        if (volOutlier && ahtOutlier) reason = 'Rolling Median: Volume & AHT spike';
        else if (volOutlier) reason = 'Rolling Median: Volume deviation';
        else if (ahtOutlier) reason = 'Rolling Median: AHT deviation';
      }

      const isAnomaly = volOutlier || ahtOutlier;

      // Apply Chosen Imputation Method
      let cleansedVolume = row.volume;
      if (volOutlier && imputationMethod !== 'none') {
        if (imputationMethod === 'mean') {
          cleansedVolume = Math.round(meanVol);
        } else if (imputationMethod === 'median') {
          cleansedVolume = Math.round(medianVol);
        } else if (imputationMethod === 'zero') {
          cleansedVolume = 0;
        } else if (imputationMethod === 'forward_fill') {
          if (sIdx > 0) {
            cleansedVolume = sortedByDate[sIdx - 1].volume;
          } else {
            cleansedVolume = Math.round(meanVol);
          }
        }
      }

      let cleansedAht = row.aht;
      if (ahtOutlier && imputationMethod !== 'none') {
        if (imputationMethod === 'mean') {
          cleansedAht = Math.round(meanAht);
        } else if (imputationMethod === 'median') {
          cleansedAht = Math.round(medianAht);
        } else if (imputationMethod === 'zero') {
          cleansedAht = 0;
        } else if (imputationMethod === 'forward_fill') {
          if (sIdx > 0) {
            cleansedAht = sortedByDate[sIdx - 1].aht;
          } else {
            cleansedAht = Math.round(meanAht);
          }
        }
      }

      updatedRowsMap.set(row.id, {
        ...row,
        isAnomaly: row.isAnomaly || isAnomaly,
        anomalyReason: row.anomalyReason || (isAnomaly ? reason : undefined),
        cleansedVolume,
        cleansedAht
      });
    });
  });

  // Reassemble the original order
  return data.map(d => updatedRowsMap.get(d.id) || d);
}
