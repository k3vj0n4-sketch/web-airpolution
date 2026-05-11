// ═══════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════
let STATIONS = [];
let TABLE_RAW = [];
let tableFiltered = [];
let currentPage = 1;
const PER_PAGE = 10;

const MONTHS_LABEL = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const FORECAST_DAYS  = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
let MONTHLY_PM10 = [];
let MONTHLY_O3   = [];
let FORECAST_PM10  = [];
let FORECAST_UPPER = [];

// Load data dari CSV
async function loadCSVData() {
  try {
    const response = await fetch('ispu_dki_all.csv');
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');
    
    console.log('📊 Loading ispu_dki_all.csv...');
    console.log('Total lines:', lines.length);
    
    const rawData = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length >= 10) {
        // Skip baris dengan stasiun kosong atau tidak valid
        if (!values[1] || values[1].trim() === '') {
          console.warn('⚠️ Skipping row', i, '- empty station name');
          continue;
        }
        
        // Parse nilai, handle empty values
        const pm25 = values[2] ? parseFloat(values[2]) : 0;
        const pm10 = values[3] ? parseFloat(values[3]) : 0;
        const so2 = values[4] ? parseFloat(values[4]) : 0;
        const co = values[5] ? parseFloat(values[5]) : 0;
        const o3 = values[6] ? parseFloat(values[6]) : 0;
        const no2 = values[7] ? parseFloat(values[7]) : 0;
        const max = values[8] ? parseFloat(values[8]) : 0;
        
        rawData.push({
          tanggal: values[0],
          stasiun: values[1].trim(),
          pm25: pm25,
          pm10: pm10,
          so2: so2,
          co: co,
          o3: o3,
          no2: no2,
          max: max,
          critical: values[9],
          categori: values[10]
        });
      }
    }
    
    console.log('✅ Parsed', rawData.length, 'rows');
    
    // Build TABLE_RAW dari CSV
    TABLE_RAW = rawData.map(row => ({
      date: row.tanggal,
      station: row.stasiun,
      pm25: Math.round(row.pm25),
      pm10: Math.round(row.pm10),
      so2: Math.round(row.so2),
      co: Math.round(row.co),
      o3: Math.round(row.o3),
      no2: Math.round(row.no2),
      max: Math.round(row.max),
      cat: row.categori
    }));
    
    // Extract unique stations dan hitung rata-rata
    const stationMap = {};
    rawData.forEach(row => {
      // Skip jika stasiun kosong
      if (!row.stasiun || row.stasiun.trim() === '') return;
      
      if (!stationMap[row.stasiun]) {
        stationMap[row.stasiun] = {
          name: row.stasiun,
          pm25: [],
          pm10: [],
          so2: [],
          co: [],
          o3: [],
          no2: [],
          categories: []
        };
      }
      if (row.pm25 > 0) stationMap[row.stasiun].pm25.push(row.pm25);
      if (row.pm10 > 0) stationMap[row.stasiun].pm10.push(row.pm10);
      if (row.so2 > 0) stationMap[row.stasiun].so2.push(row.so2);
      if (row.co > 0) stationMap[row.stasiun].co.push(row.co);
      if (row.o3 > 0) stationMap[row.stasiun].o3.push(row.o3);
      if (row.no2 > 0) stationMap[row.stasiun].no2.push(row.no2);
      stationMap[row.stasiun].categories.push(row.categori);
    });
    
    console.log('📍 Stations found:', Object.keys(stationMap));
    
    // Build STATIONS array
    STATIONS = Object.keys(stationMap).map((key, idx) => {
      const st = stationMap[key];
      const avgPM25 = st.pm25.length > 0 ? Math.round(st.pm25.reduce((a,b) => a+b, 0) / st.pm25.length) : 0;
      const avgPM10 = st.pm10.length > 0 ? Math.round(st.pm10.reduce((a,b) => a+b, 0) / st.pm10.length) : 0;
      const avgSO2 = st.so2.length > 0 ? Math.round(st.so2.reduce((a,b) => a+b, 0) / st.so2.length) : 0;
      const avgCO = st.co.length > 0 ? Math.round(st.co.reduce((a,b) => a+b, 0) / st.co.length) : 0;
      const avgO3 = st.o3.length > 0 ? Math.round(st.o3.reduce((a,b) => a+b, 0) / st.o3.length) : 0;
      const avgNO2 = st.no2.length > 0 ? Math.round(st.no2.reduce((a,b) => a+b, 0) / st.no2.length) : 0;
      
      console.log(`  ${key}: PM2.5=${avgPM25}, PM10=${avgPM10}, O3=${avgO3}, CO=${avgCO}, NO2=${avgNO2}, SO2=${avgSO2}`);
      
      // Tentukan status berdasarkan rata-rata PM10
      let status, dotColor;
      if (avgPM10 < 50) { status = 'BAIK'; dotColor = '#34d399'; }
      else if (avgPM10 < 100) { status = 'SEDANG'; dotColor = '#f59e0b'; }
      else if (avgPM10 < 200) { status = 'TIDAK SEHAT'; dotColor = '#f87171'; }
      else if (avgPM10 < 300) { status = 'SANGAT TIDAK SEHAT'; dotColor = '#ef4444'; }
      else { status = 'BERBAHAYA'; dotColor = '#7c3aed'; }
      
      return {
        id: `DKI${idx + 1}`,
        name: key,
        pm25: avgPM25,
        pm10: avgPM10,
        so2: avgSO2,
        co: avgCO,
        o3: avgO3,
        no2: avgNO2,
        status: status,
        dotColor: dotColor
      };
    });
    
    console.log('✅ STATIONS array built:', STATIONS.length, 'stations');
    
    // Hitung monthly averages untuk chart (gunakan semua data yang ada)
    const monthlyData = {};
    for (let m = 1; m <= 12; m++) {
      monthlyData[m] = { pm10: [], o3: [] };
    }
    
    rawData.forEach(row => {
      const month = parseInt(row.tanggal.split('-')[1]);
      if (row.pm10 > 0) monthlyData[month].pm10.push(row.pm10);
      if (row.o3 > 0) monthlyData[month].o3.push(row.o3);
    });
    
    MONTHLY_PM10 = [];
    MONTHLY_O3 = [];
    for (let m = 1; m <= 12; m++) {
      const pm10Avg = monthlyData[m].pm10.length > 0 
        ? Math.round(monthlyData[m].pm10.reduce((a,b) => a+b, 0) / monthlyData[m].pm10.length)
        : 0;
      const o3Avg = monthlyData[m].o3.length > 0
        ? Math.round(monthlyData[m].o3.reduce((a,b) => a+b, 0) / monthlyData[m].o3.length)
        : 0;
      MONTHLY_PM10.push(pm10Avg);
      MONTHLY_O3.push(o3Avg);
    }
    
    console.log('📈 Monthly PM10:', MONTHLY_PM10);
    console.log('📈 Monthly O3:', MONTHLY_O3);
    
    // Generate forecast berdasarkan data terakhir yang valid
    // Gunakan rata-rata dari semua bulan yang ada data
    const validPM10 = MONTHLY_PM10.filter(v => v > 0);
    const avgPM10 = validPM10.length > 0 
      ? Math.round(validPM10.reduce((a,b) => a+b, 0) / validPM10.length)
      : 50;
    
    console.log('📊 Average PM10 for forecast:', avgPM10);
    
    FORECAST_PM10 = [];
    FORECAST_UPPER = [];
    for (let i = 0; i < 7; i++) {
      const trend = Math.sin(i * 0.3) * 8;
      const noise = Math.cos(i * 0.5) * 5;
      FORECAST_PM10.push(Math.round(avgPM10 + trend + noise));
      FORECAST_UPPER.push(Math.round(avgPM10 + trend + noise + 12));
    }
    
    console.log('🔮 FORECAST_PM10:', FORECAST_PM10);
    console.log('🔮 FORECAST_UPPER:', FORECAST_UPPER);
    
    tableFiltered = [...TABLE_RAW];
    
    console.log('✅ CSV data loaded successfully!');
    console.log('📊 TABLE_RAW:', TABLE_RAW.length, 'rows');
    console.log('📅 Date range:', rawData[0]?.tanggal, 'to', rawData[rawData.length-1]?.tanggal);
    
    return true;
  } catch (error) {
    console.error('❌ Error loading CSV:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// CHART.JS SETUP
// ═══════════════════════════════════════════════════════════
Chart.defaults.color = '#334155';
Chart.defaults.font.family = "'DM Mono', monospace";

let trendChartInst   = null;
let donutChartInst   = null;
let forecastChartInst = null;
let stationBarInst   = null;
let radarInst        = null;

function makeTrendChart() {
  if (trendChartInst) return;
  const ctx = document.getElementById('trendChart').getContext('2d');
  const gpPM10 = ctx.createLinearGradient(0,0,0,108);
  gpPM10.addColorStop(0,'rgba(167,139,250,0.55)');
  gpPM10.addColorStop(1,'rgba(167,139,250,0.02)');
  const gpO3 = ctx.createLinearGradient(0,0,0,108);
  gpO3.addColorStop(0,'rgba(34,211,238,0.45)');
  gpO3.addColorStop(1,'rgba(34,211,238,0.02)');
  trendChartInst = new Chart(ctx, {
    type:'bar',
    data:{
      labels:MONTHS_LABEL,
      datasets:[
        { label:'PM10', data:MONTHLY_PM10, backgroundColor:gpPM10, borderColor:'rgba(167,139,250,0.75)', borderWidth:1, borderRadius:3, borderSkipped:false },
        { label:'O3',   data:MONTHLY_O3,   backgroundColor:gpO3,   borderColor:'rgba(34,211,238,0.65)',  borderWidth:1, borderRadius:3, borderSkipped:false },
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      animation:{ duration:900, easing:'easeOutCubic' },
      plugins:{
        legend:{ display:false },
        tooltip:{
          backgroundColor:'rgba(8,13,22,0.96)',
          borderColor:'rgba(255,255,255,0.07)', borderWidth:1,
          titleColor:'#64748b', bodyColor:'#f1f5f9',
          padding:9, titleFont:{ size:9 }, bodyFont:{ size:11, weight:'600' },
          callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${ctx.raw} µg/m³` }
        }
      },
      scales:{
        x:{ 
          display:true, 
          grid:{ display:false },
          ticks:{ 
            color:'#64748b', 
            font:{ size:10, family:"'DM Mono', monospace" },
            padding: 4
          },
          border:{ display:false }
        },
        y:{ display:false, grid:{ display:false }, min:0, max:240 }
      }
    }
  });
}

function makeDonutChart() {
  if (donutChartInst) return;
  
  // Hitung distribusi kategori dari data real
  const categoryCounts = {
    'BAIK': 0,
    'SEDANG': 0,
    'TIDAK SEHAT': 0,
    'SANGAT TIDAK SEHAT': 0,
    'BERBAHAYA': 0
  };
  
  TABLE_RAW.forEach(row => {
    if (categoryCounts.hasOwnProperty(row.cat)) {
      categoryCounts[row.cat]++;
    }
  });
  
  const total = TABLE_RAW.length || 1;
  const baik = Math.round((categoryCounts['BAIK'] / total) * 100);
  const sedang = Math.round((categoryCounts['SEDANG'] / total) * 100);
  const tidakSehat = Math.round((categoryCounts['TIDAK SEHAT'] / total) * 100);
  const sangatTidakSehat = Math.round((categoryCounts['SANGAT TIDAK SEHAT'] / total) * 100);
  const berbahaya = Math.round((categoryCounts['BERBAHAYA'] / total) * 100);
  
  console.log('📊 Donut Chart Data:', { baik, sedang, tidakSehat, sangatTidakSehat, berbahaya });
  
  // Update legend percentages
  const pctBaik = document.getElementById('pct-baik');
  const pctSedang = document.getElementById('pct-sedang');
  const pctTs = document.getElementById('pct-ts');
  const pctSts = document.getElementById('pct-sts');
  const pctBahaya = document.getElementById('pct-bahaya');
  
  if (pctBaik) pctBaik.textContent = `${baik}%`;
  if (pctSedang) pctSedang.textContent = `${sedang}%`;
  if (pctTs) pctTs.textContent = `${tidakSehat}%`;
  if (pctSts) pctSts.textContent = `${sangatTidakSehat}%`;
  if (pctBahaya) pctBahaya.textContent = `${berbahaya}%`;
  
  const ctx = document.getElementById('donutChart').getContext('2d');
  donutChartInst = new Chart(ctx,{
    type:'doughnut',
    data:{
      labels:['Baik','Sedang','Tidak Sehat','Sangat Tidak Sehat','Berbahaya'],
      datasets:[{
        data:[baik, sedang, tidakSehat, sangatTidakSehat, berbahaya],
        backgroundColor:[
          'rgba(52,211,153,0.82)',
          'rgba(245,158,11,0.82)',
          'rgba(248,113,113,0.82)',
          'rgba(239,68,68,0.82)',
          'rgba(167,139,250,0.82)'
        ],
        borderWidth:0, 
        hoverOffset:6
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:true,
      animation:{ animateRotate:true, duration:1100, easing:'easeOutCubic' },
      cutout:'65%',
      plugins:{
        legend:{ display:false },
        tooltip:{
          enabled: true,
          position: 'average',
          backgroundColor:'rgba(8,13,22,0.96)',
          borderColor:'rgba(255,255,255,0.07)', 
          borderWidth:1,
          titleColor:'#64748b', 
          bodyColor:'#f1f5f9', 
          padding:9,
          displayColors: false,
          callbacks:{ 
            label: ctx => ` ${ctx.label}: ${ctx.raw}%`,
            afterLabel: ctx => ` (${Math.round((ctx.raw / 100) * total)} hari)`
          }
        }
      }
    }
  });
}

function makeForecastChart() {
  if (forecastChartInst) return;
  
  console.log('📊 Creating forecast chart...');
  console.log('  FORECAST_PM10:', FORECAST_PM10);
  console.log('  FORECAST_UPPER:', FORECAST_UPPER);
  
  const ctx = document.getElementById('forecastChart').getContext('2d');
  const gpMain = ctx.createLinearGradient(0,0,0,150);
  gpMain.addColorStop(0,'rgba(167,139,250,0.32)');
  gpMain.addColorStop(1,'rgba(167,139,250,0.0)');
  const gpUpper = ctx.createLinearGradient(0,0,0,150);
  gpUpper.addColorStop(0,'rgba(167,139,250,0.1)');
  gpUpper.addColorStop(1,'rgba(167,139,250,0.0)');
  
  // Calculate dynamic min/max for Y axis
  const allValues = [...FORECAST_PM10, ...FORECAST_UPPER];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const padding = (maxVal - minVal) * 0.2 || 20;
  const yMin = Math.max(0, Math.floor(minVal - padding));
  const yMax = Math.ceil(maxVal + padding);
  
  console.log('  Y-axis range:', yMin, '-', yMax);
  
  forecastChartInst = new Chart(ctx,{
    type:'line',
    data:{
      labels:FORECAST_DAYS,
      datasets:[
        {
          label:'Batas Atas', data:FORECAST_UPPER,
          fill:true, backgroundColor:gpUpper,
          borderColor:'rgba(167,139,250,0.22)', borderWidth:1,
          borderDash:[4,4], pointRadius:0, tension:0.4
        },
        {
          label:'PM10 Prediksi', data:FORECAST_PM10,
          fill:true, backgroundColor:gpMain,
          borderColor:'#a78bfa', borderWidth:2,
          pointRadius:4, pointBackgroundColor:'#a78bfa',
          pointBorderColor:'#060a12', pointBorderWidth:1.5,
          tension:0.4
        }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      animation:{ duration:900, easing:'easeOutCubic' },
      plugins:{
        legend:{ display:false },
        tooltip:{
          backgroundColor:'rgba(8,13,22,0.96)',
          borderColor:'rgba(255,255,255,0.07)', borderWidth:1,
          titleColor:'#64748b', bodyColor:'#f1f5f9', padding:9,
          callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${ctx.raw} µg/m³` }
        }
      },
      scales:{
        x:{ grid:{ color:'rgba(255,255,255,0.03)' }, ticks:{ font:{ size:10 }, color:'#334155' } },
        y:{ grid:{ color:'rgba(255,255,255,0.03)' }, ticks:{ font:{ size:10 }, color:'#334155' }, min:yMin, max:yMax }
      }
    }
  });
  
  console.log('✅ Forecast chart created');
}

function makeStationBarChart() {
  if (stationBarInst) return;
  const ctx = document.getElementById('stationBarChart').getContext('2d');
  const w = ctx.canvas.offsetWidth || 700;
  const makeGrad = (c1, c2) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, c1); g.addColorStop(1, c2); return g;
  };
  stationBarInst = new Chart(ctx,{
    type:'bar',
    data:{
      labels: STATIONS.map(s => s.id),
      datasets:[{
        label:'PM10',
        data: STATIONS.map(s => s.pm10),
        backgroundColor:[
          makeGrad('rgba(34,211,238,0.95)',  'rgba(34,211,238,0.2)'),
          makeGrad('rgba(167,139,250,0.95)', 'rgba(167,139,250,0.2)'),
          makeGrad('rgba(52,211,153,0.95)',  'rgba(52,211,153,0.2)'),
          makeGrad('rgba(248,113,113,0.95)', 'rgba(248,113,113,0.2)'),
          makeGrad('rgba(251,191,36,0.95)',  'rgba(251,191,36,0.2)'),
        ],
        borderWidth:0, borderRadius:5,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      animation:{ duration:900, easing:'easeOutCubic' },
      plugins:{
        legend:{ display:false },
        tooltip:{
          backgroundColor:'rgba(8,13,22,0.96)',
          borderColor:'rgba(255,255,255,0.07)', borderWidth:1,
          titleColor:'#64748b', bodyColor:'#f1f5f9', padding:9,
          callbacks:{ label: ctx => ` PM10: ${ctx.raw} µg/m³` }
        }
      },
      scales:{
        x:{ grid:{ color:'rgba(255,255,255,0.03)' }, ticks:{ color:'#334155', font:{ size:10, family:"'DM Mono', monospace" } }, min:0, max:220 },
        y:{ grid:{ display:false }, ticks:{ color:'#64748b', font:{ size:10, family:"'DM Mono', monospace" } } }
      }
    }
  });
}

function makeRadarChart() {
  if (radarInst) return;
  const ctx = document.getElementById('radarChart').getContext('2d');
  const palette = [
    { bg:'rgba(34,211,238,0.28)',  border:'rgba(34,211,238,1)',   point:'#22d3ee' },
    { bg:'rgba(167,139,250,0.28)', border:'rgba(167,139,250,1)',  point:'#a78bfa' },
    { bg:'rgba(52,211,153,0.22)',  border:'rgba(52,211,153,1)',   point:'#34d399' },
  ];
  radarInst = new Chart(ctx,{
    type:'radar',
    data:{
      labels:['PM10','SO2','CO×3','O3','NO2'],
      datasets: STATIONS.slice(0,3).map((s,i) => ({
        label: s.id,
        data: [s.pm10/2.2, s.so2, s.co*3, s.o3/1.3, s.no2],
        backgroundColor: palette[i].bg,
        borderColor: palette[i].border,
        borderWidth: 2,
        pointBackgroundColor: palette[i].point,
        pointBorderColor: '#060a12',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
      }))
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      animation:{ duration:900 },
      plugins:{
        legend:{ display:false },
        tooltip:{
          backgroundColor:'rgba(8,13,22,0.96)',
          borderColor:'rgba(255,255,255,0.07)', borderWidth:1,
          titleColor:'#94a3b8', bodyColor:'#f1f5f9', padding:9,
          callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)}` }
        }
      },
      scales:{
        r:{
          grid:{ color:'rgba(255,255,255,0.08)' },
          angleLines:{ color:'rgba(255,255,255,0.07)' },
          ticks:{ display:false, backdropColor:'transparent' },
          pointLabels:{
            color:'#94a3b8',
            font:{ size:10, family:"'DM Mono', monospace", weight:'600' }
          }
        }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// STATION SWITCHER
// ═══════════════════════════════════════════════════════════
function toggleStationMenu() {
  const menu = document.getElementById('ssMenu');
  const chev = document.getElementById('ssChevron');
  const isOpen = menu.classList.toggle('open');
  chev.style.transform = isOpen ? 'rotate(180deg)' : '';
  chev.style.transition = 'transform 0.2s';
}

function switchStation(idx) {
  if (!STATIONS[idx]) {
    console.error('❌ Station not found at index:', idx);
    return;
  }
  
  const st = STATIONS[idx];
  console.log('🎯 Switching to station:', st.name);
  
  // Update elements safely
  const stName = document.getElementById('stName');
  const stDot = document.getElementById('stDot');
  const stStatus = document.getElementById('stStatus');
  const heroAqi = document.getElementById('heroAqi');
  const hPm10 = document.getElementById('h-pm10');
  const hO3 = document.getElementById('h-o3');
  const hCo = document.getElementById('h-co');
  const hNo2 = document.getElementById('h-no2');
  const hSo2 = document.getElementById('h-so2');
  const ssLabel = document.getElementById('ssLabel');
  
  if (stName) stName.textContent = st.name;
  if (stDot) stDot.style.background = st.dotColor;
  if (stStatus) stStatus.textContent = `${st.status} · PM10 ${st.pm10}`;
  if (heroAqi) {
    heroAqi.textContent = st.status;
    heroAqi.style.color = st.dotColor;
  }
  if (hPm10) hPm10.textContent = st.pm10;
  if (hO3) hO3.textContent = st.o3;
  if (hCo) hCo.textContent = st.co;
  if (hNo2) hNo2.textContent = st.no2;
  if (hSo2) hSo2.textContent = st.so2;
  if (ssLabel) ssLabel.textContent = st.name;
  
  document.querySelectorAll('.ss-item').forEach((el,i) =>
    el.classList.toggle('active', i === idx)
  );
  
  const ssMenu = document.getElementById('ssMenu');
  if (ssMenu) ssMenu.classList.remove('open');
  
  const ssChevron = document.getElementById('ssChevron');
  if (ssChevron) ssChevron.style.transform = '';
  
  if (trendChartInst) {
    // Hitung data bulanan untuk stasiun ini dari TABLE_RAW
    const stationData = TABLE_RAW.filter(row => row.station === st.name);
    const monthlyPM10 = new Array(12).fill(0);
    const monthlyO3 = new Array(12).fill(0);
    const monthlyCount = new Array(12).fill(0);
    
    stationData.forEach(row => {
      const month = parseInt(row.date.split('-')[1]) - 1;
      if (month >= 0 && month < 12) {
        monthlyPM10[month] += row.pm10;
        monthlyO3[month] += row.o3;
        monthlyCount[month]++;
      }
    });
    
    // Hitung rata-rata
    for (let i = 0; i < 12; i++) {
      if (monthlyCount[i] > 0) {
        monthlyPM10[i] = Math.round(monthlyPM10[i] / monthlyCount[i]);
        monthlyO3[i] = Math.round(monthlyO3[i] / monthlyCount[i]);
      }
    }
    
    trendChartInst.data.datasets[0].data = monthlyPM10;
    trendChartInst.data.datasets[1].data = monthlyO3;
    trendChartInst.update('active');
  }
  
  console.log('✅ Station switched successfully');
}

// ═══════════════════════════════════════════════════════════
// FORECAST RESET
// ═══════════════════════════════════════════════════════════
function resetForecast() {
  console.log('🔄 Resetting forecast chart...');
  const loader = document.getElementById('forecastLoader');
  if (loader) loader.style.display = 'flex';
  
  if (forecastChartInst) {
    forecastChartInst.destroy();
    forecastChartInst = null;
    window._forecastInit = false;
  }
  
  setTimeout(() => {
    if (loader) loader.style.display = 'none';
    makeForecastChart();
    console.log('✅ Forecast chart reset complete');
  }, 1200);
}

// ═══════════════════════════════════════════════════════════
// MOBILE NAV
// ═══════════════════════════════════════════════════════════
function toggleMobileNav() {
  const drawer = document.getElementById('mobileDrawer');
  const btn    = document.getElementById('hamburgerBtn');
  const isOpen = drawer.classList.toggle('open');
  btn.innerHTML = isOpen ? '<i class="ti ti-x"></i>' : '<i class="ti ti-menu-2"></i>';
  btn.setAttribute('aria-expanded', isOpen);
}

// ═══════════════════════════════════════════════════════════
// COUNT-UP
// ═══════════════════════════════════════════════════════════
function countUp(el) {
  if (el._counted) return;
  el._counted = true;
  const target = +el.dataset.target;
  const start  = Date.now();
  const dur    = 750;
  function tick() {
    const p    = Math.min((Date.now()-start)/dur,1);
    const ease = 1 - Math.pow(1-p,3);
    el.textContent = Math.round(ease*target);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ═══════════════════════════════════════════════════════════
// INTERSECTION OBSERVER
// ═══════════════════════════════════════════════════════════
function initObserver() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      e.target.querySelectorAll('.count-up').forEach(countUp);
      obs.unobserve(e.target);
    });
  }, { threshold:0.08 });
  document.querySelectorAll('.sc, .cc, .insight-card').forEach(el => obs.observe(el));
}

// ═══════════════════════════════════════════════════════════
// TABLE
// ═══════════════════════════════════════════════════════════
function badge(cat) {
  const map = {
    'BAIK':'badge-baik','SEDANG':'badge-sedang',
    'TIDAK SEHAT':'badge-ts','SANGAT TIDAK SEHAT':'badge-sts','BERBAHAYA':'badge-bahaya'
  };
  const labels = {
    'BAIK':'Baik','SEDANG':'Sedang','TIDAK SEHAT':'Tdk Sehat',
    'SANGAT TIDAK SEHAT':'Sgt Tdk Sehat','BERBAHAYA':'Berbahaya'
  };
  return `<span class="badge ${map[cat]||'badge-sedang'}">${labels[cat]||cat}</span>`;
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  const info  = document.getElementById('tableInfo');
  const pag   = document.getElementById('pagination');
  const total = tableFiltered.length;
  const pages = Math.max(1, Math.ceil(total/PER_PAGE));
  currentPage = Math.max(1, Math.min(currentPage, pages));
  const s     = (currentPage-1)*PER_PAGE;
  const slice = tableFiltered.slice(s, s+PER_PAGE);

  tbody.innerHTML = slice.map(r => `
    <tr>
      <td>${r.date}</td>
      <td style="color:#94a3b8;font-weight:500">${r.station}</td>
      <td style="color:var(--purple)">${r.pm10}</td>
      <td>${r.so2}</td>
      <td>${r.co}</td>
      <td style="color:var(--cyan)">${r.o3}</td>
      <td>${r.no2}</td>
      <td style="font-weight:600;color:var(--text-hi)">${r.max}</td>
      <td>${badge(r.cat)}</td>
    </tr>`).join('');

  info.textContent = `${s+1}–${Math.min(s+PER_PAGE,total)} dari ${total} data`;

  const startP = Math.max(1, currentPage-2);
  const endP   = Math.min(pages, startP+4);
  const btns   = [];
  btns.push(`<div class="page-btn ${currentPage===1?'off':''}" data-p="${currentPage-1}">‹</div>`);
  for (let i = startP; i <= endP; i++)
    btns.push(`<div class="page-btn ${i===currentPage?'cur':''}" data-p="${i}">${i}</div>`);
  btns.push(`<div class="page-btn ${currentPage===pages?'off':''}" data-p="${currentPage+1}">›</div>`);
  pag.innerHTML = btns.join('');
  pag.querySelectorAll('[data-p]').forEach(b =>
    b.addEventListener('click', () => { currentPage = +b.dataset.p; renderTable(); })
  );
}

function filterTable() {
  const q   = document.getElementById('searchInput').value.toLowerCase();
  const cat = document.getElementById('filterCat').value;
  tableFiltered = TABLE_RAW.filter(r =>
    (!q   || r.station.toLowerCase().includes(q) || r.date.includes(q)) &&
    (!cat || r.cat === cat)
  );
  currentPage = 1;
  renderTable();
}

// ═══════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById(`sec-${id}`);
  if (sec) sec.classList.add('active');
  document.querySelectorAll('[data-sec]').forEach(n =>
    n.classList.toggle('active', n.dataset.sec === id)
  );
  const drawer = document.getElementById('mobileDrawer');
  if (drawer && drawer.classList.contains('open')) {
    drawer.classList.remove('open');
    const btn = document.getElementById('hamburgerBtn');
    if (btn) { btn.innerHTML = '<i class="ti ti-menu-2"></i>'; btn.setAttribute('aria-expanded','false'); }
  }
  const ssMenu = document.getElementById('ssMenu');
  if (ssMenu) ssMenu.classList.remove('open');

  if (id === 'dashboard') {
    if (!window._dashInit) {
      window._dashInit = true;
      requestAnimationFrame(() => { makeTrendChart(); makeDonutChart(); initObserver(); renderHeatmap(); });
    }
    // Always refresh station data when showing dashboard
    if (STATIONS.length > 0) {
      switchStation(0);
    }
  }
  if (id === 'prakiraan' && !window._forecastInit) {
    window._forecastInit = true;
    requestAnimationFrame(makeForecastChart);
  }
  if (id === 'dataset' && !window._tableInit) {
    window._tableInit = true;
    renderTable();
  }
  if (id === 'analitik' && !window._analitikInit) {
    window._analitikInit = true;
    requestAnimationFrame(() => { makeStationBarChart(); makeRadarChart(); renderWorstDays(); });
  }
  if (id === 'beranda' && !window._berandaInit) {
    window._berandaInit = true;
    requestAnimationFrame(() => {
      document.querySelectorAll('#sec-beranda .count-up').forEach(countUp);
      initBerandaCanvas();
    });
  }
}

// ═══════════════════════════════════════════════════════════
// HEATMAP CALENDAR
// ═══════════════════════════════════════════════════════════
function generateDailyData(stIdx) {
  if (!STATIONS[stIdx]) return [];
  const st = STATIONS[stIdx];
  
  // Ambil data real dari TABLE_RAW untuk stasiun ini
  const stationData = TABLE_RAW.filter(row => row.station === st.name);
  
  // Buat map berdasarkan tanggal
  const dataMap = {};
  stationData.forEach(row => {
    dataMap[row.date] = row;
  });
  
  const days = [];
  const start = new Date(2026, 0, 1);
  
  for (let d = 0; d < 366; d++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + d);
    const dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    
    let pm10, cat, color;
    
    // Gunakan data real jika ada
    if (dataMap[dateStr]) {
      pm10 = dataMap[dateStr].pm10;
      cat = dataMap[dateStr].cat;
    } else {
      // Fallback ke estimasi jika data tidak ada
      const mi = dt.getMonth();
      const wave = Math.sin(d * 0.04 + stIdx * 0.5) * 35;
      const seasonal = Math.sin((mi - 2) * 0.52) * 30;
      pm10 = Math.max(10, Math.round(st.pm10 + wave + seasonal));
      
      if (pm10 < 50) cat = 'BAIK';
      else if (pm10 < 100) cat = 'SEDANG';
      else if (pm10 < 200) cat = 'TIDAK SEHAT';
      else if (pm10 < 300) cat = 'SANGAT TIDAK SEHAT';
      else cat = 'BERBAHAYA';
    }
    
    // Tentukan warna berdasarkan PM10
    if (pm10 < 50) { color = '#166534'; }
    else if (pm10 < 80) { color = '#22c55e'; }
    else if (pm10 < 120) { color = '#fbbf24'; }
    else if (pm10 < 160) { color = '#f97316'; }
    else if (pm10 < 200) { color = '#ef4444'; }
    else { color = '#7c3aed'; }
    
    days.push({ date: dt, pm10, cat, color });
  }
  return days;
}

function renderHeatmap() {
  const container = document.getElementById('heatmapContainer');
  if (!container) return;
  const data = generateDailyData(0);
  const tooltip = document.getElementById('heatmapTooltip');
  const dayNames = ['','Sen','','Rab','','Jum',''];
  const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  // Build weeks
  const weeks = []; let week = [];
  const first = data[0].date; const firstDay = (first.getDay() + 6) % 7;
  for (let i = 0; i < firstDay; i++) week.push(null);
  data.forEach(d => {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  });
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  // Month labels
  let monthsHtml = '<div class="heatmap-months">';
  let lastMonth = -1;
  weeks.forEach((w, wi) => {
    const firstCell = w.find(c => c);
    if (firstCell) {
      const m = firstCell.date.getMonth();
      if (m !== lastMonth) { monthsHtml += `<span class="heatmap-month" style="width:${13*1}px;position:relative;left:${wi*13}px">${monthNames[m]}</span>`; lastMonth = m; }
    }
  });
  monthsHtml += '</div>';
  // Day labels
  let daysHtml = '<div class="heatmap-days">';
  dayNames.forEach(d => { daysHtml += `<div class="heatmap-day-label">${d}</div>`; });
  daysHtml += '</div>';
  // Grid
  let gridHtml = '<div class="heatmap-grid">';
  weeks.forEach(w => {
    gridHtml += '<div class="heatmap-col">';
    w.forEach(cell => {
      if (!cell) { gridHtml += '<div class="heatmap-cell" style="background:rgba(255,255,255,0.02)"></div>'; }
      else {
        const ds = `${cell.date.getFullYear()}-${String(cell.date.getMonth()+1).padStart(2,'0')}-${String(cell.date.getDate()).padStart(2,'0')}`;
        gridHtml += `<div class="heatmap-cell" style="background:${cell.color}" data-hm-date="${ds}" data-hm-val="${cell.pm10}" data-hm-cat="${cell.cat}"></div>`;
      }
    });
    gridHtml += '</div>';
  });
  gridHtml += '</div>';
  container.innerHTML = monthsHtml + '<div class="heatmap-body">' + daysHtml + gridHtml + '</div>';
  // Tooltip
  container.addEventListener('mouseover', e => {
    const cell = e.target.closest('.heatmap-cell[data-hm-date]');
    if (!cell) { tooltip.classList.remove('show'); return; }
    document.getElementById('hmTipDate').textContent = cell.dataset.hmDate;
    document.getElementById('hmTipVal').textContent = `PM10: ${cell.dataset.hmVal} µg/m³`;
    document.getElementById('hmTipCat').innerHTML = `<span class="badge ${{'BAIK':'badge-baik','SEDANG':'badge-sedang','TIDAK SEHAT':'badge-ts','SANGAT TIDAK SEHAT':'badge-sts','BERBAHAYA':'badge-bahaya'}[cell.dataset.hmCat]}">${cell.dataset.hmCat}</span>`;
    tooltip.classList.add('show');
    const r = cell.getBoundingClientRect();
    tooltip.style.left = (r.left + r.width/2 - 60) + 'px';
    tooltip.style.top = (r.top - 52) + 'px';
  });
  container.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
}

// ═══════════════════════════════════════════════════════════
// COMPARE MODE
// ═══════════════════════════════════════════════════════════
let compareChartA = null, compareChartB = null;
function toggleCompare() {
  const panel = document.getElementById('comparePanel');
  const toggle = document.getElementById('compareToggle');
  const single = document.getElementById('dashSingleMode');
  const isActive = toggle.classList.toggle('active');
  panel.classList.toggle('active', isActive);
  single.style.display = isActive ? 'none' : '';
  if (isActive) renderCompare();
}
function renderCompare() {
  const idxA = +document.getElementById('compareA').value;
  const idxB = +document.getElementById('compareB').value;
  if (!STATIONS[idxA] || !STATIONS[idxB]) return;
  const stA = STATIONS[idxA], stB = STATIONS[idxB];
  const colors = ['#22d3ee','#a78bfa','#34d399','#f87171','#fbbf24'];
  const grid = document.getElementById('compareGrid');
  const params = ['pm10','so2','co','o3','no2'];
  const paramColors = { pm10:'var(--purple)', so2:'var(--yellow)', co:'var(--green)', o3:'var(--cyan)', no2:'var(--red)' };
  function makeCol(st, idx, side) {
    let html = `<div class="compare-col"><div class="compare-col-title"><span class="cct-dot" style="background:${colors[idx]}"></span><span style="color:${colors[idx]}">${st.name}</span><span style="font-size:8px;color:var(--muted);margin-left:auto">${st.status}</span></div>`;
    params.forEach(p => {
      html += `<div class="compare-stat-row"><span class="compare-stat-name">${p.toUpperCase()}</span><span class="compare-stat-val" style="color:${paramColors[p]}">${st[p]} µg/m³</span></div>`;
    });
    html += `<div class="compare-chart-wrap"><canvas id="compareChart${side}"></canvas></div></div>`;
    return html;
  }
  grid.innerHTML = makeCol(stA, idxA, 'A') + makeCol(stB, idxB, 'B');
  if (compareChartA) compareChartA.destroy();
  if (compareChartB) compareChartB.destroy();
  
  function makeCompareChart(canvasId, st, idx, color) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Hitung data bulanan untuk stasiun ini dari TABLE_RAW
    const stationData = TABLE_RAW.filter(row => row.station === st.name);
    const monthlyPM10 = new Array(12).fill(0);
    const monthlyCount = new Array(12).fill(0);
    
    stationData.forEach(row => {
      const month = parseInt(row.date.split('-')[1]) - 1;
      if (month >= 0 && month < 12) {
        monthlyPM10[month] += row.pm10;
        monthlyCount[month]++;
      }
    });
    
    // Hitung rata-rata
    const d = [];
    for (let i = 0; i < 12; i++) {
      d.push(monthlyCount[i] > 0 ? Math.round(monthlyPM10[i] / monthlyCount[i]) : 0);
    }
    
    return new Chart(ctx, { type:'line', data:{ labels:MONTHS_LABEL, datasets:[{ data:d, borderColor:color, backgroundColor:color+'22', fill:true, borderWidth:2, pointRadius:3, pointBackgroundColor:color, tension:0.4 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(8,13,22,0.96)',borderColor:'rgba(255,255,255,0.07)',borderWidth:1,titleColor:'#64748b',bodyColor:'#f1f5f9',padding:9}}, scales:{x:{display:false},y:{display:false}} } });
  }
  compareChartA = makeCompareChart('compareChartA', stA, idxA, colors[idxA]);
  compareChartB = makeCompareChart('compareChartB', stB, idxB, colors[idxB]);
}

// ═══════════════════════════════════════════════════════════
// CMD+K COMMAND PALETTE
// ═══════════════════════════════════════════════════════════
const CMDK_ITEMS = [
  { type:'section', icon:'ti ti-home', text:'Home', hint:'Halaman utama', action:'beranda' },
  { type:'section', icon:'ti ti-layout-dashboard', text:'Dashboard AQI', hint:'Monitoring', action:'dashboard' },
  { type:'section', icon:'ti ti-chart-bar', text:'Analitik Tren', hint:'Grafik & analisis', action:'analitik' },
  { type:'section', icon:'ti ti-cpu', text:'Prediksi SMA', hint:'Forecast', action:'prakiraan' },
  { type:'section', icon:'ti ti-table', text:'Dataset', hint:'Tabel data', action:'dataset' },
  { type:'section', icon:'ti ti-info-circle', text:'Panduan AQI', hint:'Kategori ISPU', action:'info' },
  { type:'section', icon:'ti ti-users', text:'Tentang', hint:'Info app', action:'tentang' },
  { type:'station', icon:'ti ti-map-pin', text:'DKI1 — Bunderan HI', hint:'Stasiun', action:0 },
  { type:'station', icon:'ti ti-map-pin', text:'DKI2 — Kelapa Gading', hint:'Stasiun', action:1 },
  { type:'station', icon:'ti ti-map-pin', text:'DKI3 — Jagakarsa', hint:'Stasiun', action:2 },
  { type:'station', icon:'ti ti-map-pin', text:'DKI4 — Lubang Buaya', hint:'Stasiun', action:3 },
  { type:'station', icon:'ti ti-map-pin', text:'DKI5 — Kebon Jeruk', hint:'Stasiun', action:4 },
];
let cmdkSelected = 0;

function openCmdK() {
  const overlay = document.getElementById('cmdkOverlay');
  overlay.classList.add('open');
  const input = document.getElementById('cmdkInput');
  input.value = '';
  input.focus();
  cmdkSelected = 0;
  renderCmdKList('');
}
function closeCmdK() { document.getElementById('cmdkOverlay').classList.remove('open'); }

function renderCmdKList(query) {
  const list = document.getElementById('cmdkList');
  const q = query.toLowerCase().trim();
  const filtered = q ? CMDK_ITEMS.filter(i => i.text.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q)) : CMDK_ITEMS;
  if (!filtered.length) { list.innerHTML = '<div class="cmdk-empty">Tidak ditemukan</div>'; return; }
  let html = '';
  let lastType = '';
  filtered.forEach((item, i) => {
    if (item.type !== lastType) {
      lastType = item.type;
      html += `<div class="cmdk-group-label">${item.type === 'section' ? 'Halaman' : 'Stasiun'}</div>`;
    }
    html += `<div class="cmdk-item${i===cmdkSelected?' selected':''}" data-cmdk="${i}" onclick="executeCmdK(${i})"><i class="${item.icon}"></i><span class="cmdk-item-text">${item.text}</span><span class="cmdk-item-hint">${item.hint}</span></div>`;
  });
  list.innerHTML = html;
  list._filtered = filtered;
}

function executeCmdK(idx) {
  const list = document.getElementById('cmdkList');
  const items = list._filtered || CMDK_ITEMS;
  const item = items[idx];
  if (!item) return;
  closeCmdK();
  if (item.type === 'section') showSection(item.action);
  else { showSection('dashboard'); setTimeout(() => switchStation(item.action), 100); }
}

// ═══════════════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════════════
function exportCSV() {
  const headers = ['Tanggal','Stasiun','PM10','SO2','CO','O3','NO2','Max','Kategori'];
  const rows = tableFiltered.map(r => [r.date, r.station, r.pm10, r.so2, r.co, r.o3, r.no2, r.max, r.cat].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'aerocast_data_2026.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════
// EXPANDABLE SIDEBAR
// ═══════════════════════════════════════════════════════════
function initSidebarAccordion() {
  const acc = document.getElementById('stationAccordion');
  if (!acc || STATIONS.length === 0) return;
  
  let html = `<div class="station-acc-toggle" id="accToggle" onclick="toggleSidebarAcc()">
    <div class="station-acc-left"><span class="station-acc-name" id="stName">${STATIONS[0].name}</span></div>
    <span class="station-acc-chevron">▾</span>
  </div><div class="station-acc-list" id="accList">`;
  STATIONS.forEach((st, i) => {
    html += `<div class="station-acc-item${i===0?' active':''}" data-acc-st="${i}" onclick="accSelectStation(${i})">
      <div class="station-acc-dot" style="background:${st.dotColor}"></div>
      <div class="station-acc-info"><div class="station-acc-id">${st.id}</div><div class="station-acc-sub">${st.status} · PM10 ${st.pm10}</div></div>
      <div class="station-acc-sparkline"><canvas id="spark${i}" width="60" height="20"></canvas></div>
    </div>`;
  });
  html += '</div>';
  acc.innerHTML = html;
  
  // Draw sparklines - use real data from TABLE_RAW
  STATIONS.forEach((st, i) => {
    const canvas = document.getElementById(`spark${i}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Get monthly data for this station
    const stationData = TABLE_RAW.filter(row => row.station === st.name);
    const monthlyPM10 = new Array(12).fill(0);
    const monthlyCount = new Array(12).fill(0);
    
    stationData.forEach(row => {
      const month = parseInt(row.date.split('-')[1]) - 1;
      if (month >= 0 && month < 12) {
        monthlyPM10[month] += row.pm10;
        monthlyCount[month]++;
      }
    });
    
    const pts = [];
    for (let m = 0; m < 12; m++) {
      pts.push(monthlyCount[m] > 0 ? Math.round(monthlyPM10[m] / monthlyCount[m]) : st.pm10);
    }
    
    const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1;
    ctx.beginPath();
    pts.forEach((v, j) => {
      const x = (j / (pts.length - 1)) * 56 + 2;
      const y = 18 - ((v - min) / range) * 14;
      j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = st.dotColor; ctx.lineWidth = 1.2; ctx.stroke();
    // Fill under
    ctx.lineTo(58, 18); ctx.lineTo(2, 18); ctx.closePath();
    ctx.fillStyle = st.dotColor + '18'; ctx.fill();
  });
}

function toggleSidebarAcc() {
  const toggle = document.getElementById('accToggle');
  const list = document.getElementById('accList');
  toggle.classList.toggle('open');
  list.classList.toggle('open');
}

function accSelectStation(idx) {
  if (!STATIONS[idx]) return;
  document.querySelectorAll('.station-acc-item').forEach((el, i) => el.classList.toggle('active', i === idx));
  document.getElementById('stName').textContent = STATIONS[idx].name;
  showSection('dashboard');
  setTimeout(() => switchStation(idx), 50);
}

// ═══════════════════════════════════════════════════════════
// TIME RANGE FILTER (Analitik)
// ═══════════════════════════════════════════════════════════
let currentTimeFilter = 'all';

function getFilteredMonthIndices(filter) {
  if (filter === 'all') return [0,1,2,3,4,5,6,7,8,9,10,11];
  if (filter === 'q1') return [0,1,2];
  if (filter === 'q2') return [3,4,5];
  if (filter === 'q3') return [6,7,8];
  if (filter === 'q4') return [9,10,11];
  if (filter === 'month') {
    const v = document.getElementById('tfMonthSelect').value;
    return v !== '' ? [parseInt(v)] : [0,1,2,3,4,5,6,7,8,9,10,11];
  }
  return [0,1,2,3,4,5,6,7,8,9,10,11];
}

function setTimeFilter(filter) {
  currentTimeFilter = filter;
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.toggle('active', b.dataset.tf === filter));
  if (filter !== 'month') document.getElementById('tfMonthSelect').value = '';
  const months = getFilteredMonthIndices(filter);
  // Update station bar chart
  if (stationBarInst) {
    const newData = STATIONS.map(s => {
      const wave = STATIONS.indexOf(s) * 0.5;
      const vals = months.map(mi => Math.round(s.pm10 + Math.sin(mi*0.7+wave)*28));
      return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
    });
    stationBarInst.data.datasets[0].data = newData;
    stationBarInst.update('active');
  }
  // Update radar chart
  if (radarInst) {
    STATIONS.slice(0,3).forEach((s, i) => {
      const wave = i * 0.5;
      const pm10Avg = months.map(mi => Math.round(s.pm10 + Math.sin(mi*0.7+wave)*28)).reduce((a,b)=>a+b,0)/months.length;
      radarInst.data.datasets[i].data = [pm10Avg/2.2, s.so2, s.co*3, s.o3/1.3, s.no2];
    });
    radarInst.update('active');
  }
  renderWorstDays(months);
}

// ═══════════════════════════════════════════════════════════
// WORST DAYS TABLE
// ═══════════════════════════════════════════════════════════
function renderWorstDays(monthFilter) {
  const body = document.getElementById('worstDaysBody');
  if (!body) return;
  let data = [...TABLE_RAW];
  if (monthFilter && monthFilter.length < 12) {
    data = data.filter(r => {
      const m = parseInt(r.date.split('-')[1]) - 1;
      return monthFilter.includes(m);
    });
  }
  data.sort((a, b) => b.max - a.max);
  const top10 = data.slice(0, 10);
  body.innerHTML = top10.map((r, i) => `<tr>
    <td class="worst-days-rank">${i + 1}</td>
    <td style="font-family:var(--mono);color:var(--muted)">${r.date}</td>
    <td style="color:var(--text)">${r.station}</td>
    <td style="color:var(--purple);font-weight:600;font-family:var(--mono)">${r.pm10}</td>
    <td style="color:var(--text-hi);font-weight:600;font-family:var(--mono)">${r.max}</td>
    <td>${badge(r.cat)}</td>
  </tr>`).join('');
}

// ═══════════════════════════════════════════════════════════
// BERANDA PARTICLE CANVAS
// ═══════════════════════════════════════════════════════════
function initBerandaCanvas() {
  const canvas = document.getElementById('berandaCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles, raf;
  function resize() {
    const sec = document.getElementById('sec-beranda');
    W = canvas.width  = sec.offsetWidth;
    H = canvas.height = sec.offsetHeight;
  }
  function mkParticle() {
    return { x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + 0.3, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18, a: Math.random() * 0.4 + 0.1 };
  }
  function init() { resize(); particles = Array.from({length: 55}, mkParticle); }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 110) { ctx.beginPath(); ctx.strokeStyle = `rgba(34,211,238,${0.045 * (1 - dist/110)})`; ctx.lineWidth = 0.5; ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke(); }
      }
    }
    particles.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(34,211,238,${p.a})`; ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });
    raf = requestAnimationFrame(draw);
  }
  init(); draw();
  window.addEventListener('resize', resize);
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Starting app initialization...');
  
  // Load CSV data first
  const loaded = await loadCSVData();
  
  if (!loaded) {
    console.error('❌ Failed to load CSV data!');
    alert('Error loading data. Please check console for details.');
    return;
  }
  
  if (STATIONS.length === 0) {
    console.error('❌ No stations loaded!');
    alert('No station data found. Please check the CSV file.');
    return;
  }
  
  console.log('🚀 Initializing app with', STATIONS.length, 'stations');
  console.log('📊 Stations:', STATIONS.map(s => s.name));
  
  // Nav
  document.querySelectorAll('[data-sec]').forEach(el =>
    el.addEventListener('click', () => showSection(el.dataset.sec))
  );
  
  // Station switcher items - update dynamically
  const ssMenu = document.getElementById('ssMenu');
  if (ssMenu) {
    ssMenu.innerHTML = '';
    STATIONS.forEach((st, idx) => {
      const item = document.createElement('div');
      item.className = 'ss-item' + (idx === 0 ? ' active' : '');
      item.dataset.st = idx;
      item.textContent = st.name;
      item.addEventListener('click', () => switchStation(idx));
      ssMenu.appendChild(item);
    });
  }
  
  // Table events
  const searchInput = document.getElementById('searchInput');
  const filterCat = document.getElementById('filterCat');
  if (searchInput) searchInput.addEventListener('input', filterTable);
  if (filterCat) filterCat.addEventListener('change', filterTable);
  
  // Sidebar accordion
  initSidebarAccordion();
  
  // Cmd+K keyboard
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openCmdK(); }
    const overlay = document.getElementById('cmdkOverlay');
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') { closeCmdK(); return; }
    const list = document.getElementById('cmdkList');
    const items = list._filtered || CMDK_ITEMS;
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdkSelected = Math.min(cmdkSelected + 1, items.length - 1); renderCmdKList(document.getElementById('cmdkInput').value); }
    if (e.key === 'ArrowUp') { e.preventDefault(); cmdkSelected = Math.max(cmdkSelected - 1, 0); renderCmdKList(document.getElementById('cmdkInput').value); }
    if (e.key === 'Enter') { e.preventDefault(); executeCmdK(cmdkSelected); }
  });
  
  const cmdkInput = document.getElementById('cmdkInput');
  if (cmdkInput) {
    cmdkInput.addEventListener('input', e => {
      cmdkSelected = 0;
      renderCmdKList(e.target.value);
    });
  }
  
  // Boot
  showSection('beranda');
  
  // Initialize first station after a short delay to ensure DOM is ready
  setTimeout(() => {
    if (STATIONS.length > 0) {
      console.log('🎯 Initializing first station:', STATIONS[0].name);
      switchStation(0);
    }
  }, 100);
  
  console.log('✅ App initialized successfully!');
});