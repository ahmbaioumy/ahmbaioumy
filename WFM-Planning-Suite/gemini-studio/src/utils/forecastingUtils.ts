import { HistoricalRow, ForecastRow, ForecastingModel } from '../types';

/**
 * Recommends the best forecasting model based on cleansed historical data characteristics.
 */
export function recommendForecastingModel(data: HistoricalRow[]): {
  model: ForecastingModel;
  explanation: string;
} {
  if (data.length === 0) {
    return { model: 'average', explanation: 'No data to analyze.' };
  }

  // Count days
  const uniqueDates = Array.from(new Set(data.map(d => d.date)));
  const daysCount = uniqueDates.length;

  if (daysCount < 7) {
    return {
      model: 'moving_average',
      explanation: 'Under 7 days of history. Standard Moving Average is recommended to avoid over-fitting on incomplete weekly patterns.'
    };
  }

  if (daysCount >= 28) {
    return {
      model: 'prophet_style',
      explanation: 'Sufficient sample size (28+ days). Prophet-style additive regression is recommended as it decomposes linear growth, weekly staffing curves, and daily half-hour interval shapes.'
    };
  }

  return {
    model: 'seasonal_hw',
    explanation: 'Moderate history (7-27 days). Double/Triple Seasonal Exponential Smoothing (Holt-Winters) is recommended to balance short term trends with weekly cyclic variations.'
  };
}

/**
 * Performs forecasting based on chosen model, forecast horizon, and channel selections.
 */
export function generateForecast(
  historicalData: HistoricalRow[],
  model: ForecastingModel,
  horizonDays: number,
  channels: string[]
): ForecastRow[] {
  const forecastResults: ForecastRow[] = [];
  if (historicalData.length === 0 || channels.length === 0) return [];

  // Use cleansed data if available, fallback to raw
  const processedHist = historicalData.map(d => ({
    ...d,
    volume: d.cleansedVolume !== undefined ? d.cleansedVolume : d.volume,
    aht: d.cleansedAht !== undefined ? d.cleansedAht : d.aht
  }));

  const uniqueDatesSorted = Array.from(new Set(processedHist.map(d => d.date))).sort();
  const lastDate = new Date(uniqueDatesSorted[uniqueDatesSorted.length - 1]);
  const intervals = Array.from(new Set(processedHist.map(d => d.interval))).sort();

  channels.forEach(chan => {
    const chanData = processedHist.filter(d => d.channel === chan);
    if (chanData.length === 0) return;

    // Execute model calculations
    if (model === 'average') {
      // Simple Average of matching interval
      const intervalMeans: Record<string, { vol: number; aht: number }> = {};
      intervals.forEach(inter => {
        const matching = chanData.filter(d => d.interval === inter);
        const meanVol = matching.reduce((sum, x) => sum + x.volume, 0) / (matching.length || 1);
        const meanAht = matching.reduce((sum, x) => sum + x.aht, 0) / (matching.length || 1);
        intervalMeans[inter] = { vol: meanVol, aht: meanAht };
      });

      // Extrapolate
      for (let day = 1; day <= horizonDays; day++) {
        const nextDate = new Date(lastDate.getTime() + day * 24 * 60 * 60 * 1000);
        const dateStr = nextDate.toISOString().split('T')[0];

        intervals.forEach(inter => {
          const means = intervalMeans[inter] || { vol: 10, aht: 300 };
          forecastResults.push({
            id: `f-${chan}-${dateStr}-${inter}`,
            timestamp: `${dateStr}T${inter}:00`,
            date: dateStr,
            time: inter,
            interval: inter,
            volume: Math.max(0, Math.round(means.vol)),
            aht: Math.max(60, Math.round(means.aht)),
            channel: chan
          });
        });
      }
    } 
    else if (model === 'moving_average') {
      // 14-day rolling window for same weekday and interval
      for (let day = 1; day <= horizonDays; day++) {
        const nextDate = new Date(lastDate.getTime() + day * 24 * 60 * 60 * 1000);
        const dateStr = nextDate.toISOString().split('T')[0];
        const weekday = nextDate.getDay();

        intervals.forEach(inter => {
          // Find matching weekday and interval in the last 21 days of historical data
          const peers = chanData.filter(d => {
            const dDate = new Date(d.date);
            return d.interval === inter && dDate.getDay() === weekday;
          });

          // take last 3 matching weekday instances
          const recentPeers = peers.slice(-3);
          const avgVol = recentPeers.reduce((sum, x) => sum + x.volume, 0) / (recentPeers.length || 1);
          const avgAht = recentPeers.reduce((sum, x) => sum + x.aht, 0) / (recentPeers.length || 1);

          forecastResults.push({
            id: `f-${chan}-${dateStr}-${inter}`,
            timestamp: `${dateStr}T${inter}:00`,
            date: dateStr,
            time: inter,
            interval: inter,
            volume: Math.max(0, Math.round(avgVol)),
            aht: Math.max(60, Math.round(avgAht)),
            channel: chan
          });
        });
      }
    } 
    else if (model === 'trend') {
      // Simple linear regression on daily volumes, then distribute using average interval shape
      const dailySummaries = summarizeDaily(chanData);
      const n = dailySummaries.length;
      
      // Calculate daily trend
      let slopeVol = 0;
      let interceptVol = dailySummaries[0]?.volume || 0;
      let slopeAht = 0;
      let interceptAht = dailySummaries[0]?.aht || 280;

      if (n > 1) {
        const xSum = dailySummaries.reduce((sum, _, idx) => sum + idx, 0);
        const yVolSum = dailySummaries.reduce((sum, d) => sum + d.volume, 0);
        const yAhtSum = dailySummaries.reduce((sum, d) => sum + d.aht, 0);
        
        let xxSum = 0;
        let xyVolSum = 0;
        let xyAhtSum = 0;
        
        dailySummaries.forEach((d, idx) => {
          xxSum += idx * idx;
          xyVolSum += idx * d.volume;
          xyAhtSum += idx * d.aht;
        });

        const denominator = (n * xxSum - xSum * xSum);
        if (denominator !== 0) {
          slopeVol = (n * xyVolSum - xSum * yVolSum) / denominator;
          interceptVol = (yVolSum - slopeVol * xSum) / n;

          slopeAht = (n * xyAhtSum - xSum * yAhtSum) / denominator;
          interceptAht = (yAhtSum - slopeAht * xSum) / n;
        }
      }

      // Interval profile ratios
      const intervalWeights: Record<string, { volRatio: number; ahtMean: number }> = {};
      intervals.forEach(inter => {
        const matching = chanData.filter(d => d.interval === inter);
        const totalMatchingVol = matching.reduce((sum, x) => sum + x.volume, 0);
        const totalVol = chanData.reduce((sum, x) => sum + x.volume, 0) || 1;
        const count = matching.length || 1;

        intervalWeights[inter] = {
          volRatio: totalMatchingVol / totalVol,
          ahtMean: matching.reduce((sum, x) => sum + x.aht, 0) / count
        };
      });

      // Extrapolate
      for (let day = 1; day <= horizonDays; day++) {
        const nextDate = new Date(lastDate.getTime() + day * 24 * 60 * 60 * 1000);
        const dateStr = nextDate.toISOString().split('T')[0];
        const dayIdx = n + day - 1;

        const projectedDailyVol = Math.max(10, interceptVol + slopeVol * dayIdx);
        const projectedDailyAht = Math.max(60, interceptAht + slopeAht * dayIdx);

        intervals.forEach(inter => {
          const profile = intervalWeights[inter] || { volRatio: 1 / intervals.length, ahtMean: 300 };
          const intervalVol = projectedDailyVol * profile.volRatio;
          // Blend trend AHT with historical interval baseline
          const intervalAht = (projectedDailyAht + profile.ahtMean) / 2;

          forecastResults.push({
            id: `f-${chan}-${dateStr}-${inter}`,
            timestamp: `${dateStr}T${inter}:00`,
            date: dateStr,
            time: inter,
            interval: inter,
            volume: Math.max(0, Math.round(intervalVol)),
            aht: Math.max(60, Math.round(intervalAht)),
            channel: chan
          });
        });
      }
    } 
    else if (model === 'seasonal_hw') {
      // Holt-Winters inspired seasonal decomposition using weekly period (7 days)
      const dailySummaries = summarizeDaily(chanData);
      const L = 7; // Weekly seasonality length
      const n = dailySummaries.length;

      // Ensure we have enough data, fallback to Trend if needed
      if (n < L * 2) {
        // Fallback
        const trendForecast = generateForecast(historicalData, 'trend', horizonDays, [chan]);
        forecastResults.push(...trendForecast);
        return;
      }

      // Initialize Level, Trend, Seasonality factors
      let level = dailySummaries.slice(0, L).reduce((sum, x) => sum + x.volume, 0) / L;
      let trend = (dailySummaries.slice(L, L * 2).reduce((sum, x) => sum + x.volume, 0) - dailySummaries.slice(0, L).reduce((sum, x) => sum + x.volume, 0)) / (L * L);
      
      const seasons = Array(L).fill(1);
      for (let i = 0; i < L; i++) {
        seasons[i] = dailySummaries[i].volume / (level || 1);
      }

      // Hyperparameters
      const alpha = 0.2;
      const beta = 0.1;
      const gamma = 0.3;

      const smoothedVolumes: number[] = [];

      for (let i = 0; i < n; i++) {
        const val = dailySummaries[i].volume;
        const lastL = level;
        const lastT = trend;
        const lastS = seasons[i % L];

        level = alpha * (val / lastS) + (1 - alpha) * (lastL + lastT);
        trend = beta * (level - lastL) + (1 - beta) * lastT;
        seasons[i % L] = gamma * (val / level) + (1 - gamma) * lastS;

        smoothedVolumes.push(level + trend);
      }

      // Decompose intervals
      const intervalRatios: Record<string, number[]> = {}; // interval -> 7 weekday weights
      intervals.forEach(inter => {
        intervalRatios[inter] = Array(7).fill(0);
        for (let w = 0; w < 7; w++) {
          const matching = chanData.filter(d => {
            const dateObj = new Date(d.date);
            return d.interval === inter && dateObj.getDay() === w;
          });
          const totalVol = matching.reduce((sum, x) => sum + x.volume, 0);
          const count = matching.length || 1;
          intervalRatios[inter][w] = totalVol / count;
        }
      });

      // Extrapolate daily
      for (let day = 1; day <= horizonDays; day++) {
        const nextDate = new Date(lastDate.getTime() + day * 24 * 60 * 60 * 1000);
        const dateStr = nextDate.toISOString().split('T')[0];
        const dayOfWeek = nextDate.getDay();

        // Holt-Winters formula: (Level + m * Trend) * Seasonality
        const projectedDailyVol = Math.max(10, (level + day * trend) * seasons[(n + day - 1) % L]);

        // AHT trend (using standard average)
        const meanAhts = intervals.map(inter => {
          const matching = chanData.filter(d => d.interval === inter);
          return matching.reduce((sum, x) => sum + x.aht, 0) / (matching.length || 1);
        });
        const overallMeanAht = meanAhts.reduce((a, b) => a + b, 0) / (meanAhts.length || 1);

        // Sum of weekday interval baselines
        let sumWeekdayIntervalBaselines = 0;
        intervals.forEach(inter => {
          sumWeekdayIntervalBaselines += intervalRatios[inter][dayOfWeek] || 0;
        });
        if (sumWeekdayIntervalBaselines === 0) sumWeekdayIntervalBaselines = 1;

        intervals.forEach((inter, idx) => {
          const ratio = (intervalRatios[inter][dayOfWeek] || 0) / sumWeekdayIntervalBaselines;
          const intervalVol = projectedDailyVol * ratio;
          const intervalAht = chanData.filter(d => d.interval === inter).reduce((sum, x) => sum + x.aht, 0) / (chanData.filter(d => d.interval === inter).length || 1);

          forecastResults.push({
            id: `f-${chan}-${dateStr}-${inter}`,
            timestamp: `${dateStr}T${inter}:00`,
            date: dateStr,
            time: inter,
            interval: inter,
            volume: Math.max(0, Math.round(intervalVol)),
            aht: Math.max(60, Math.round(intervalAht || overallMeanAht)),
            channel: chan
          });
        });
      }
    } 
    else if (model === 'prophet_style') {
      // Additive regression: Y(t) = Trend(t) + WeeklySeason(t) + DailyIntervalSeason(t)
      // Highly robust and flexible regression representation
      const dailySummaries = summarizeDaily(chanData);
      const n = dailySummaries.length;

      // 1. Calculate linear trend on volumes
      let trendSlope = 0;
      let trendIntercept = dailySummaries[0]?.volume || 10;
      if (n > 1) {
        const xSum = dailySummaries.reduce((sum, _, i) => sum + i, 0);
        const ySum = dailySummaries.reduce((sum, d) => sum + d.volume, 0);
        let xxSum = 0;
        let xySum = 0;
        dailySummaries.forEach((d, i) => {
          xxSum += i * i;
          xySum += i * d.volume;
        });
        const den = n * xxSum - xSum * xSum;
        if (den !== 0) {
          trendSlope = (n * xySum - xSum * ySum) / den;
          trendIntercept = (ySum - trendSlope * xSum) / n;
        }
      }

      // 2. Day of Week Seasonality (Multiplicative scale relative to average trend)
      const weekdayRatios = Array(7).fill(1.0);
      const weekdayCounts = Array(7).fill(0);
      const weekdaySums = Array(7).fill(0);

      dailySummaries.forEach((d, i) => {
        const dateObj = new Date(d.date);
        const w = dateObj.getDay();
        const trendVal = trendIntercept + trendSlope * i;
        if (trendVal > 0) {
          weekdaySums[w] += d.volume / trendVal;
          weekdayCounts[w]++;
        }
      });

      for (let w = 0; w < 7; w++) {
        if (weekdayCounts[w] > 0) {
          weekdayRatios[w] = weekdaySums[w] / weekdayCounts[w];
        }
      }

      // 3. Intraday Interval Seasonality
      const intervalWeights = Array(intervals.length).fill(1 / intervals.length);
      intervals.forEach((inter, idx) => {
        const matching = chanData.filter(d => d.interval === inter);
        const matchSum = matching.reduce((sum, x) => sum + x.volume, 0);
        const totalSum = chanData.reduce((sum, x) => sum + x.volume, 0) || 1;
        intervalWeights[idx] = matchSum / totalSum;
      });

      // 4. Extrapolate
      for (let day = 1; day <= horizonDays; day++) {
        const nextDate = new Date(lastDate.getTime() + day * 24 * 60 * 60 * 1000);
        const dateStr = nextDate.toISOString().split('T')[0];
        const dayIdx = n + day - 1;
        const dayOfWeek = nextDate.getDay();

        const baselineDailyVol = trendIntercept + trendSlope * dayIdx;
        const seasonalDailyVol = Math.max(5, baselineDailyVol * weekdayRatios[dayOfWeek]);

        // Same decomposition for AHT
        const meanAhts = intervals.map(inter => {
          const matching = chanData.filter(d => d.interval === inter);
          return matching.reduce((sum, x) => sum + x.aht, 0) / (matching.length || 1);
        });
        const overallMeanAht = meanAhts.reduce((a, b) => a + b, 0) / (meanAhts.length || 1);

        intervals.forEach((inter, idx) => {
          const ratio = intervalWeights[idx];
          const intervalVol = seasonalDailyVol * ratio * intervals.length; // Rescaled
          const intervalAht = meanAhts[idx] || overallMeanAht;

          forecastResults.push({
            id: `f-${chan}-${dateStr}-${inter}`,
            timestamp: `${dateStr}T${inter}:00`,
            date: dateStr,
            time: inter,
            interval: inter,
            volume: Math.max(0, Math.round(intervalVol)),
            aht: Math.max(60, Math.round(intervalAht)),
            channel: chan
          });
        });
      }
    }
    else if (model === 'sarima_approx') {
      // Seasonal Autoregressive Integrated Moving Average approximation
      const dailySummaries = summarizeDaily(chanData);
      const n = dailySummaries.length;

      let trendSlope = 0;
      let trendIntercept = dailySummaries[0]?.volume || 10;
      if (n > 1) {
        const xSum = dailySummaries.reduce((sum, _, i) => sum + i, 0);
        const ySum = dailySummaries.reduce((sum, d) => sum + d.volume, 0);
        let xxSum = 0;
        let xySum = 0;
        dailySummaries.forEach((d, i) => {
          xxSum += i * i;
          xySum += i * d.volume;
        });
        const den = n * xxSum - xSum * xSum;
        if (den !== 0) {
          trendSlope = (n * xySum - xSum * ySum) / den;
          trendIntercept = (ySum - trendSlope * xSum) / n;
        }
      }

      for (let day = 1; day <= horizonDays; day++) {
        const nextDate = new Date(lastDate.getTime() + day * 24 * 60 * 60 * 1000);
        const dateStr = nextDate.toISOString().split('T')[0];
        const weekday = nextDate.getDay();

        intervals.forEach((inter) => {
          const lag7 = chanData.filter(d => {
            const dDate = new Date(d.date);
            return d.interval === inter && dDate.getDay() === weekday;
          }).slice(-1)[0]?.volume;

          const lag14 = chanData.filter(d => {
            const dDate = new Date(d.date);
            return d.interval === inter && dDate.getDay() === weekday;
          }).slice(-2)[0]?.volume;

          const lag1 = chanData.filter(d => {
            return d.interval === inter;
          }).slice(-1)[0]?.volume;

          const baseLag7 = lag7 !== undefined ? lag7 : (chanData.reduce((s, d) => s + d.volume, 0) / chanData.length);
          const baseLag14 = lag14 !== undefined ? lag14 : baseLag7;
          const baseLag1 = lag1 !== undefined ? lag1 : baseLag7;

          let sarimaVol = 0.5 * baseLag7 + 0.3 * baseLag14 + 0.2 * baseLag1;
          const trendMultiplier = 1 + (trendSlope / (trendIntercept || 1)) * (day / 30);
          sarimaVol = Math.max(0, sarimaVol * trendMultiplier);

          const matchingAht = chanData.filter(d => d.interval === inter);
          const intervalAht = matchingAht.reduce((sum, x) => sum + x.aht, 0) / (matchingAht.length || 1);

          forecastResults.push({
            id: `f-${chan}-${dateStr}-${inter}`,
            timestamp: `${dateStr}T${inter}:00`,
            date: dateStr,
            time: inter,
            interval: inter,
            volume: Math.max(0, Math.round(sarimaVol)),
            aht: Math.max(60, Math.round(intervalAht)),
            channel: chan
          });
        });
      }
    }
    else if (model === 'croston_intermittent') {
      // Croston's Method for Intermittent Demand
      const intervalCroston: Record<string, { vol: number; aht: number }> = {};
      
      intervals.forEach(inter => {
        const matching = chanData.filter(d => d.interval === inter);
        let z_size = 0; 
        let p_period = 1; 
        let timeSinceLast = 0;
        let countNonZero = 0;
        let sumAht = 0;
        let countAht = 0;
        const alpha = 0.15;

        matching.forEach(d => {
          timeSinceLast++;
          if (d.aht > 0) {
            sumAht += d.aht;
            countAht++;
          }
          if (d.volume > 0) {
            countNonZero++;
            if (z_size === 0) {
              z_size = d.volume;
              p_period = timeSinceLast;
            } else {
              z_size = alpha * d.volume + (1 - alpha) * z_size;
              p_period = alpha * timeSinceLast + (1 - alpha) * p_period;
            }
            timeSinceLast = 0;
          }
        });

        const avgAht = countAht > 0 ? sumAht / countAht : 300;
        const crostonVol = p_period > 0 ? (z_size / p_period) : 0;
        intervalCroston[inter] = { vol: crostonVol, aht: avgAht };
      });

      for (let day = 1; day <= horizonDays; day++) {
        const nextDate = new Date(lastDate.getTime() + day * 24 * 60 * 60 * 1000);
        const dateStr = nextDate.toISOString().split('T')[0];

        intervals.forEach(inter => {
          const stats = intervalCroston[inter] || { vol: 0, aht: 300 };
          forecastResults.push({
            id: `f-${chan}-${dateStr}-${inter}`,
            timestamp: `${dateStr}T${inter}:00`,
            date: dateStr,
            time: inter,
            interval: inter,
            volume: Math.max(0, Math.round(stats.vol)),
            aht: Math.max(60, Math.round(stats.aht)),
            channel: chan
          });
        });
      }
    }
    else if (model === 'ensemble_blend') {
      // Consensus forecast: 40% Prophet style, 40% Seasonal Holt-Winters, 20% Moving Average
      const pForecast = generateForecast(historicalData, 'prophet_style', horizonDays, [chan]);
      const hForecast = generateForecast(historicalData, 'seasonal_hw', horizonDays, [chan]);
      const mForecast = generateForecast(historicalData, 'moving_average', horizonDays, [chan]);

      pForecast.forEach((pf, idx) => {
        const hf = hForecast[idx] || pf;
        const mf = mForecast[idx] || pf;
        const blendedVol = 0.4 * pf.volume + 0.4 * hf.volume + 0.2 * mf.volume;
        const blendedAht = 0.4 * pf.aht + 0.4 * hf.aht + 0.2 * mf.aht;

        forecastResults.push({
          ...pf,
          id: `f-${chan}-${pf.date}-${pf.time}`,
          volume: Math.max(0, Math.round(blendedVol)),
          aht: Math.max(60, Math.round(blendedAht))
        });
      });
    }
  });

  return forecastResults;
}

/**
 * Helper to aggregate historical data to daily summaries for trend models
 */
function summarizeDaily(chanData: HistoricalRow[]): Array<{ date: string; volume: number; aht: number }> {
  const dateGroups: Record<string, { vol: number; ahtSum: number; count: number }> = {};
  chanData.forEach(d => {
    const vol = d.cleansedVolume !== undefined ? d.cleansedVolume : d.volume;
    const aht = d.cleansedAht !== undefined ? d.cleansedAht : d.aht;
    if (!dateGroups[d.date]) {
      dateGroups[d.date] = { vol: 0, ahtSum: 0, count: 0 };
    }
    dateGroups[d.date].vol += vol;
    dateGroups[d.date].ahtSum += aht;
    dateGroups[d.date].count++;
  });

  return Object.entries(dateGroups)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, g]) => ({
      date,
      volume: g.vol,
      aht: g.count > 0 ? g.ahtSum / g.count : 0
    }));
}
