/* SKYLINE PRO — HTML + compiled Tailwind CSS + vanilla JavaScript.
   Keep this file beside index.html and style.css.
   APIs: Open-Meteo forecast, geocoding, and air quality.
   No API key required for personal/non-commercial use. */

/* Pure formatting and weather helpers shared by the UI and tests. */
(function (root) {
  'use strict';
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const temperature = (value, unit = 'c') => finite(value) ? (unit === 'f' ? value * 9 / 5 + 32 : value) : null;
  const temp = (value, unit = 'c') => finite(temperature(value, unit)) ? `${Math.round(temperature(value, unit))}°` : '—';
  const number = (value, digits = 0) => finite(value) ? value.toLocaleString('en-US', { maximumFractionDigits:digits }) : '—';
  const wind = (value, unit = 'c') => finite(value) ? `${number(unit === 'f' ? value / 1.609344 : value)} ${unit === 'f' ? 'mph' : 'km/h'}` : '—';
  const distance = (meters, unit = 'c') => finite(meters) ? number(meters / (unit === 'f' ? 1609.344 : 1000), 1) : '—';
  const direction = (degrees) => finite(degrees) ? ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((degrees % 360 + 360) % 360) / 22.5) % 16] : '—';
  function date(timestamp, timezone = 'UTC', options = {}) {
    if (!finite(timestamp)) return '—';
    try { return new Intl.DateTimeFormat('en-US', { timeZone:timezone, ...options }).format(new Date(timestamp * 1000)); }
    catch { return new Intl.DateTimeFormat('en-US', { timeZone:'UTC', ...options }).format(new Date(timestamp * 1000)); }
  }
  const time = (timestamp, timezone) => date(timestamp, timezone, { hour:'numeric', minute:'2-digit', hour12:true });
  function hourIndex(times, timestamp = Date.now() / 1000) {
    if (!times?.length) return -1;
    let index = times.findIndex((item) => item > timestamp);
    return index === -1 ? times.length - 1 : Math.max(0, index - 1);
  }
  function weather(code, isDay = 1) {
    if (code == null) return { label:'Conditions unavailable', kind:'unknown' };
    if (code === 0) return { label:isDay ? 'Clear skies' : 'Clear night', kind:isDay ? 'sun' : 'moon' };
    if (code === 1) return { label:'Mostly clear', kind:isDay ? 'partly' : 'mooncloud' };
    if (code === 2) return { label:'Partly cloudy', kind:isDay ? 'partly' : 'mooncloud' };
    if (code === 3) return { label:'Overcast', kind:'cloud' };
    if ([45,48].includes(code)) return { label:code === 45 ? 'Foggy' : 'Freezing fog', kind:'fog' };
    if ([51,53,55].includes(code)) return { label:({51:'Light drizzle',53:'Drizzle',55:'Dense drizzle'})[code], kind:'rain' };
    if ([56,57].includes(code)) return { label:'Freezing drizzle', kind:'sleet' };
    if ([61,63,65].includes(code)) return { label:({61:'Light rain',63:'Rain',65:'Heavy rain'})[code], kind:'rain' };
    if ([66,67].includes(code)) return { label:'Freezing rain', kind:'sleet' };
    if ([71,73,75,77].includes(code)) return { label:({71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains'})[code], kind:'snow' };
    if ([80,81,82].includes(code)) return { label:({80:'Light showers',81:'Rain showers',82:'Heavy showers'})[code], kind:'rain' };
    if ([85,86].includes(code)) return { label:'Snow showers', kind:'snow' };
    if ([95,96,99].includes(code)) return { label:code === 95 ? 'Thunderstorm' : 'Thunderstorm with hail', kind:'storm' };
    return { label:'Conditions unavailable', kind:'unknown' };
  }
  function weatherSVG(code, isDay = 1) {
    const kind = weather(code, isDay).kind;
    const sun = '<circle class="sun-fill" cx="32" cy="28" r="11"/><path class="sun-rays" d="M32 9v-4m0 46v-4M13 28H9m46 0h-4M18 14l-3-3m34 34-3-3M18 42l-3 3m34-34-3 3"/>';
    const moon = '<path class="moon-fill" d="M42 14a18 18 0 1 1-24 24 18 18 0 0 0 24-24Z"/>';
    const cloud = '<path class="cloud-back" d="M20 39a9 9 0 0 1-2-18 13 13 0 0 1 24 5 8 8 0 1 1 1 16Z"/><path class="cloud-fill" d="M18 45a9 9 0 0 1-1-18 13 13 0 0 1 24 5 8 8 0 1 1 5 13Z"/>';
    const rain = '<path class="rain-stroke" d="m21 49-3 6m14-6-3 6m14-6-3 6"/>';
    const snow = '<path class="snow-stroke" d="M20 49v8m-4-4h8m8-4v8m-4-4h8m8-8v8m-4-4h8"/>';
    let contents = kind === 'sun' ? sun : kind === 'moon' ? moon : kind === 'partly' ? `<g transform="translate(-6 -6) scale(.85)">${sun}</g>${cloud}` : kind === 'mooncloud' ? `<g transform="translate(-7 -7)">${moon}</g>${cloud}` : kind === 'rain' ? `${cloud}${rain}` : kind === 'snow' ? `${cloud}${snow}` : kind === 'sleet' ? `${cloud}${rain}<circle class="cloud-fill" cx="45" cy="53" r="2"/>` : kind === 'storm' ? `${cloud}<path class="bolt-fill" d="m31 40-9 13h9l-3 10 16-17h-10l4-6Z"/>` : kind === 'fog' ? `${cloud}<path class="snow-stroke" d="M12 50h40M17 56h30"/>` : kind === 'unknown' ? '<text x="32" y="43" text-anchor="middle" fill="#90a1af" font-size="30">—</text>' : cloud;
    return `<svg class="weather-icon" viewBox="0 0 64 64" aria-hidden="true">${contents}</svg>`;
  }
  function aqi(value) {
    if (!finite(value)) return { label:'Unavailable', color:'#90a1af', description:'Air quality is temporarily unavailable.' };
    if (value <= 50) return { label:'Good', color:'#a5e5cc', description:'In the good range of the US AQI scale.' };
    if (value <= 100) return { label:'Moderate', color:'#dad07b', description:'In the moderate range of the US AQI scale.' };
    if (value <= 150) return { label:'Unhealthy for sensitive groups', color:'#e8ad75', description:'Above the moderate range of the US AQI scale.' };
    if (value <= 200) return { label:'Unhealthy', color:'#e59191', description:'In the unhealthy range of the US AQI scale.' };
    if (value <= 300) return { label:'Very unhealthy', color:'#c69bcc', description:'In the very unhealthy range of the US AQI scale.' };
    return { label:'Hazardous', color:'#d39aae', description:'In the highest category of the US AQI scale.' };
  }
  const uv = (value) => !finite(value) ? 'Unavailable' : value < 3 ? 'Low' : value < 6 ? 'Moderate' : value < 8 ? 'High' : value < 11 ? 'Very high' : 'Extreme';
  const locationKey = (place) => `${Number(place.latitude).toFixed(4)},${Number(place.longitude).toFixed(4)}`;
  function validPlace(place) {
    return place && typeof place.name === 'string' && place.name.length > 0 && place.name.length <= 100 && finite(place.latitude) && finite(place.longitude) && Math.abs(place.latitude) <= 90 && Math.abs(place.longitude) <= 180;
  }
  const helpers = { finite, clamp, escape, temperature, temp, number, wind, distance, direction, date, time, hourIndex, weather, weatherSVG, aqi, uv, locationKey, validPlace };
  root.Skyline = { ...(root.Skyline || {}), ...helpers };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
})(typeof window !== 'undefined' ? window : globalThis);


/* Public Open-Meteo APIs. No API key is required for non-commercial use. */
(function (root) {
  'use strict';
  const cache = new Map();
  const CACHE_MS = 10 * 60 * 1000;
  const ENDPOINTS = Object.freeze({ forecast:'https://api.open-meteo.com/v1/forecast', geocoding:'https://geocoding-api.open-meteo.com/v1/search', air:'https://air-quality-api.open-meteo.com/v1/air-quality' });
  async function request(endpoint, params, { signal, cacheKey, force = false } = {}) {
    const cached = cacheKey && cache.get(cacheKey);
    if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.data;
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', forwardAbort, { once:true });
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    try {
      const response = await fetch(`${endpoint}?${new URLSearchParams(params)}`, { signal:controller.signal });
      if (!response.ok) throw new Error(response.status === 429 ? 'The weather service is busy. Please wait a minute and try again.' : `Weather service returned HTTP ${response.status}. Please try again.`);
      const data = await response.json();
      if (data.error) throw new Error(data.reason || 'The weather service could not complete this request.');
      if (cacheKey) cache.set(cacheKey, { data, at:Date.now() });
      return data;
    } catch (error) {
      if (timedOut) throw new Error('The weather request timed out. Check your connection and try again.');
      if (error.name === 'AbortError') throw error;
      if (error.name === 'TypeError') throw new Error('Could not connect to the weather service. Check your internet connection and try again.');
      throw error;
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', forwardAbort); }
  }
  async function search(query, signal) {
    const data = await request(ENDPOINTS.geocoding, { name:query.trim(), count:7, language:'en', format:'json' }, { signal });
    return (data.results || []).filter(root.Skyline.validPlace).map(({ id, name, latitude, longitude, country, country_code, admin1, timezone }) => ({ id, name, latitude, longitude, country, country_code, admin1, timezone }));
  }
  async function forecast(place, options = {}) {
    if (!root.Skyline.validPlace(place)) throw new Error('Please choose a valid location.');
    const data = await request(ENDPOINTS.forecast, {
      latitude:place.latitude, longitude:place.longitude,
      current:'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,dew_point_2m,cloud_cover',
      hourly:'temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,visibility,is_day,wind_speed_10m',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
      timezone:'auto', timeformat:'unixtime', forecast_days:14, temperature_unit:'celsius', wind_speed_unit:'kmh', precipitation_unit:'mm'
    }, { ...options, cacheKey:`forecast:${root.Skyline.locationKey(place)}` });
    if (!data.current || !data.hourly?.time?.length || !data.daily?.time?.length) throw new Error('The weather service returned an incomplete forecast. Please refresh.');
    return data;
  }
  async function airQuality(place, options = {}) {
    const data = await request(ENDPOINTS.air, { latitude:place.latitude, longitude:place.longitude, current:'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide', timezone:'auto', timeformat:'unixtime' }, { ...options, cacheKey:`air:${root.Skyline.locationKey(place)}` });
    if (!data.current) throw new Error('Air quality is temporarily unavailable.');
    return data;
  }
  async function current(place, options = {}) {
    return request(ENDPOINTS.forecast, { latitude:place.latitude, longitude:place.longitude, current:'temperature_2m,weather_code,is_day', timezone:'auto', timeformat:'unixtime', forecast_days:1 }, { ...options, cacheKey:`current:${root.Skyline.locationKey(place)}` });
  }
  root.Skyline.API = Object.freeze({ search, forecast, airQuality, current, ENDPOINTS });
})(window);


/* Skyline Weather — DOM, state, and interaction logic. */
(function () {
  'use strict';
  const S = window.Skyline;
  const $ = (id) => document.getElementById(id);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const defaults = [
    { name:'Bahawalpur', latitude:29.39779, longitude:71.6752, admin1:'Punjab', country:'Pakistan', country_code:'PK', timezone:'Asia/Karachi' },
    { name:'Lahore', latitude:31.558, longitude:74.3507, admin1:'Punjab', country:'Pakistan', country_code:'PK', timezone:'Asia/Karachi' },
    { name:'London', latitude:51.5085, longitude:-0.1257, country:'United Kingdom', country_code:'GB', timezone:'Europe/London' }
  ];
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The app also works with storage disabled. */ } };
  const storedFavorites = read('skyline-favorites', defaults);
  const storedPlace = read('skyline-place', defaults[0]);
  const state = {
    place:S.validPlace(storedPlace) ? storedPlace : defaults[0],
    pendingPlace:null, weather:null, air:null, demo:false, busy:false,
    unit:read('skyline-unit', 'c') === 'f' ? 'f' : 'c', chart:'temperature', hours:24, days:7, selectedDay:-1, comparisonPlace:'', comparison:null, cached:false,
    favorites:(Array.isArray(storedFavorites) ? storedFavorites : defaults).filter(S.validPlace).slice(0, 5),
    savedWeather:new Map(), savedLoading:new Set(), searchResults:[], searchIndex:-1
  };
  let loadSequence = 0, weatherController, searchController, searchSequence = 0, searchTimer, toastTimer;
  let comparisonSequence = 0, comparisonController;
  const set = (id, text) => { $(id).textContent = text; };
  const measure = (value, unit) => S.finite(value) ? `${S.number(value)}${unit}` : '—';
  const timezone = () => state.weather?.timezone || state.place.timezone || 'UTC';

  function toast(message) {
    clearTimeout(toastTimer);
    set('toast', message); $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
  }
  function status(label, demo = false) {
    $('dataStatus').innerHTML = `<span class="status-dot"></span>${S.escape(label)}`;
    $('dataStatus').classList.toggle('demo', demo);
  }
  function setBusy(busy) {
    state.busy = busy;
    $('weatherHero').setAttribute('aria-busy', String(busy));
    $('refreshButton').disabled = busy;
    $('refreshButton').querySelector('svg').classList.toggle('is-loading', busy);
    $('retryButton').disabled = busy;
  }
  function syncPreferences() {
    ['celsiusButton','fahrenheitButton'].forEach((id, index) => {
      const active = state.unit === (index ? 'f' : 'c');
      $(id).classList.toggle('active', active); $(id).setAttribute('aria-pressed', String(active));
    });
    const isLight = document.documentElement.dataset.theme === 'light';
    $('themeIcon').setAttribute('href', isLight ? '#i-moon' : '#i-sun');
    $('themeButton').setAttribute('aria-label', `Switch to ${isLight ? 'dark' : 'light'} theme`);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', isLight ? '#f3f5f3' : '#10171e');
  }

  async function loadWeather(place, { force = false } = {}) {
    if (!S.validPlace(place)) return toast('Please select a valid city from the search results.');
    const sequence = ++loadSequence;
    ++comparisonSequence; comparisonController?.abort();
    weatherController?.abort(); weatherController = new AbortController();
    const signal = weatherController.signal;
    state.pendingPlace = place;
    setBusy(true); status('Updating forecast'); $('errorBanner').hidden = true;
    if (!state.weather) {
      set('locationName', place.name);
      set('locationRegion', [place.admin1,place.country].filter(Boolean).join(', ').toUpperCase() || 'YOUR LOCAL FORECAST');
    }
    const [forecastResult, airResult] = await Promise.allSettled([
      S.API.forecast(place, { signal, force }), S.API.airQuality(place, { signal, force })
    ]);
    if (sequence !== loadSequence) return;
    setBusy(false);
    if (forecastResult.status === 'rejected') {
      if (forecastResult.reason?.name === 'AbortError') return;
      if (!state.weather) {
        const cached = read('skyline-last-forecast', null);
        if (cached && S.validPlace(cached.place) && S.locationKey(cached.place) === S.locationKey(place) && S.finite(cached.weather?.current?.time) && Array.isArray(cached.weather?.hourly?.time) && Array.isArray(cached.weather?.daily?.time) && cached.weather.hourly.time.length && cached.weather.daily.time.length) {
          state.place=cached.place; state.weather=cached.weather; state.air=cached.air; state.cached=true;
          state.savedWeather.set(S.locationKey(place),state.weather.current);
          render(); renderSaved();
        }
      }
      status(state.cached ? 'Cached forecast' : state.weather ? 'Update unavailable' : 'Connection unavailable');
      set('errorTitle', `Could not load weather for ${place.name}`);
      set('errorMessage', forecastResult.reason?.message || 'Please check your internet connection and try again.');
      $('errorBanner').hidden = false;
      if (state.weather && !state.cached) set('updatedTime', state.demo ? 'Demo · sample data' : `As of ${S.time(state.weather.current.time,timezone())}`);
      return;
    }
    state.place = place; state.weather = forecastResult.value;
    state.air = airResult.status === 'fulfilled' ? airResult.value : null;
    state.demo = false; state.pendingPlace = null; state.selectedDay = -1;
    state.savedWeather.set(S.locationKey(place), state.weather.current);
    write('skyline-place', place); status('Forecast updated');
    state.cached = false; write('skyline-last-forecast', {place, weather:state.weather, air:state.air, savedAt:Date.now()});
    render(); renderSaved(); refreshSaved(force);
  }

  function render() {
    if (!state.weather) return;
    const { current:c, daily:d, hourly:h } = state.weather;
    const tz = timezone(), unit = state.unit;
    set('locationName', state.place.name);
    set('locationRegion', [state.place.admin1, state.place.country].filter(Boolean).join(', ').toUpperCase() || `LAT ${state.place.latitude.toFixed(2)} · LON ${state.place.longitude.toFixed(2)}`);
    set('todayDate', S.date(c.time, tz, { weekday:'long', month:'long', day:'numeric', year:'numeric' }));
    updateClock();
    set('currentTemp', S.finite(c.temperature_2m) ? Math.round(S.temperature(c.temperature_2m, unit)) : '—');
    set('heroUnit', '°');
    set('currentDescription', S.weather(c.weather_code, c.is_day).label);
    $('heroWeatherIcon').innerHTML = S.weatherSVG(c.weather_code, c.is_day);
    set('feelsLike', S.temp(c.apparent_temperature, unit));
    set('highTemp', S.temp(d.temperature_2m_max?.[0], unit)); set('lowTemp', S.temp(d.temperature_2m_min?.[0], unit));
    set('heroWind', S.wind(c.wind_speed_10m, unit));
    set('heroRain', `${measure(c.relative_humidity_2m, '%')} humidity`);
    set('updatedTime', state.demo ? 'Demo · sample data' : state.cached ? `Cached · ${S.date(c.time,tz,{month:'short',day:'numeric'})} ${S.time(c.time,tz)}` : `As of ${S.time(c.time, tz)}`);
    const kind = S.weather(c.weather_code).kind;
    $('weatherHero').dataset.sky = !c.is_day ? 'night' : ['rain','storm','snow','sleet'].includes(kind) ? 'rain' : ['cloud','fog'].includes(kind) ? 'cloudy' : 'day';
    const saved = state.favorites.some((place) => S.locationKey(place) === S.locationKey(state.place));
    $('favoriteButton').setAttribute('aria-pressed', String(saved));
    $('favoriteButton').setAttribute('aria-label', saved ? 'Remove current city from saved places' : 'Save current city');
    renderOutlook(); renderHourly(); renderWeekly(); renderHighlights(h, c, d); renderAir(); renderSun(); renderAdvanced();
  }

  function updateClock() {
    if (!state.weather) return;
    const now = state.demo ? state.weather.current.time : Date.now() / 1000;
    set('localTime', `${S.date(now, timezone(), { weekday:'short', month:'short', day:'numeric' })} · ${S.time(now, timezone())} local time`);
  }

  function renderOutlook() {
    const d = state.weather.daily, code = d.weather_code?.[0], high = d.temperature_2m_max?.[0];
    const kind = S.weather(code).kind, rain = d.precipitation_probability_max?.[0];
    let title, copy, symbol;
    if (kind === 'storm') { title = 'A stormy outlook'; copy = 'Thunderstorms appear in today’s forecast. Keep an eye on changing conditions as you plan your day.'; symbol = 'cloud'; }
    else if (['snow','sleet'].includes(kind)) { title = 'A wintry kind of day'; copy = 'Snow or freezing precipitation appears in today’s forecast. Check the hourly outlook before heading out.'; symbol = 'cloud'; }
    else if (['rain'].includes(kind) || (S.finite(rain) && rain >= 60)) { title = 'Keep an umbrella close'; copy = 'Rain is in the forecast. The hourly view will help you find a clearer window for your plans.'; symbol = 'drop'; }
    else if (kind === 'fog') { title = 'A softer horizon'; copy = 'Fog may soften the view today. Check visibility and the hourly forecast for changing conditions.'; symbol = 'eye'; }
    else if (S.finite(high) && high >= 35) { title = 'Warmth on the horizon'; copy = `A high of ${S.temp(high, state.unit)} is forecast today. Explore the hourly view to find the cooler parts of the day.`; symbol = 'sun'; }
    else if (['cloud','partly'].includes(kind)) { title = 'A little silver lining'; copy = 'Clouds feature in today’s forecast. A good day to keep your plans flexible and follow the hourly outlook.'; symbol = 'cloud'; }
    else { title = 'A brighter kind of day'; copy = `Clearer skies are in the forecast${S.finite(high) ? `, with a high of ${S.temp(high, state.unit)}` : ''}. A little inspiration for your next adventure.`; symbol = 'sun'; }
    set('outlookTitle', title); set('outlookDescription', copy);
    $('outlookIcon').innerHTML = icon(symbol);
    set('dayRain', measure(rain, '%'));
    $('rainMeter').style.width = `${S.finite(rain) ? S.clamp(rain, 0, 100) : 0}%`;
  }

  function renderHourly() {
    const h = state.weather.hourly, tz = timezone();
    const start = S.hourIndex(h.time, state.demo ? state.weather.current.time : Date.now() / 1000);
    const indices = Array.from({ length:Math.min(state.hours,h.time.length - start) }, (_, i) => start + i);
    const rainy = state.chart === 'rain';
    const suffix = ['rain','humidity'].includes(state.chart) ? '%' : state.chart === 'wind' ? (state.unit === 'f' ? ' mph' : ' km/h') : '°';
    const title = ({temperature:'Temperature',rain:'Rain probability',wind:'Wind speed',humidity:'Relative humidity'})[state.chart];
    const values = indices.map((i) => rainy ? h.precipitation_probability?.[i] : state.chart === 'wind' ? (S.finite(h.wind_speed_10m?.[i]) ? h.wind_speed_10m[i]/(state.unit === 'f'?1.609344:1) : null) : state.chart === 'humidity' ? h.relative_humidity_2m?.[i] : S.temperature(h.temperature_2m?.[i], state.unit));
    const available = values.filter(S.finite);
    let min = ['rain','humidity'].includes(state.chart) ? 0 : Math.floor(Math.min(...available) - 2), max = ['rain','humidity'].includes(state.chart) ? 100 : Math.ceil(Math.max(...available) + 2);
    if (!available.length) { min = 0; max = 1; }
    if (max === min) max = min + 1;
    const width = indices.length * 66;
    $('hourlyScroll').querySelector('.hourly-inner').style.minWidth = `${width}px`;
    const y = (v) => 107 - ((v - min) / (max - min)) * 80;
    const points = values.map((v, i) => S.finite(v) ? { x:i * 66 + 33, y:y(v), v } : null);
    let line = '', connected = false;
    points.forEach((point) => { if (!point) { connected = false; return; } line += `${connected ? 'L' : 'M'}${point.x},${point.y} `; connected = true; });
    const color = ({temperature:'#e8bb77',rain:'#80b6e0',wind:'#a5e5cc',humidity:'#c69bcc'})[state.chart];
    const grid = [27,67,107].map((height) => `<line class="chart-grid" x1="0" x2="${width}" y1="${height}" y2="${height}"/>`).join('');
    const chartMarks = rainy ? points.filter(Boolean).map((point) => `<rect x="${point.x - 13}" y="${point.y}" width="26" height="${Math.max(1,107-point.y)}" rx="4" fill="${color}" opacity=".7"/><text x="${point.x}" y="${point.y-10}" text-anchor="middle" class="chart-label">${Math.round(point.v)}%</text>`).join('') : `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${points.filter(Boolean).map((point) => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="3.5" style="fill:${color}"/><text x="${point.x}" y="${point.y-13}" text-anchor="middle" class="chart-label">${Math.round(point.v)}${suffix}</text>`).join('')}`;
    $('hourlyChart').innerHTML = `<svg viewBox="0 0 ${width} 135" preserveAspectRatio="none" aria-hidden="true">${grid}${chartMarks}</svg>`;
    $('hourlyChart').setAttribute('aria-label', available.length ? `${title} forecast: ${indices.map((i,j) => `${S.time(h.time[i],tz)} ${S.finite(values[j]) ? `${Math.round(values[j])}${suffix}` : 'unavailable'}`).join('; ')}` : 'Hourly forecast data unavailable');
    $('hourlyCards').style.gridTemplateColumns = `repeat(${indices.length},1fr)`;
    $('hourlyCards').innerHTML = indices.map((i,j) => `<div class="hour-card"><span>${j === 0 ? 'Now' : S.date(h.time[i],tz,{ hour:'numeric',hour12:true })}</span>${S.weatherSVG(h.weather_code?.[i],h.is_day?.[i])}<strong>${S.temp(h.temperature_2m?.[i],state.unit)}</strong><small>${icon('drop')}${measure(h.precipitation_probability?.[i],'%')}</small><span class="sr-only">${S.escape(S.weather(h.weather_code?.[i],h.is_day?.[i]).label)}</span></div>`).join('');
    set('chartLegend', title);
    set('chartSummary', available.length ? `${title}: ${S.number(Math.min(...available),1)}${suffix} to ${S.number(Math.max(...available),1)}${suffix} over the next ${state.hours} hours.` : `${title} data is unavailable.`);
    ['temperatureTab','rainTab','windTab','humidityTab'].forEach((id,i) => { const active = state.chart === ['temperature','rain','wind','humidity'][i]; $(id).classList.toggle('active',active); $(id).setAttribute('aria-pressed',String(active)); });
  }

  function renderWeekly() {
    const d = state.weather.daily, tz = timezone();
    const lows = (d.temperature_2m_min || []).filter(S.finite), highs = (d.temperature_2m_max || []).filter(S.finite);
    const min = lows.length ? Math.min(...lows) : 0, max = highs.length ? Math.max(...highs) : 1;
    const span = Math.max(1,max-min);
    $('weeklyList').innerHTML = d.time.slice(0,state.days).map((timestamp,i) => {
      const low = d.temperature_2m_min?.[i], high = d.temperature_2m_max?.[i];
      const left = S.finite(low) ? S.clamp((low-min)/span*100,0,100) : 0;
      const range = S.finite(low) && S.finite(high) ? S.clamp((high-low)/span*100,2,100-left) : 0;
      const label = i === 0 ? 'Today' : S.date(timestamp,tz,{ weekday:'short' });
      return `<button class="day-row ${state.selectedDay === i ? 'selected' : ''}" data-day="${i}" aria-expanded="${state.selectedDay === i}" aria-controls="dayDetail" aria-label="${label}, ${S.escape(S.weather(d.weather_code?.[i]).label)}, high ${S.temp(high,state.unit)}, low ${S.temp(low,state.unit)}. Show details."><span>${label}${state.days===14?`<small class="day-date">${S.date(timestamp,tz,{month:'short',day:'numeric'})}</small>`:''}</span>${S.weatherSVG(d.weather_code?.[i])}<span class="day-rain">${icon('drop')}${measure(d.precipitation_probability_max?.[i],'%')}</span><span class="day-temp-range"><span class="low">${S.temp(low,state.unit)}</span><span class="range-track"><span style="margin-left:${left}%;width:${range}%"></span></span><span>${S.temp(high,state.unit)}</span></span>${icon('arrow')}</button>`;
    }).join('');
    set('weeklyTitle',`The next ${state.days} days`);
    ['sevenDayButton','fourteenDayButton'].forEach((id,i)=>{ const active=state.days===(i?14:7); $(id).classList.toggle('active',active); $(id).setAttribute('aria-pressed',String(active)); });
    renderDayDetail();
  }

  function renderDayDetail() {
    const i = state.selectedDay, d = state.weather.daily, tz = timezone();
    $('dayDetail').hidden = i < 0;
    if (i < 0) return;
    const precipitation = d.precipitation_sum?.[i];
    const amount = S.finite(precipitation) ? `${S.number(state.unit === 'f' ? precipitation / 25.4 : precipitation,1)} ${state.unit === 'f' ? 'in' : 'mm'}` : '—';
    $('dayDetail').innerHTML = `<strong>${S.date(d.time[i],tz,{weekday:'long',month:'short',day:'numeric'})} · ${S.escape(S.weather(d.weather_code?.[i]).label)}</strong><div class="day-detail-grid"><span>Rain total: ${amount}</span><span>Max wind: ${S.wind(d.wind_speed_10m_max?.[i],state.unit)}</span><span>Sunrise: ${S.time(d.sunrise?.[i],tz)}</span><span>Sunset: ${S.time(d.sunset?.[i],tz)}</span><span>Max UV: ${S.number(d.uv_index_max?.[i],1)} · ${S.uv(d.uv_index_max?.[i])}</span><span>Rain chance: ${measure(d.precipitation_probability_max?.[i],'%')}</span></div>`;
  }

  function renderHighlights(h,c,d) {
    const hour = S.hourIndex(h.time, state.demo ? c.time : Date.now()/1000), unit = state.unit;
    set('humidity', S.number(c.relative_humidity_2m));
    $('humidityMeter').style.width = `${S.finite(c.relative_humidity_2m) ? S.clamp(c.relative_humidity_2m,0,100) : 0}%`;
    set('humidityNote', !S.finite(c.relative_humidity_2m) ? 'Humidity unavailable' : c.relative_humidity_2m < 30 ? 'Low relative humidity' : c.relative_humidity_2m > 70 ? 'High relative humidity' : 'Moderate relative humidity');
    set('windSpeed', S.finite(c.wind_speed_10m) ? S.number(unit === 'f' ? c.wind_speed_10m/1.609344 : c.wind_speed_10m) : '—');
    set('windUnit', unit === 'f' ? 'mph' : 'km/h');
    set('windDirection', S.direction(c.wind_direction_10m));
    $('windArrow').style.transform = `rotate(${S.finite(c.wind_direction_10m) ? c.wind_direction_10m : 0}deg)`;
    set('windGust', `Gusts ${S.wind(c.wind_gusts_10m,unit)}`);
    const uv = d.uv_index_max?.[0]; set('uvIndex', S.number(uv,1)); set('uvLabel',S.uv(uv));
    $('uvMarker').style.left = `${S.finite(uv) ? S.clamp(uv/12*100,0,99) : 0}%`;
    $('uvMarker').hidden = !S.finite(uv);
    const visibility = h.visibility?.[hour];
    set('visibility', S.distance(visibility,unit)); set('visibilityUnit',unit === 'f' ? 'mi' : 'km');
    set('visibilityNote', !S.finite(visibility) ? 'Visibility unavailable' : visibility >= 10000 ? 'A clear view of the horizon' : visibility >= 4000 ? 'Some haze on the horizon' : 'Reduced visibility');
  }

  function renderAir() {
    const c = state.air?.current, value = c?.us_aqi, category = S.aqi(value);
    set('aqiNumber',S.number(value)); set('aqiLabel',category.label); set('aqiDescription',category.description);
    $('aqiNumber').style.color = category.color;
    $('aqiMarker').hidden = !S.finite(value);
    $('aqiMarker').style.left = `${S.finite(value) ? S.clamp(value/500*100,0,99) : 0}%`;
    [['pm25','pm2_5'],['pm10','pm10'],['ozone','ozone'],['no2','nitrogen_dioxide']].forEach(([id,key]) => set(id,S.number(c?.[key],1)));
    set('airSource', state.demo ? 'Demo · sample air-quality data' : c ? `Model forecast · CAMS via Open-Meteo · ${S.time(c.time,timezone())}` : 'Air-quality request unavailable. Refresh to try again.');
  }

  function renderSun() {
    const d = state.weather.daily, rise = d.sunrise?.[0], setting = d.sunset?.[0], duration = d.daylight_duration?.[0], tz = timezone();
    set('sunrise',S.time(rise,tz)); set('sunset',S.time(setting,tz));
    set('daylightDuration', S.finite(duration) ? `${Math.floor(duration/3600)} hours ${Math.round(duration%3600/60)} minutes of daylight` : 'Daylight duration unavailable');
    const now = state.demo ? state.weather.current.time : Date.now()/1000;
    const valid = S.finite(rise) && S.finite(setting) && setting > rise;
    const t = valid ? S.clamp((now-rise)/(setting-rise),0,1) : 0;
    const x = (1-t)*(1-t)*25 + 2*(1-t)*t*180 + t*t*335;
    const y = (1-t)*(1-t)*108 + 2*(1-t)*t*(-62) + t*t*108;
    $('sunPosition').setAttribute('transform',`translate(${x} ${y})`);
    $('sunPosition').style.opacity = valid ? '1' : '0';
    $('sunProgressPath').style.strokeDasharray = `${t*100} 100`;
    set('daylightLabel', !valid ? 'UNAVAILABLE' : now < rise ? 'BEFORE SUNRISE' : now > setting ? 'AFTER SUNSET' : 'DAYLIGHT');
    set('sunPathLabel', !valid ? 'Sunrise and sunset are unavailable.' : now < rise ? 'A new day is on the horizon.' : now > setting ? 'The sun has set. Time to unwind.' : `${Math.round(t*100)}% of daylight has passed.`);
  }

  function renderSaved() {
    $('savedPlaces').innerHTML = state.favorites.length ? state.favorites.map((place) => {
      const key = S.locationKey(place), weather = state.savedWeather.get(key);
      const active = S.locationKey(state.place) === key;
      return `<div class="saved-place ${active ? 'active' : ''}"><button data-place="${key}" aria-label="Show weather for ${S.escape(place.name)}"><span><span class="saved-place-name">${S.escape(place.name)}</span><span class="saved-place-meta">${S.escape(weather ? S.weather(weather.weather_code,weather.is_day).label : state.savedLoading.has(key) ? 'Loading…' : 'Select to view')}</span></span><span class="saved-place-temp">${S.temp(weather?.temperature_2m,state.unit)}</span>${S.weatherSVG(weather?.weather_code,weather?.is_day)}</button><button class="remove-place" data-remove="${key}" aria-label="Remove ${S.escape(place.name)} from saved places">${icon('close')}</button></div>`;
    }).join('') : '<p class="muted text-xs leading-6">Your places will appear here.<br>Search a city, then tap its star to save it.</p>';
  }
  async function refreshSaved(force = false) {
    await Promise.allSettled(state.favorites.map(async (place) => {
      const key = S.locationKey(place);
      if (state.savedLoading.has(key)) return;
      if (key === S.locationKey(state.place) && state.weather && !state.demo) { state.savedWeather.set(key,state.weather.current); return; }
      state.savedLoading.add(key); renderSaved();
      try { const data = await S.API.current(place,{force}); if (data.current) state.savedWeather.set(key,data.current); }
      catch { /* Other cities can still be searched if a saved-place request fails. */ }
      finally { state.savedLoading.delete(key); renderSaved(); }
    }));
    renderSaved();
  }
  function toggleFavorite() {
    const key = S.locationKey(state.place);
    if (state.favorites.some((place) => S.locationKey(place) === key)) {
      state.favorites = state.favorites.filter((place) => S.locationKey(place) !== key);
      toast(`${state.place.name} removed from your places.`);
    } else {
      if (state.favorites.length >= 5) return toast('You can save 5 places. Remove one to make room.');
      state.favorites.push({...state.place});
      if (state.weather) state.savedWeather.set(key,state.weather.current);
      toast(`${state.place.name} saved. A little closer to home.`);
    }
    write('skyline-favorites',state.favorites); renderSaved(); if (state.weather) render();
  }

  function closeSearch() {
    $('searchResults').hidden = true; $('citySearch').setAttribute('aria-expanded','false');
    $('citySearch').removeAttribute('aria-activedescendant'); state.searchIndex = -1;
  }
  function showSearch(message) {
    $('searchResults').hidden = false; $('citySearch').setAttribute('aria-expanded','true');
    if (message) $('searchResults').innerHTML = `<div class="search-message" role="status">${S.escape(message)}</div>`;
  }
  async function searchCities(query) {
    clearTimeout(searchTimer); searchController?.abort();
    const sequence = ++searchSequence;
    state.searchResults = []; state.searchIndex = -1;
    $('citySearch').removeAttribute('aria-activedescendant');
    if (query.trim().length < 2) { closeSearch(); return; }
    searchController = new AbortController(); showSearch('Finding your corner of the world…');
    try {
      const results = await S.API.search(query,searchController.signal);
      if (sequence !== searchSequence) return;
      state.searchResults = results;
      if (!results.length) return showSearch('No places found. Try a city name, or add a country.');
      $('searchResults').innerHTML = results.map((place,i) => `<div id="search-option-${i}" class="search-option" role="option" aria-selected="false" data-search-index="${i}">${icon('pin')}<span><strong>${S.escape(place.name)}</strong><small>${S.escape([place.admin1,place.country].filter(Boolean).join(', '))}</small></span></div>`).join('');
    } catch (error) { if (sequence === searchSequence && error.name !== 'AbortError') showSearch(error.message); }
  }
  function selectSearch(index) {
    const place = state.searchResults[index];
    if (!place) return;
    $('citySearch').value = ''; closeSearch();
    loadWeather(place); closeSidebar();
    $('weatherHero').scrollIntoView({ behavior:'smooth',block:'start' });
  }
  function closeSidebar() {
    if ($('sidebar').contains(document.activeElement) && window.innerWidth < 1280) $('menuButton').focus();
    $('sidebar').classList.remove('open'); $('sidebarBackdrop').hidden = true;
    $('menuButton').setAttribute('aria-expanded','false');
    $('menuButton').setAttribute('aria-label','Open navigation');
    $('sidebar').inert = window.innerWidth < 1280;
  }
  function useLocation() {
    if (!navigator.geolocation) return toast('Location detection is unavailable. Please search for your city.');
    $('locationButton').disabled = true; toast('Finding your location…');
    navigator.geolocation.getCurrentPosition((position) => {
      $('locationButton').disabled = false;
      loadWeather({ name:'Your location', latitude:position.coords.latitude, longitude:position.coords.longitude, country:'', admin1:'' });
    }, (error) => {
      $('locationButton').disabled = false;
      toast(error.code === 1 ? 'Location permission was denied. Search for your city instead.' : error.code === 3 ? 'Location detection timed out. Please try again or search a city.' : 'Your location could not be found. Please search a city.');
    }, { enableHighAccuracy:false, timeout:12000, maximumAge:300000 });
  }

  function renderAdvanced() {
    const c=state.weather.current, d=state.weather.daily;
    set('pressureValue',S.number(c.pressure_msl));
    set('dewPointValue',S.finite(c.dew_point_2m)?S.number(S.temperature(c.dew_point_2m,state.unit),1):'—');
    set('dewPointUnit',state.unit==='f'?'°F':'°C');
    set('cloudCoverValue',S.number(c.cloud_cover));
    set('precipitationValue',S.finite(d.precipitation_sum?.[0])?S.number(d.precipitation_sum[0]/(state.unit==='f'?25.4:1),1):'—');
    set('precipitationUnit',state.unit==='f'?'in':'mm');
    renderPlanner(); renderMap(); syncComparison();
  }

  function renderPlanner() {
    const h=state.weather.hourly, now=state.demo?state.weather.current.time:Date.now()/1000;
    let start=h.time.findIndex(t=>t>=now); if(start<0) start=h.time.length;
    const candidates=[];
    for(let i=start;i<Math.min(start+48,h.time.length-2);i++) {
      const indices=[i,i+1,i+2];
      if(indices.some(j=>!h.is_day?.[j]||!S.finite(h.temperature_2m?.[j])||!S.finite(h.precipitation_probability?.[j])||!S.finite(h.wind_speed_10m?.[j]))) continue;
      const temps=indices.map(j=>h.temperature_2m[j]), rains=indices.map(j=>h.precipitation_probability[j]), winds=indices.map(j=>h.wind_speed_10m[j]);
      const high=Math.max(...temps),low=Math.min(...temps),rain=Math.max(...rains),wind=Math.max(...winds);
      const score=rain*2+Math.max(0,high-30)*3+Math.max(0,12-low)*2+wind*.6+(i-start)*.04;
      candidates.push({i,score,high,low,rain,wind});
    }
    candidates.sort((a,b)=>a.score-b.score);
    const best=candidates[0];
    if(!best) { $('plannerContent').innerHTML='<p class="muted">A complete daytime planning window is not available in this forecast.</p>'; return; }
    const t=h.time[best.i],tz=timezone();
    $('plannerContent').innerHTML=`<div class="planner-window"><span>${S.date(t,tz,{weekday:'long',month:'short',day:'numeric'})}</span><strong>${S.time(t,tz)} <span>—</span> ${S.time(t+3*3600,tz)}</strong><small>${state.demo?'Sample forecast':state.cached?'Saved forecast':'Suggested 3-hour window'}</small></div><div class="planner-stat">${icon('drop')}<strong>${S.number(best.rain)}%</strong><span>peak rain chance</span></div><div class="planner-stat">${icon('thermometer')}<strong>${S.temp(best.low,state.unit)}–${S.temp(best.high,state.unit)}</strong><span>temperature range</span></div><div class="planner-stat">${icon('wind')}<strong>${S.wind(best.wind,state.unit)}</strong><span>highest wind speed</span></div>`;
  }

  function renderMap() {
    const p=state.place,lat=S.clamp(p.latitude,-85,85),lon=p.longitude;
    const delta=.08;
    const params=new URLSearchParams({bbox:[S.clamp(lon-delta,-180,180),S.clamp(lat-delta,-85,85),S.clamp(lon+delta,-180,180),S.clamp(lat+delta,-85,85)].join(','),layer:'mapnik',marker:`${lat},${lon}`});
    const url=`https://www.openstreetmap.org/export/embed.html?${params}`;
    if($('locationMap').getAttribute('src')!==url) $('locationMap').src=url;
    $('locationMap').title=`OpenStreetMap location: ${p.name}`;
    $('openMapLink').href=`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`;
    set('mapCaption',`${p.name} · ${p.latitude.toFixed(3)}°, ${p.longitude.toFixed(3)}°`);
    set('mapWeatherBadge',`${state.demo?'Demo · ':state.cached?'Cached · ':''}${S.temp(state.weather.current.temperature_2m,state.unit)} · ${S.weather(state.weather.current.weather_code,state.weather.current.is_day).label}`);
  }

  function syncComparison() {
    const choices=state.favorites.filter(place=>S.locationKey(place)!==S.locationKey(state.place));
    if(!choices.length) { $('compareSelect').innerHTML='<option>No other saved places</option>'; $('compareSelect').disabled=true; $('comparisonContent').innerHTML='<p class="muted">Search and save another city to compare its forecast.</p>'; state.comparisonPlace=''; return; }
    $('compareSelect').disabled=false;
    const selection=choices.some(place=>S.locationKey(place)===state.comparisonPlace)?state.comparisonPlace:S.locationKey(choices[0]);
    const changed=selection!==state.comparisonPlace;
    state.comparisonPlace=selection;
    $('compareSelect').innerHTML=choices.map(place=>`<option value="${S.locationKey(place)}">${S.escape(place.name)}</option>`).join('');
    $('compareSelect').value=selection;
    if(changed) state.comparison=null;
    if(state.demo) {
      const place=choices.find(place=>S.locationKey(place)===selection);
      state.comparison={place,weather:{current:{...state.weather.current,temperature_2m:24,apparent_temperature:25,weather_code:2,wind_speed_10m:16,relative_humidity_2m:58},daily:{...state.weather.daily,temperature_2m_max:[26],temperature_2m_min:[18],precipitation_probability_max:[20]}}};
      renderComparison();return;
    }
    if(state.cached) { $('comparisonContent').innerHTML='<p class="muted">City comparison needs a live connection. Refresh when you are online.</p>';return; }
    if(state.comparison && S.locationKey(state.comparison.place)===selection) renderComparison();
    else updateComparison();
  }

  async function updateComparison() {
    const place=state.favorites.find(place=>S.locationKey(place)===state.comparisonPlace);
    if(!place||!state.weather) return;
    const sequence=++comparisonSequence;
    comparisonController?.abort(); comparisonController=new AbortController();
    const mainKey=S.locationKey(state.place);
    $('comparisonContent').innerHTML='<p class="muted">Bringing the two forecasts together…</p>';
    try {
      const weather=await S.API.forecast(place,{signal:comparisonController.signal});
      if(sequence!==comparisonSequence||mainKey!==S.locationKey(state.place)||state.demo||state.cached) return;
      state.comparison={place,weather};renderComparison();
    } catch(error) {
      if(sequence===comparisonSequence&&mainKey===S.locationKey(state.place)&&!state.demo&&!state.cached&&error.name!=='AbortError') $('comparisonContent').innerHTML=`<p class="muted">${S.escape(error.message)} Refresh or choose another saved city to retry.</p>`;
    }
  }

  function renderComparison() {
    if(!state.comparison) return;
    const a=state.weather,b=state.comparison.weather,other=state.comparison.place;
    const rows=[['Feels like',S.temp(a.current.apparent_temperature,state.unit),S.temp(b.current.apparent_temperature,state.unit)],['High / low',`${S.temp(a.daily.temperature_2m_max?.[0],state.unit)} / ${S.temp(a.daily.temperature_2m_min?.[0],state.unit)}`,`${S.temp(b.daily.temperature_2m_max?.[0],state.unit)} / ${S.temp(b.daily.temperature_2m_min?.[0],state.unit)}`],['Rain chance',measure(a.daily.precipitation_probability_max?.[0],'%'),measure(b.daily.precipitation_probability_max?.[0],'%')],['Wind',S.wind(a.current.wind_speed_10m,state.unit),S.wind(b.current.wind_speed_10m,state.unit)],['Humidity',measure(a.current.relative_humidity_2m,'%'),measure(b.current.relative_humidity_2m,'%')]];
    $('comparisonContent').innerHTML=`<div class="comparison-cities"><div><span>${S.escape(state.place.name)}</span>${S.weatherSVG(a.current.weather_code,a.current.is_day)}<strong>${S.temp(a.current.temperature_2m,state.unit)}</strong></div><span class="compare-vs">VS</span><div><span>${S.escape(other.name)}</span>${S.weatherSVG(b.current.weather_code,b.current.is_day)}<strong>${S.temp(b.current.temperature_2m,state.unit)}</strong></div></div><table class="comparison-table"><caption class="sr-only">Weather comparison: ${S.escape(state.place.name)} and ${S.escape(other.name)}</caption><thead class="sr-only"><tr><th>Metric</th><th>${S.escape(state.place.name)}</th><th>${S.escape(other.name)}</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${row[0]}</th><td>${row[1]}</td><td>${row[2]}</td></tr>`).join('')}</tbody></table><p class="comparison-note">${state.demo?'Demo · sample comparison data':'Current model conditions · local daily highs and lows'}</p>`;
  }

  function exportForecast() {
    if(!state.weather) return toast('Load a forecast before downloading.');
    const cell=value=>{ let text=String(value??''); if(typeof value==='string'&&/^[=+\-@]/.test(text)) text="'"+text; return '"'+text.replace(/"/g,'""')+'"'; };
    const d=state.weather.daily,mode=state.demo?'Demo sample':state.cached?'Cached forecast':'Live forecast';
    const numeric=(v,convert)=>S.finite(v)?Math.round((convert?convert(v):v)*10)/10:'';
    const rows=[['City','Date','Time zone',`High (${state.unit==='f'?'F':'C'})`,`Low (${state.unit==='f'?'F':'C'})`,'Conditions','Rain chance (%)',`Precipitation (${state.unit==='f'?'in':'mm'})`,`Max wind (${state.unit==='f'?'mph':'km/h'})`,'Max UV','Data mode','Forecast as of (UTC)']];
    d.time.forEach((timestamp,i)=>rows.push([state.place.name,S.date(timestamp,timezone(),{year:'numeric',month:'2-digit',day:'2-digit'}),timezone(),numeric(d.temperature_2m_max?.[i],v=>S.temperature(v,state.unit)),numeric(d.temperature_2m_min?.[i],v=>S.temperature(v,state.unit)),S.weather(d.weather_code?.[i]).label,numeric(d.precipitation_probability_max?.[i]),numeric(d.precipitation_sum?.[i],v=>v/(state.unit==='f'?25.4:1)),numeric(d.wind_speed_10m_max?.[i],v=>v/(state.unit==='f'?1.609344:1)),numeric(d.uv_index_max?.[i]),mode,new Date(state.weather.current.time*1000).toISOString()]));
    const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`Skyline_${state.place.name.replace(/[^a-z0-9]+/gi,'_')}_14_day_forecast.csv`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Your forecast CSV has been downloaded.');
  }

  function loadDemo() {
    ++loadSequence; weatherController?.abort(); ++comparisonSequence; comparisonController?.abort();
    state.place = defaults[0]; state.pendingPlace = null; state.demo = true; state.selectedDay = -1;
    // Explicit sample data, generated relative to today in Asia/Karachi.
    const local = new Date(Date.now()+5*3600*1000);
    const midnight = Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())/1000-5*3600;
    const now = midnight+14*3600;
    const hours = Array.from({length:14*24},(_,i)=>midnight+i*3600);
    const days = Array.from({length:14},(_,i)=>midnight+i*86400);
    const codes = [1,0,2,3,61,2,0], highs = [31,33,32,29,27,30,32], lows = [21,22,23,22,20,21,22], rain = [5,0,10,25,75,20,5];
    [codes,highs,lows,rain].forEach(values=>values.push(...values));
    const tempByHour = hours.map((_,i)=>Number((lows[Math.floor(i/24)]+(highs[Math.floor(i/24)]-lows[Math.floor(i/24)])*(.5+.5*Math.cos((i%24-14)/24*Math.PI*2))).toFixed(1)));
    state.weather = { timezone:'Asia/Karachi', current:{time:now,temperature_2m:31,relative_humidity_2m:42,apparent_temperature:32,is_day:1,weather_code:1,wind_speed_10m:12,wind_direction_10m:45,wind_gusts_10m:19,pressure_msl:1012,dew_point_2m:17,cloud_cover:25}, hourly:{time:hours,temperature_2m:tempByHour,relative_humidity_2m:hours.map((_,i)=>42+(i%24<6?20:0)),wind_speed_10m:hours.map((_,i)=>10+i%7),precipitation_probability:hours.map((_,i)=>rain[Math.floor(i/24)]),weather_code:hours.map((_,i)=>codes[Math.floor(i/24)]),visibility:hours.map(()=>15000),is_day:hours.map((_,i)=>i%24>=6&&i%24<18?1:0)},daily:{time:days,weather_code:codes,temperature_2m_max:highs,temperature_2m_min:lows,sunrise:days.map(t=>t+6.1*3600),sunset:days.map(t=>t+17.7*3600),daylight_duration:days.map(()=>11.6*3600),uv_index_max:Array.from({length:14},(_,i)=>[6.3,7.1,6.2,4.4,3.1,6.1,7.2][i%7]),precipitation_sum:Array.from({length:14},(_,i)=>[0,0,0.3,1,8.5,0.5,0][i%7]),precipitation_probability_max:rain,wind_speed_10m_max:Array.from({length:14},(_,i)=>[16,18,15,23,22,14,17][i%7])} };
    state.air = {current:{time:now,us_aqi:64,pm2_5:18.2,pm10:31.5,ozone:74.1,nitrogen_dioxide:12.3}};
    state.cached=false; state.comparison=null; state.savedWeather.clear(); state.savedWeather.set(S.locationKey(state.place),state.weather.current);
    setBusy(false); $('errorBanner').hidden = true;
    status('Demo · sample data',true); render(); renderSaved();
    toast('Demo mode: sample data for Bahawalpur. Refresh to return to live weather.');
  }

  $('citySearch').addEventListener('input',() => {
    searchController?.abort(); ++searchSequence; state.searchResults = []; closeSearch(); clearTimeout(searchTimer);
    const query = $('citySearch').value;
    if (query.trim().length >= 2) { showSearch('Searching…'); searchTimer = setTimeout(()=>searchCities(query),300); }
  });
  $('searchForm').addEventListener('submit',(event) => {
    event.preventDefault();
    if (state.searchResults.length) selectSearch(Math.max(0,state.searchIndex));
    else searchCities($('citySearch').value);
  });
  $('citySearch').addEventListener('keydown',(event) => {
    if (event.key === 'Escape') { ++searchSequence; searchController?.abort(); clearTimeout(searchTimer); closeSearch(); return; }
    if (!['ArrowDown','ArrowUp'].includes(event.key) || !state.searchResults.length) return;
    event.preventDefault(); showSearch();
    state.searchIndex = state.searchIndex === -1 ? (event.key === 'ArrowDown' ? 0 : state.searchResults.length-1) : (state.searchIndex+(event.key === 'ArrowDown'?1:-1)+state.searchResults.length)%state.searchResults.length;
    document.querySelectorAll('.search-option').forEach((option,i) => { option.classList.toggle('selected',i===state.searchIndex); option.setAttribute('aria-selected',String(i===state.searchIndex)); });
    $('citySearch').setAttribute('aria-activedescendant',`search-option-${state.searchIndex}`);
  });
  $('searchResults').addEventListener('click',(event) => { const option = event.target.closest('[data-search-index]'); if (option) selectSearch(Number(option.dataset.searchIndex)); });
  document.addEventListener('click',(event) => { if (!event.target.closest('.search-container')) { ++searchSequence; searchController?.abort(); clearTimeout(searchTimer); closeSearch(); } });
  document.addEventListener('keydown',(event) => {
    if (event.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName) && !event.ctrlKey && !event.metaKey) { event.preventDefault(); $('citySearch').focus(); }
    if (event.key === 'Escape') closeSidebar();
    if (event.key === 'Tab' && $('sidebar').classList.contains('open')) {
      const items = Array.from($('sidebar').querySelectorAll('a[href],button:not(:disabled)'));
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }
  });
  $('locationButton').addEventListener('click',useLocation);
  $('hoursSelect').addEventListener('change',()=>{state.hours=Number($('hoursSelect').value)===48?48:24;if(state.weather)renderHourly();});
  ['sevenDayButton','fourteenDayButton'].forEach((id,i)=>$(id).addEventListener('click',()=>{state.days=i?14:7;state.selectedDay=-1;if(state.weather)renderWeekly();}));
  $('compareSelect').addEventListener('change',()=>{state.comparisonPlace=$('compareSelect').value;state.comparison=null;syncComparison();});
  $('exportButton').addEventListener('click',exportForecast);
  $('printButton').addEventListener('click',()=>{if(!state.weather)return toast('Load a forecast before printing.');window.print();});
  document.querySelectorAll('[data-quick]').forEach(button=>button.addEventListener('click',()=>{ $('citySearch').value=button.dataset.quick; $('citySearch').focus(); searchCities(button.dataset.quick); }));
  $('refreshButton').addEventListener('click',()=>loadWeather(state.pendingPlace||state.place,{force:true}));
  $('retryButton').addEventListener('click',()=>loadWeather(state.pendingPlace||state.place,{force:true}));
  $('demoButton').addEventListener('click',loadDemo);
  $('favoriteButton').addEventListener('click',toggleFavorite);
  $('savedPlaces').addEventListener('click',(event) => {
    const remove = event.target.closest('[data-remove]'), placeButton = event.target.closest('[data-place]');
    if (remove) { state.favorites = state.favorites.filter(place=>S.locationKey(place)!==remove.dataset.remove); write('skyline-favorites',state.favorites); renderSaved(); if (state.weather) render(); toast('Place removed from your favorites.'); }
    else if (placeButton) { const place = state.favorites.find(place=>S.locationKey(place)===placeButton.dataset.place); if (place) { loadWeather(place); closeSidebar(); } }
  });
  $('addPlace').addEventListener('click',()=>{ closeSidebar(); $('citySearch').focus(); toast('Search a city, then tap its star to save it.'); });
  ['celsiusButton','fahrenheitButton'].forEach((id,i)=>$(id).addEventListener('click',()=>{ state.unit = i?'f':'c'; write('skyline-unit',state.unit); syncPreferences(); render(); renderSaved(); }));
  $('themeButton').addEventListener('click',()=>{ const theme = document.documentElement.dataset.theme==='light'?'dark':'light'; document.documentElement.dataset.theme=theme; try { localStorage.setItem('skyline-theme',theme); } catch {} syncPreferences(); });
  ['temperatureTab','rainTab','windTab','humidityTab'].forEach((id,i)=>$(id).addEventListener('click',()=>{ state.chart=['temperature','rain','wind','humidity'][i]; if(state.weather) renderHourly(); }));
  $('weeklyList').addEventListener('click',(event)=>{ const day=event.target.closest('[data-day]'); if(!day) return; state.selectedDay=state.selectedDay===Number(day.dataset.day)?-1:Number(day.dataset.day); renderWeekly(); $('weeklyList').querySelector(`[data-day="${day.dataset.day}"]`)?.focus({preventScroll:true}); });
  $('hourlyPrev').addEventListener('click',()=>$('hourlyScroll').scrollBy({left:-396,behavior:'smooth'}));
  $('hourlyNext').addEventListener('click',()=>$('hourlyScroll').scrollBy({left:396,behavior:'smooth'}));
  $('menuButton').addEventListener('click',()=>{ const open=!$('sidebar').classList.contains('open'); if (!open) return closeSidebar(); $('sidebar').inert=false; $('sidebar').classList.add('open'); $('sidebarBackdrop').hidden=false; $('menuButton').setAttribute('aria-expanded','true'); $('menuButton').setAttribute('aria-label','Close navigation'); $('sidebar').querySelector('a').focus(); });
  $('sidebarBackdrop').addEventListener('click',closeSidebar);
  window.addEventListener('resize',()=>{ if(window.innerWidth>=1280) closeSidebar(); else if (!$('sidebar').classList.contains('open')) $('sidebar').inert=true; });
  document.querySelectorAll('[data-nav]').forEach((link)=>link.addEventListener('click',()=>{ document.querySelectorAll('[data-nav]').forEach(item=>item.classList.toggle('active',item===link)); closeSidebar(); }));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries)=>{ const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio); if(visible[0]) document.querySelectorAll('[data-nav]').forEach(link=>link.classList.toggle('active',link.dataset.nav===visible[0].target.id)); },{rootMargin:'-5% 0px -40% 0px',threshold:[0,.3,.6]});
    ['overview','hourly','weekly','air-quality','explore'].forEach(id=>observer.observe($(id)));
  }
  $('aboutButton').addEventListener('click',()=>$('aboutDialog').showModal());
  $('closeAbout').addEventListener('click',()=>$('aboutDialog').close());
  $('aboutDialog').addEventListener('click',(event)=>{ if(event.target===$('aboutDialog')) { const r=$('aboutDialog').getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) $('aboutDialog').close(); } });
  setInterval(()=>{ updateClock(); if(state.weather) renderSun(); },60000);
  setInterval(()=>{ if(document.visibilityState==='visible'&&!state.busy&&!state.demo) loadWeather(state.place,{force:true}); },15*60000);
  syncPreferences(); closeSidebar(); renderSaved();
  if(new URLSearchParams(window.location.search).get('demo')==='1') loadDemo();
  else loadWeather(state.place);
})();
