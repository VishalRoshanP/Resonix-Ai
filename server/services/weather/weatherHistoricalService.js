/**
 * Weather Historical & Climate Archive Service
 * 
 * Interfaces with the Open-Meteo Historical Weather Archive API.
 * Provides authentic recorded meteorological observations (1940 - present):
 * - Annual & monthly rainfall totals (mm)
 * - Historical temperature averages & extremes
 * - Multi-year climate trends & precipitation changes
 * 
 * Strictly grounded in authentic archive measurements. Zero LLM hallucinations.
 */

const logger = require('../../utils/logger');
const defaultCache = require('./weatherCache');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ARCHIVE_BASE_URL = 'https://archive-api.open-meteo.com/v1/archive';

class WeatherHistoricalService {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || ARCHIVE_BASE_URL;
    this.cache = options.cache || defaultCache;
  }

  /**
   * Safe fetch with timeout
   * @private
   */
  async _request(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Resonix-WeatherGPT/1.0',
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Open-Meteo Archive API returned status ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Historical weather archive request timed out.');
        timeoutErr.code = 'ARCHIVE_TIMEOUT';
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * Fetch historical weather for a specific year or date range
   * @param {number} lat
   * @param {number} lon
   * @param {Object} [options] - { year, startDate, endDate }
   * @returns {Promise<Object>}
   */
  async getHistoricalWeather(lat, lon, options = {}) {
    const targetYear = options.year || (new Date().getFullYear() - 1); // Default to last year (e.g. 2025)
    const startDate = options.startDate || `${targetYear}-01-01`;
    const endDate = options.endDate || `${targetYear}-12-31`;

    const qLat = this.cache.quantize(lat);
    const qLon = this.cache.quantize(lon);
    const cacheKey = `HIST:${qLat}:${qLon}:${startDate}:${endDate}`;

    const cached = this.cache.get('LOCATION', cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      start_date: startDate,
      end_date: endDate,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum',
      timezone: 'auto',
    });

    const url = `${this.baseUrl}?${params.toString()}`;
    logger.info(`[WeatherHistorical] Fetching archive meteorological data for (${lat}, ${lon}) from ${startDate} to ${endDate}...`);

    try {
      const data = await this._request(url);
      const daily = data.daily || {};
      const dates = daily.time || [];
      const precipArray = daily.precipitation_sum || [];
      const maxTemps = (daily.temperature_2m_max || []).filter((t) => t != null && !isNaN(t));
      const minTemps = (daily.temperature_2m_min || []).filter((t) => t != null && !isNaN(t));

      // 1. Calculate Annual / Range Precipitation Metrics
      let totalRainfallMm = 0;
      let rainyDaysCount = 0;
      let heavyRainDaysCount = 0;
      let maxRainfallDay = { date: null, rainfallMm: 0 };

      precipArray.forEach((val, idx) => {
        const p = Number(val) || 0;
        totalRainfallMm += p;
        if (p >= 0.1) rainyDaysCount++;
        if (p >= 25.0) heavyRainDaysCount++;
        if (p > maxRainfallDay.rainfallMm) {
          maxRainfallDay = { date: dates[idx], rainfallMm: Math.round(p * 10) / 10 };
        }
      });

      totalRainfallMm = Math.round(totalRainfallMm * 10) / 10;

      // 2. Temperature Metrics
      const avgMaxTemp = maxTemps.length > 0
        ? Math.round((maxTemps.reduce((a, b) => a + b, 0) / maxTemps.length) * 10) / 10
        : null;
      const avgMinTemp = minTemps.length > 0
        ? Math.round((minTemps.reduce((a, b) => a + b, 0) / minTemps.length) * 10) / 10
        : null;
      const peakMaxTemp = maxTemps.length > 0 ? Math.max(...maxTemps) : null;
      const lowestMinTemp = minTemps.length > 0 ? Math.min(...minTemps) : null;

      // 3. Monthly Breakdown (12 Months)
      const FULL_MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyMap = {};
      for (let m = 0; m < 12; m++) {
        monthlyMap[m] = {
          monthIndex: m + 1,
          monthName: FULL_MONTH_NAMES[m],
          monthShort: SHORT_MONTH_NAMES[m],
          totalRainfallMm: 0,
          rainyDaysCount: 0,
          maxTemps: [],
          minTemps: [],
        };
      }

      dates.forEach((dStr, idx) => {
        const dateObj = new Date(dStr);
        const m = dateObj.getMonth();
        if (monthlyMap[m]) {
          const p = Number(precipArray[idx]) || 0;
          monthlyMap[m].totalRainfallMm += p;
          if (p >= 0.1) monthlyMap[m].rainyDaysCount++;

          const tMax = daily.temperature_2m_max?.[idx];
          const tMin = daily.temperature_2m_min?.[idx];
          if (tMax != null && !isNaN(tMax)) monthlyMap[m].maxTemps.push(Number(tMax));
          if (tMin != null && !isNaN(tMin)) monthlyMap[m].minTemps.push(Number(tMin));
        }
      });

      const monthlyBreakdown = Object.values(monthlyMap).map((m) => {
        const avgMax = m.maxTemps.length > 0 ? Math.round((m.maxTemps.reduce((a, b) => a + b, 0) / m.maxTemps.length) * 10) / 10 : null;
        const avgMin = m.minTemps.length > 0 ? Math.round((m.minTemps.reduce((a, b) => a + b, 0) / m.minTemps.length) * 10) / 10 : null;
        const avgMean = (avgMax != null && avgMin != null) ? Math.round(((avgMax + avgMin) / 2) * 10) / 10 : null;
        const peak = m.maxTemps.length > 0 ? Math.max(...m.maxTemps) : null;
        const low = m.minTemps.length > 0 ? Math.min(...m.minTemps) : null;

        return {
          month: m.monthIndex,
          monthName: m.monthName,
          totalRainfallMm: Math.round(m.totalRainfallMm * 10) / 10,
          rainyDaysCount: m.rainyDaysCount,
          averageMaxTemp: avgMax,
          averageMinTemp: avgMin,
          averageTemp: avgMean,
          peakMaxTemp: peak,
          lowestMinTemp: low,
        };
      });

      // 4. Identify Hottest, Wettest, and Coldest Months
      let hottestMonth = null;
      let wettestMonth = null;
      let coldestMonth = null;

      monthlyBreakdown.forEach((mb) => {
        if (!hottestMonth || (mb.averageTemp != null && mb.averageTemp > (hottestMonth.averageTemp ?? -999))) {
          hottestMonth = {
            month: mb.month,
            monthName: mb.monthName,
            averageTemp: mb.averageTemp,
            averageMaxTemp: mb.averageMaxTemp,
            peakMaxTemp: mb.peakMaxTemp,
          };
        }
        if (!wettestMonth || mb.totalRainfallMm > (wettestMonth.totalRainfallMm ?? -1)) {
          wettestMonth = {
            month: mb.month,
            monthName: mb.monthName,
            totalRainfallMm: mb.totalRainfallMm,
            rainyDaysCount: mb.rainyDaysCount,
          };
        }
        if (!coldestMonth || (mb.averageTemp != null && mb.averageTemp < (coldestMonth.averageTemp ?? 999))) {
          coldestMonth = {
            month: mb.month,
            monthName: mb.monthName,
            averageTemp: mb.averageTemp,
            averageMinTemp: mb.averageMinTemp,
            lowestMinTemp: mb.lowestMinTemp,
          };
        }
      });

      // 5. Extreme Meteorological Events
      let heatwaveDaysCount = 0;
      let veryHeavyRainDaysCount = 0;
      let peakMaxDate = null;
      let lowestMinDate = null;

      dates.forEach((dStr, idx) => {
        const tMax = Number(daily.temperature_2m_max?.[idx]);
        const tMin = Number(daily.temperature_2m_min?.[idx]);
        const p = Number(precipArray[idx]) || 0;
        if (tMax >= 38.0) heatwaveDaysCount++;
        if (p >= 50.0) veryHeavyRainDaysCount++;
        if (tMax === peakMaxTemp && !peakMaxDate) peakMaxDate = dStr;
        if (tMin === lowestMinTemp && !lowestMinDate) lowestMinDate = dStr;
      });

      const extremeEvents = {
        hottestDay: {
          date: peakMaxDate,
          tempMax: peakMaxTemp,
        },
        coldestDay: {
          date: lowestMinDate,
          tempMin: lowestMinTemp,
        },
        heaviestRainDay: maxRainfallDay,
        heatwaveDaysCount,
        heavyRainDaysCount,
        veryHeavyRainDaysCount,
      };

      const summary = {
        latitude: lat,
        longitude: lon,
        period: `${startDate} to ${endDate}`,
        year: targetYear,
        daysCount: dates.length,
        totalRainfallMm,
        rainyDaysCount,
        heavyRainDaysCount,
        maxRainfallDay,
        averageMaxTemp: avgMaxTemp,
        averageMinTemp: avgMinTemp,
        peakMaxTemp,
        lowestMinTemp,
        monthlyBreakdown,
        hottestMonth,
        wettestMonth,
        coldestMonth,
        extremeEvents,
        source: 'Open-Meteo Historical Weather Archive',
        fetchedAt: new Date().toISOString(),
      };

      // Cache for 30 days (historical data doesn't change)
      this.cache.set('LOCATION', cacheKey, undefined, summary, 30 * 24 * 60 * 60 * 1000);
      return summary;
    } catch (err) {
      logger.warn(`[WeatherHistorical] Archive query failed for (${lat}, ${lon}): ${err.message}`);
      throw err;
    }
  }

  /**
   * Convenience alias for getHistoricalWeather with target year
   * @param {number} lat
   * @param {number} lon
   * @param {number|Object} [year=2025]
   * @returns {Promise<Object>}
   */
  async getMonthlyHistorical(lat, lon, year = 2025) {
    const targetYear = typeof year === 'object' ? (year.year || 2025) : (Number(year) || 2025);
    return this.getHistoricalWeather(lat, lon, { year: targetYear });
  }

  /**
   * Analyze multi-year climate trends (e.g. 5-year comparison: 2021 to 2025)
   * @param {number} lat
   * @param {number} lon
   * @param {Object|number} [options] - { years: number[], yearsCount: number } or number of years
   * @returns {Promise<Object>}
   */
  async getClimateTrends(lat, lon, options = {}) {
    const opts = typeof options === 'number' ? { yearsCount: options } : (options || {});
    const currentYear = new Date().getFullYear();
    const count = Number(opts.yearsCount) || 5;
    const defaultYears = [];
    for (let i = count; i >= 1; i--) {
      defaultYears.push(currentYear - i); // e.g. [2021, 2022, 2023, 2024, 2025]
    }
    const years = opts.years || defaultYears;

    const qLat = this.cache.quantize(lat);
    const qLon = this.cache.quantize(lon);
    const cacheKey = `CLIMATE:${qLat}:${qLon}:${years.join('_')}`;

    const cached = this.cache.get('LOCATION', cacheKey);
    if (cached) return cached;

    logger.info(`[WeatherHistorical] Computing multi-year climate trends for (${lat}, ${lon}) across years [${years.join(', ')}]...`);

    const yearlyData = [];
    for (const yr of years) {
      try {
        const hist = await this.getHistoricalWeather(lat, lon, { year: yr });
        yearlyData.push({
          year: yr,
          totalRainfallMm: hist.totalRainfallMm,
          rainyDaysCount: hist.rainyDaysCount,
          averageMaxTemp: hist.averageMaxTemp,
          averageMinTemp: hist.averageMinTemp,
          peakMaxTemp: hist.peakMaxTemp,
          maxRainfallDay: hist.maxRainfallDay,
          hottestMonth: hist.hottestMonth,
          wettestMonth: hist.wettestMonth,
          extremeEvents: hist.extremeEvents,
        });
      } catch (err) {
        logger.warn(`[WeatherHistorical] Failed to fetch climate year ${yr}: ${err.message}`);
      }
    }

    if (yearlyData.length < 2) {
      throw new Error('Insufficient historical data points to compute comparative climate trends.');
    }

    // Compute trend metrics
    const totalRainArray = yearlyData.map((y) => y.totalRainfallMm);
    const avgMultiYearRainfall = Math.round((totalRainArray.reduce((a, b) => a + b, 0) / totalRainArray.length) * 10) / 10;

    // Year-over-Year (YoY) Deltas
    const yearOverYearDeltas = [];
    for (let i = 1; i < yearlyData.length; i++) {
      const prev = yearlyData[i - 1];
      const curr = yearlyData[i];
      const deltaRain = Math.round((curr.totalRainfallMm - prev.totalRainfallMm) * 10) / 10;
      const pct = prev.totalRainfallMm > 0
        ? Math.round(((curr.totalRainfallMm - prev.totalRainfallMm) / prev.totalRainfallMm) * 1000) / 10
        : 0;
      const deltaTemp = (curr.averageMaxTemp != null && prev.averageMaxTemp != null)
        ? Math.round((curr.averageMaxTemp - prev.averageMaxTemp) * 10) / 10
        : 0;
      yearOverYearDeltas.push({
        period: `${prev.year} -> ${curr.year}`,
        fromYear: prev.year,
        priorYear: prev.year,
        toYear: curr.year,
        year: curr.year,
        rainfallDifferenceMm: deltaRain,
        rainfallDeltaMm: deltaRain,
        percentageChange: pct,
        rainfallDeltaPercentage: pct,
        tempDifference: deltaTemp,
        trend: deltaRain > 0 ? 'INCREASED' : deltaRain < 0 ? 'DECREASED' : 'STABLE',
      });
    }

    // Overall Multi-Year Shift (Earliest vs Latest)
    const earliestYear = yearlyData[0];
    const latestYear = yearlyData[yearlyData.length - 1];
    const overallDifferenceMm = Math.round((latestYear.totalRainfallMm - earliestYear.totalRainfallMm) * 10) / 10;
    const overallPercentageChange = earliestYear.totalRainfallMm > 0
      ? Math.round(((latestYear.totalRainfallMm - earliestYear.totalRainfallMm) / earliestYear.totalRainfallMm) * 1000) / 10
      : 0;
    const overallTrendDirection = overallDifferenceMm > 0 ? 'INCREASED' : overallDifferenceMm < 0 ? 'DECREASED' : 'STABLE';

    // Driest and Wettest Years
    let driestYear = yearlyData[0];
    let wettestYear = yearlyData[0];
    yearlyData.forEach((y) => {
      if (y.totalRainfallMm < driestYear.totalRainfallMm) driestYear = y;
      if (y.totalRainfallMm > wettestYear.totalRainfallMm) wettestYear = y;
    });

    const previousYear = yearlyData[yearlyData.length - 2];
    const latestComparison = {
      comparisonPeriod: `${previousYear.year} vs ${latestYear.year}`,
      differenceMm: Math.round((latestYear.totalRainfallMm - previousYear.totalRainfallMm) * 10) / 10,
      percentageChange: previousYear.totalRainfallMm > 0
        ? Math.round(((latestYear.totalRainfallMm - previousYear.totalRainfallMm) / previousYear.totalRainfallMm) * 1000) / 10
        : 0,
      trendDirection: latestYear.totalRainfallMm > previousYear.totalRainfallMm ? 'INCREASED' : 'DECREASED',
    };

    const result = {
      latitude: lat,
      longitude: lon,
      analyzedYears: yearlyData.map((y) => y.year),
      yearlyData,
      trends: yearlyData,
      multiYearAverageRainfallMm: avgMultiYearRainfall,
      fiveYearAverageRainfallMm: avgMultiYearRainfall,
      yearOverYearDeltas,
      overallShift: {
        comparisonPeriod: `${earliestYear.year} to ${latestYear.year}`,
        yearsCount: yearlyData.length,
        differenceMm: overallDifferenceMm,
        rainfallShiftMm: overallDifferenceMm,
        percentageChange: overallPercentageChange,
        rainfallShiftPercentage: overallPercentageChange,
        trendDirection: overallTrendDirection,
      },
      latestComparison,
      driestYear: { year: driestYear.year, rainfallMm: driestYear.totalRainfallMm },
      wettestYear: { year: wettestYear.year, rainfallMm: wettestYear.totalRainfallMm },
      source: 'Open-Meteo Climate Archive Analytics',
      analyzedAt: new Date().toISOString(),
    };

    // Cache for 30 days
    this.cache.set('LOCATION', cacheKey, undefined, result, 30 * 24 * 60 * 1000);
    return result;
  }
}

const defaultHistoricalService = new WeatherHistoricalService();
module.exports = defaultHistoricalService;
module.exports.WeatherHistoricalService = WeatherHistoricalService;
