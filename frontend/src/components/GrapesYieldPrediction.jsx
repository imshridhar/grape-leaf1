import React, { useState, useMemo } from 'react';
import { useLanguage } from '../LanguageContext';

const VARIETIES = [
  'Thompson Seedless',
  'Cabernet Sauvignon',
  'Shiraz / Syrah',
  'Flame Seedless',
  'Sharad Seedless',
  'Concord',
  'Red Globe',
  'Bangalore Blue',
  'Pinot Noir',
  'Chardonnay',
  'Crimson Seedless',
];

const TRELLIS_SYSTEMS = [
  'Bower / Pandal / Overhead',
  'Y-Trellis',
  'T-Trellis',
  'VSP (Vertical Shoot Positioning)',
  'Single Curtain',
];

const ROOTSTOCKS = [
  'Dogridge',
  'Salt Creek / Ramsey',
  '110R',
  '1103P',
  'Freedom',
  'SO4',
  'Own-rooted',
];

const GROWTH_STAGES = [
  'Pruning & Bud Break',
  'Flowering & Fruit Set',
  'Berry Development / Pea Stage',
  'Veraison (Color Change)',
  'Berry Ripening',
  'Pre-Harvest',
];

const SOIL_TYPES = [
  'Black Cotton Soil',
  'Sandy Loam',
  'Clay Loam',
  'Red Soil',
  'Alluvial',
  'Rocky / Gravelly',
];

const DRAINAGE_CONDITIONS = ['Excellent', 'Moderate', 'Poor', 'Waterlogged'];

const IRRIGATION_METHODS = [
  'Drip Irrigation (Surface)',
  'Drip Irrigation (Sub-surface)',
  'Micro-sprinkler',
  'Flood / Furrow',
];

const FERTILIZER_SCHEDULES = [
  'Standard Grape Schedule',
  'High Potash Fertigation',
  'Organic Liquid Manure',
  'Custom Vineyard Schedule',
];

const RISK_LEVELS = ['None / Low', 'Mild', 'Moderate', 'Severe / High'];

export default function GrapesYieldPrediction({ notify, apiPost, apiGet }) {
  const { t, tOption } = useLanguage();
  const [activeTab, setActiveTab] = useState('inputs');

  const [activeSection, setActiveSection] = useState('all'); // 'all' or section index
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [listeningField, setListeningField] = useState(null);

  // Form State initialized with realistic grape vineyard defaults
  const [form, setForm] = useState({
    // 1. Vineyard Details
    location: 'Nashik, Maharashtra',
    farm_area: '1.0',
    area_unit: 'acres',
    grape_variety: 'Thompson Seedless',
    purpose: 'table grapes',
    vine_age: '5',
    number_of_vines: '',
    row_spacing: '9.0',
    vine_spacing: '6.0',
    trellis_system: 'Bower / Pandal / Overhead',
    rootstock: 'Dogridge',

    // 2. Growth Stage
    growth_stage: 'Berry Development / Pea Stage',
    pruning_date: '',
    days_after_pruning: '90',
    expected_harvest_date: '',
    previous_season_yield: '11.5',
    avg_yield_history: '12.0',

    // 3. Yield Components
    clusters_per_vine: '35',
    berries_per_cluster: '80',
    berry_weight_g: '4.5',
    cluster_weight_g: '350',
    sample_vine_count: '10',
    cluster_thinning_done: 'yes',
    fruit_drop_pct: '5.0',

    // 4. Soil and Nutrients
    soil_type: 'Black Cotton Soil',
    soil_ph: '7.2',
    npk_n: '120',
    npk_p: '60',
    npk_k: '180',
    organic_carbon: '0.65',
    soil_moisture: '65',
    soil_ec: '1.2',
    drainage_condition: 'Moderate',

    // 5. Irrigation and Fertigation
    irrigation_method: 'Drip Irrigation (Surface)',
    irrigation_frequency: 'Every 2 Days',
    water_amount: '24', // L/vine/day
    fertilizer_schedule: 'Standard Grape Schedule',
    compost_used: '10', // tons/acre
    water_source_quality: 'Good / Fresh Water',

    // 6. Weather Risk
    min_temp: '18',
    max_temp: '34',
    rainfall_30d: '35',
    humidity: '60',
    heat_wave_risk: 'None / Low',
    heavy_rain_hail_risk: 'None / Low',
    harvest_forecast: 'Clear & Sunny',

    // 7. Pest and Disease
    powdery_mildew_severity: 'None / Low',
    downy_mildew_severity: 'None / Low',
    botrytis_severity: 'None / Low',
    mealybug_presence: 'None / Low',
    spray_history: 'Sulfur + Bio-stimulants',

    // 8. Harvest Quality & Pricing
    brix_level: '19.5',
    berry_size_mm: '18.0',
    bunch_compactness: 'Medium',
    color_development_pct: '85',
    market_grade: 'Export Grade (A+)',
    market_price: '65', // per kg
  });

  const handleChange = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleVarietyChange = (val) => {
    handleChange('grape_variety', val);
    if (apiGet) {
      apiGet('/api/predict/grapes-yield/presets')
        .then((res) => {
          if (res.presets && res.presets[val]) {
            const p = res.presets[val];
            setForm((prev) => ({
              ...prev,
              grape_variety: val,
              cluster_weight_g: String(p.cluster_weight_g),
              berry_weight_g: String(p.berry_weight_g),
              berries_per_cluster: String(p.berries_per_cluster),
              clusters_per_vine: String(p.clusters_per_vine),
              market_price: String(p.default_price),
              brix_level: String(p.typical_brix),
              purpose: p.purpose,
              trellis_system: p.trellis || prev.trellis_system,
            }));
            if (notify) notify(`Loaded variety preset for ${val}`, 'info');
          }
        })
        .catch(() => { });
    }
  };

  // ----------------------------------------------------
  // Dynamic Real-Time Client-Side Calculation Engine
  // ----------------------------------------------------
  const livePreview = useMemo(() => {
    const acres =
      form.area_unit === 'hectares'
        ? (parseFloat(form.farm_area) || 1.0) * 2.47105
        : parseFloat(form.farm_area) || 1.0;

    const rowSq = (parseFloat(form.row_spacing) || 9.0) * (parseFloat(form.vine_spacing) || 6.0);
    const vines =
      parseFloat(form.number_of_vines) > 0
        ? parseFloat(form.number_of_vines)
        : Math.round((acres * 43560.0) / Math.max(1.0, rowSq));

    const clusters = parseFloat(form.clusters_per_vine) || 35;
    const berryG = parseFloat(form.berry_weight_g) || 4.5;
    const berriesPerCluster = parseFloat(form.berries_per_cluster) || 80;
    const clusterG =
      parseFloat(form.cluster_weight_g) > 0
        ? parseFloat(form.cluster_weight_g)
        : berryG * berriesPerCluster;

    const dropPct = parseFloat(form.fruit_drop_pct) || 5.0;
    const grossKgPerVine = (clusters * clusterG) / 1000.0;
    const netKgPerVine = grossKgPerVine * (1.0 - dropPct / 100.0);

    // Dynamic Risk Multipliers
    let riskMult = 1.0;
    if (form.powdery_mildew_severity.includes('Severe')) riskMult *= 0.7;
    else if (form.powdery_mildew_severity.includes('Moderate')) riskMult *= 0.85;

    if (form.downy_mildew_severity.includes('Severe')) riskMult *= 0.65;
    else if (form.downy_mildew_severity.includes('Moderate')) riskMult *= 0.82;

    if (form.botrytis_severity.includes('Severe')) riskMult *= 0.68;
    else if (form.botrytis_severity.includes('Moderate')) riskMult *= 0.84;

    if (form.heat_wave_risk.includes('Severe')) riskMult *= 0.85;
    if (form.heavy_rain_hail_risk.includes('Severe')) riskMult *= 0.78;

    const ec = parseFloat(form.soil_ec) || 1.2;
    if (ec > 2.5) riskMult *= 0.9;

    const finalKgPerVine = netKgPerVine * riskMult;
    const netTotalKg = vines * finalKgPerVine;
    const totalTons = netTotalKg / 1000.0;
    const tonsPerAcre = totalTons / Math.max(0.1, acres);

    const price = parseFloat(form.market_price) || 65.0;
    const revenue = netTotalKg * price;
    const costs = vines * 125.0;
    const profit = revenue - costs;

    return {
      vines: Math.round(vines),
      clusterG: Math.round(clusterG),
      totalTons: totalTons.toFixed(2),
      tonsPerAcre: tonsPerAcre.toFixed(2),
      kgPerVine: finalKgPerVine.toFixed(2),
      revenue: Math.round(revenue),
      profit: Math.round(profit),
      riskLossPct: Math.round((1.0 - riskMult) * 100),
    };
  }, [form]);

  // Voice Input Speech Recognition Handler
  const startVoiceInput = (fieldKey) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (notify) notify('Voice input is not supported in this browser.', 'error');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      setListeningField(fieldKey);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const numericMatch = transcript.match(/\d+(\.\d+)?/);
        const nextVal = numericMatch ? numericMatch[0] : transcript;
        handleChange(fieldKey, nextVal);
        if (notify) notify(`Voice captured: "${transcript}"`, 'success');
        setListeningField(null);
      };

      recognition.onerror = () => setListeningField(null);
      recognition.onend = () => setListeningField(null);

      recognition.start();
    } catch (err) {
      setListeningField(null);
    }
  };

  // Submit Request
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost('/api/predict/grapes-yield', form);
      setResult(res);
      setActiveTab('results');
      if (notify) notify('Grapes yield prediction report generated successfully!', 'success');
    } catch (err) {
      if (notify) notify(err.message || 'Failed to calculate yield.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grapes-yield-container">
      {/* Visual Header Banner with Gradient Accent */}
      <header className="grapes-hero-header">
        <div className="hero-header-badge">
          {t('yield.badge')}
        </div>
        <h1>{t('yield.title')}</h1>
        <p className="hero-subtitle">
          {t('yield.subtitle')}
        </p>

        {/* View Switcher Tabs */}
        <div className="grapes-nav-tabs">
          <button
            type="button"
            className={activeTab === 'inputs' ? 'nav-tab-btn active' : 'nav-tab-btn'}
            onClick={() => setActiveTab('inputs')}
          >
            <span className="tab-icon">🍇</span> {t('yield.tabCalculator')}
          </button>
          <button
            type="button"
            className={activeTab === 'results' ? 'nav-tab-btn active' : 'nav-tab-btn'}
            onClick={() => {
              if (!result && notify) notify('Run a calculation first to view the full report.', 'info');
              else setActiveTab('results');
            }}
          >
            <span className="tab-icon">📊</span> {t('yield.tabReport')} {result && <span className="green-badge">{t('yield.readyBadge')}</span>}
          </button>
        </div>
      </header>

      {/* Floating Real-Time Live Preview Header */}
      <div className="grapes-live-float-bar">
        <div className="float-top">
          <strong>{t('yield.livePreviewTitle')}</strong>
          <small>{t('yield.livePreviewSub')}</small>
        </div>

        <div className="float-stats-grid">
          <div className="float-stat-item">
            <span className="stat-lbl">{t('yield.estTotalYield')}</span>
            <strong className="stat-val highlight">{livePreview.totalTons} Tons</strong>
          </div>
          <div className="float-stat-item">
            <span className="stat-lbl">{t('yield.yieldPerAcre')}</span>
            <strong className="stat-val">{livePreview.tonsPerAcre} Tons/Acre</strong>
          </div>
          <div className="float-stat-item">
            <span className="stat-lbl">{t('yield.yieldPerVine')}</span>
            <strong className="stat-val">{livePreview.kgPerVine} kg/vine</strong>
          </div>
          <div className="float-stat-item">
            <span className="stat-lbl">{t('yield.vineDensity')}</span>
            <strong className="stat-val">{livePreview.vines.toLocaleString()} vines</strong>
          </div>
          <div className="float-stat-item">
            <span className="stat-lbl">{t('yield.estGrossRevenue')}</span>
            <strong className="stat-val green">₹{livePreview.revenue.toLocaleString()}</strong>
          </div>
          <div className="float-stat-item">
            <span className="stat-lbl">{t('yield.estNetProfit')}</span>
            <strong className="stat-val purple">₹{livePreview.profit.toLocaleString()}</strong>
          </div>
          {livePreview.riskLossPct > 0 && (
            <div className="float-stat-item alert">
              <span className="stat-lbl">{t('yield.riskPenalty')}</span>
              <strong className="stat-val red">-{livePreview.riskLossPct}% Loss</strong>
            </div>
          )}
        </div>
      </div>

      {/* Form Body */}
      {activeTab === 'inputs' && (
        <form onSubmit={handleSubmit} className="grapes-form-shell">
          {/* Section Quick Navigator Buttons */}
          <div className="section-navigator">
            <span className="nav-label">{t('yield.filterSections')}</span>
            <button
              type="button"
              className={activeSection === 'all' ? 'sec-nav-btn active' : 'sec-nav-btn'}
              onClick={() => setActiveSection('all')}
            >
              {t('yield.showAll8')}
            </button>
            <button
              type="button"
              className={activeSection === 0 ? 'sec-nav-btn active' : 'sec-nav-btn'}
              onClick={() => setActiveSection(0)}
            >
              {t('yield.sec0Nav')}
            </button>
            <button
              type="button"
              className={activeSection === 1 ? 'sec-nav-btn active' : 'sec-nav-btn'}
              onClick={() => setActiveSection(1)}
            >
              {t('yield.sec1Nav')}
            </button>
            <button
              type="button"
              className={activeSection === 2 ? 'sec-nav-btn active' : 'sec-nav-btn'}
              onClick={() => setActiveSection(2)}
            >
              {t('yield.sec2Nav')}
            </button>
            <button
              type="button"
              className={activeSection === 3 ? 'sec-nav-btn active' : 'sec-nav-btn'}
              onClick={() => setActiveSection(3)}
            >
              {t('yield.sec3Nav')}
            </button>
          </div>

          {/* SECTION 1: VINEYARD DETAILS */}
          {(activeSection === 'all' || activeSection === 0) && (
            <section className="grapes-section-card">
              <div className="section-card-header purple">
                <div className="section-num">1</div>
                <div>
                  <h3>{t('yield.sec1Title')}</h3>
                  <p>{t('yield.sec1Desc')}</p>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  <span>{t('yield.location')}</span>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    placeholder={t('yield.locationPlaceholder')}
                  />
                </label>

                <label>
                  <span>{t('yield.farmArea')}</span>
                  <div className="inline-input-group">
                    <input
                      type="number"
                      step="0.1"
                      value={form.farm_area}
                      onChange={(e) => handleChange('farm_area', e.target.value)}
                      required
                    />
                    <select
                      value={form.area_unit}
                      onChange={(e) => handleChange('area_unit', e.target.value)}
                    >
                      <option value="acres">{t('yield.acres')}</option>
                      <option value="hectares">{t('yield.hectares')}</option>
                    </select>
                  </div>
                </label>

                <label>
                  <span>{t('yield.grapeVariety')}</span>
                  <select
                    value={form.grape_variety}
                    onChange={(e) => handleVarietyChange(e.target.value)}
                  >
                    {VARIETIES.map((v) => (
                      <option key={v} value={v}>
                        {tOption('varieties', v)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{t('yield.purpose')}</span>
                  <select
                    value={form.purpose}
                    onChange={(e) => handleChange('purpose', e.target.value)}
                  >
                    <option value="table grapes">{tOption('purpose', 'table grapes')}</option>
                    <option value="raisins">{tOption('purpose', 'raisins')}</option>
                    <option value="wine grapes">{tOption('purpose', 'wine grapes')}</option>
                    <option value="juice">{tOption('purpose', 'juice')}</option>
                  </select>
                </label>

                <label>
                  <span>{t('yield.vineAge')}</span>
                  <input
                    type="number"
                    value={form.vine_age}
                    onChange={(e) => handleChange('vine_age', e.target.value)}
                  />
                </label>

                <label>
                  <span>{t('yield.numberOfVines')}</span>
                  <div className="voice-input-wrapper">
                    <input
                      type="number"
                      value={form.number_of_vines}
                      onChange={(e) => handleChange('number_of_vines', e.target.value)}
                      placeholder={`${t('yield.calculatedVines')} ${livePreview.vines}`}
                    />
                    <button
                      type="button"
                      className="mic-btn"
                      onClick={() => startVoiceInput('number_of_vines')}
                      title="Speak vine count"
                    >
                      {listeningField === 'number_of_vines' ? '🔴' : '🎤'}
                    </button>
                  </div>
                </label>

                <label>
                  <span>{t('yield.rowSpacing')}</span>
                  <input
                    type="number"
                    step="0.5"
                    value={form.row_spacing}
                    onChange={(e) => handleChange('row_spacing', e.target.value)}
                  />
                </label>

                <label>
                  <span>{t('yield.vineSpacing')}</span>
                  <input
                    type="number"
                    step="0.5"
                    value={form.vine_spacing}
                    onChange={(e) => handleChange('vine_spacing', e.target.value)}
                  />
                </label>

                <label>
                  <span>{t('yield.trellisSystem')}</span>
                  <select
                    value={form.trellis_system}
                    onChange={(e) => handleChange('trellis_system', e.target.value)}
                  >
                    {TRELLIS_SYSTEMS.map((tSys) => (
                      <option key={tSys} value={tSys}>
                        {tOption('trellis', tSys)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{t('yield.rootstock')}</span>
                  <select
                    value={form.rootstock}
                    onChange={(e) => handleChange('rootstock', e.target.value)}
                  >
                    {ROOTSTOCKS.map((r) => (
                      <option key={r} value={r}>
                        {tOption('rootstock', r)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}

          {/* SECTION 2: GROWTH STAGE */}
          {(activeSection === 'all' || activeSection === 0) && (
            <section className="grapes-section-card">
              <div className="section-card-header green">
                <div className="section-num">2</div>
                <div>
                  <h3>{t('yield.sec2Title')}</h3>
                  <p>{t('yield.sec2Desc')}</p>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  <span>{t('yield.growthStage')}</span>
                  <select
                    value={form.growth_stage}
                    onChange={(e) => handleChange('growth_stage', e.target.value)}
                  >
                    {GROWTH_STAGES.map((g) => (
                      <option key={g} value={g}>
                        {tOption('growthStages', g)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{t('yield.daysAfterPruning')}</span>
                  <input
                    type="number"
                    value={form.days_after_pruning}
                    onChange={(e) => handleChange('days_after_pruning', e.target.value)}
                  />
                </label>

                <label>
                  <span>{t('yield.prevYield')}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={form.previous_season_yield}
                    onChange={(e) => handleChange('previous_season_yield', e.target.value)}
                  />
                </label>

                <label>
                  <span>{t('yield.avgYieldHistory')}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={form.avg_yield_history}
                    onChange={(e) => handleChange('avg_yield_history', e.target.value)}
                  />
                </label>
              </div>
            </section>
          )}

          {/* SECTION 3: YIELD COMPONENTS & SLIDERS */}
          {(activeSection === 'all' || activeSection === 1) && (
            <section className="grapes-section-card">
              <div className="section-card-header gold">
                <div className="section-num">3</div>
                <div>
                  <h3>{t('yield.sec3Title')}</h3>
                  <p>{t('yield.sec3Desc')}</p>
                </div>
              </div>

              <div className="form-grid sliders-grid">
                <div className="slider-card">
                  <div className="slider-lbl">
                    <span>{t('yield.avgClusters')}</span>
                    <strong className="purple">{form.clusters_per_vine}</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={form.clusters_per_vine}
                    onChange={(e) => handleChange('clusters_per_vine', e.target.value)}
                  />
                </div>

                <div className="slider-card">
                  <div className="slider-lbl">
                    <span>{t('yield.berriesPerCluster')}</span>
                    <strong className="purple">{form.berries_per_cluster}</strong>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="150"
                    value={form.berries_per_cluster}
                    onChange={(e) => handleChange('berries_per_cluster', e.target.value)}
                  />
                </div>

                <div className="slider-card">
                  <div className="slider-lbl">
                    <span>{t('yield.berryWeight')}</span>
                    <strong className="purple">{form.berry_weight_g} g</strong>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="12.0"
                    step="0.1"
                    value={form.berry_weight_g}
                    onChange={(e) => handleChange('berry_weight_g', e.target.value)}
                  />
                </div>

                <div className="slider-card">
                  <div className="slider-lbl">
                    <span>{t('yield.calculatedClusterWeight')}</span>
                    <strong className="gold">{livePreview.clusterG} g</strong>
                  </div>
                  <input
                    type="number"
                    value={form.cluster_weight_g}
                    onChange={(e) => handleChange('cluster_weight_g', e.target.value)}
                  />
                </div>

                <div className="slider-card">
                  <div className="slider-lbl">
                    <span>{t('yield.fruitDropPct')}</span>
                    <strong className="red">{form.fruit_drop_pct}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="0.5"
                    value={form.fruit_drop_pct}
                    onChange={(e) => handleChange('fruit_drop_pct', e.target.value)}
                  />
                </div>

                <label className="slider-card select-field-card">
                  <div className="slider-lbl">
                    <span>{t('yield.clusterThinning')}</span>
                  </div>
                  <select
                    value={form.cluster_thinning_done}
                    onChange={(e) => handleChange('cluster_thinning_done', e.target.value)}
                  >
                    <option value="yes">{tOption('thinning', 'yes')}</option>
                    <option value="no">{tOption('thinning', 'no')}</option>
                  </select>
                </label>
              </div>
            </section>
          )}

          {/* SECTION 4 & 5: SOIL & IRRIGATION */}
          {(activeSection === 'all' || activeSection === 2) && (
            <section className="grapes-section-card">
              <div className="section-card-header blue">
                <div className="section-num">4</div>
                <div>
                  <h3>{t('yield.sec4Title')}</h3>
                  <p>{t('yield.sec4Desc')}</p>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  <span>{t('yield.soilType')}</span>
                  <select
                    value={form.soil_type}
                    onChange={(e) => handleChange('soil_type', e.target.value)}
                  >
                    {SOIL_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {tOption('soilTypes', s)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="slider-card">
                  <div className="slider-lbl">
                    <span>{t('yield.soilPh')}</span>
                    <strong>{form.soil_ph} pH</strong>
                  </div>
                  <input
                    type="range"
                    min="5.0"
                    max="9.0"
                    step="0.1"
                    value={form.soil_ph}
                    onChange={(e) => handleChange('soil_ph', e.target.value)}
                  />
                </div>

                <label>
                  <span>{t('yield.soilEc')}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={form.soil_ec}
                    onChange={(e) => handleChange('soil_ec', e.target.value)}
                  />
                </label>

                <label>
                  <span>{t('yield.drainage')}</span>
                  <select
                    value={form.drainage_condition}
                    onChange={(e) => handleChange('drainage_condition', e.target.value)}
                  >
                    {DRAINAGE_CONDITIONS.map((d) => (
                      <option key={d} value={d}>
                        {tOption('drainage', d)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{t('yield.irrigationMethod')}</span>
                  <select
                    value={form.irrigation_method}
                    onChange={(e) => handleChange('irrigation_method', e.target.value)}
                  >
                    {IRRIGATION_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {tOption('irrigation', m)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{t('yield.waterDelivery')}</span>
                  <input
                    type="number"
                    value={form.water_amount}
                    onChange={(e) => handleChange('water_amount', e.target.value)}
                  />
                </label>

                <label>
                  <span>{t('yield.fertilizerSchedule')}</span>
                  <select
                    value={form.fertilizer_schedule}
                    onChange={(e) => handleChange('fertilizer_schedule', e.target.value)}
                  >
                    {FERTILIZER_SCHEDULES.map((f) => (
                      <option key={f} value={f}>
                        {tOption('fertilizer', f)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}

          {/* SECTION 6 & 7: WEATHER & DISEASE RISKS */}
          {(activeSection === 'all' || activeSection === 3) && (
            <section className="grapes-section-card">
              <div className="section-card-header rose">
                <div className="section-num">5</div>
                <div>
                  <h3>{t('yield.sec5Title')}</h3>
                  <p>{t('yield.sec5Desc')}</p>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  <span>{t('yield.powderyMildew')}</span>
                  <select
                    value={form.powdery_mildew_severity}
                    onChange={(e) => handleChange('powdery_mildew_severity', e.target.value)}
                  >
                    {RISK_LEVELS.map((r) => (
                      <option key={r} value={r}>
                        {tOption('riskLevels', r)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{t('yield.downyMildew')}</span>
                  <select
                    value={form.downy_mildew_severity}
                    onChange={(e) => handleChange('downy_mildew_severity', e.target.value)}
                  >
                    {RISK_LEVELS.map((r) => (
                      <option key={r} value={r}>
                        {tOption('riskLevels', r)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{t('yield.botrytis')}</span>
                  <select
                    value={form.botrytis_severity}
                    onChange={(e) => handleChange('botrytis_severity', e.target.value)}
                  >
                    {RISK_LEVELS.map((r) => (
                      <option key={r} value={r}>
                        {tOption('riskLevels', r)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{t('yield.heatWave')}</span>
                  <select
                    value={form.heat_wave_risk}
                    onChange={(e) => handleChange('heat_wave_risk', e.target.value)}
                  >
                    {RISK_LEVELS.map((r) => (
                      <option key={r} value={r}>
                        {tOption('riskLevels', r)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{t('yield.heavyRain')}</span>
                  <select
                    value={form.heavy_rain_hail_risk}
                    onChange={(e) => handleChange('heavy_rain_hail_risk', e.target.value)}
                  >
                    {RISK_LEVELS.map((r) => (
                      <option key={r} value={r}>
                        {tOption('riskLevels', r)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="slider-card">
                  <div className="slider-lbl">
                    <span>{t('yield.brixTarget')}</span>
                    <strong className="gold">{form.brix_level}° Brix</strong>
                  </div>
                  <input
                    type="range"
                    min="12.0"
                    max="28.0"
                    step="0.5"
                    value={form.brix_level}
                    onChange={(e) => handleChange('brix_level', e.target.value)}
                  />
                </div>

                <label>
                  <span>{t('yield.marketPriceInput')}</span>
                  <input
                    type="number"
                    value={form.market_price}
                    onChange={(e) => handleChange('market_price', e.target.value)}
                  />
                </label>
              </div>
            </section>
          )}


          {/* Big Action Button */}
          <div className="submit-action-container">
            <button type="submit" className="grand-predict-btn" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner-dot"></span> {t('yield.calculating')}
                </>
              ) : (
                t('yield.calculateBtn')
              )}
            </button>
          </div>
        </form>
      )}

      {/* Analytical Report View */}
      {activeTab === 'results' && result && (
        <div className="grapes-results-container">
          {/* Main Hero Metrics Grid */}
          <div className="report-hero-grid">
            <div className="report-hero-card primary">
              <span className="card-kicker">{t('yield.totalYieldHeader')}</span>
              <h2>{result.yield_summary.total_yield_tons} Tons</h2>
              <small>({result.yield_summary.total_yield_kg.toLocaleString()} kg {t('yield.totalHarvestKg')})</small>
            </div>

            <div className="report-hero-card">
              <span className="card-kicker">{t('yield.yieldPerAcreHeader')}</span>
              <h2>{result.yield_summary.yield_per_acre_tons} Tons / Acre</h2>
              <small>({result.yield_summary.yield_per_ha_tons} Tons / Hectare)</small>
            </div>

            <div className="report-hero-card">
              <span className="card-kicker">{t('yield.yieldPerVineHeader')}</span>
              <h2>{result.yield_summary.yield_per_vine_kg} kg / vine</h2>
              <small>From {result.inputs.total_vines.toLocaleString()} total vines</small>
            </div>

            <div className="report-hero-card">
              <span className="card-kicker">{t('yield.modelConfidenceHeader')}</span>
              <h2>{result.yield_summary.confidence_score}%</h2>
              <div className="report-progress-track">
                <div
                  className="report-progress-bar"
                  style={{ width: `${result.yield_summary.confidence_score}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Auto Estimations Indicator */}
          {Object.keys(result.estimations || {}).length > 0 && (
            <div className="estimations-callout">
              <h4>⚡ Intelligent Parameter Estimations</h4>
              <ul>
                {Object.entries(result.estimations).map(([k, val]) => (
                  <li key={k}>
                    <strong>{k.replace(/_/g, ' ')}:</strong> {val}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Scenario Range Bar */}
          <div className="report-section-card">
            <h3>Expected Yield Scenario Spectrum</h3>
            <div className="spectrum-grid">
              <div className="spectrum-card worst">
                <span className="spec-lbl">WORST-CASE SCENARIO</span>
                <strong className="spec-val">{result.yield_summary.range.worst_case_tons} Tons</strong>
                <small>High disease / weather loss</small>
              </div>

              <div className="spectrum-card expected">
                <span className="spec-lbl">EXPECTED TARGET YIELD</span>
                <strong className="spec-val">{result.yield_summary.range.expected_tons} Tons</strong>
                <small>Optimal canopy & irrigation</small>
              </div>

              <div className="spectrum-card best">
                <span className="spec-lbl">BEST-CASE SCENARIO</span>
                <strong className="spec-val">{result.yield_summary.range.best_case_tons} Tons</strong>
                <small>Favorable harvest conditions</small>
              </div>
            </div>
          </div>

          {/* Financial Revenue & Profit */}
          <div className="report-section-card">
            <h3>{t('yield.financialSection')}</h3>
            <div className="fin-metrics-grid">
              <div className="fin-box">
                <span>{t('yield.marketPrice')}</span>
                <strong>₹{result.financials.market_price_per_kg} / kg</strong>
              </div>
              <div className="fin-box green">
                <span>{t('yield.grossRevenue')}</span>
                <strong>₹{result.financials.expected_revenue.toLocaleString()}</strong>
              </div>
              <div className="fin-box red">
                <span>{t('yield.cultivationCosts')}</span>
                <strong>₹{result.financials.estimated_costs.toLocaleString()}</strong>
              </div>
              <div className="fin-box purple">
                <span>{t('yield.netProfit')}</span>
                <strong>₹{result.financials.expected_profit.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Quality & Risk Grid */}
          <div className="report-split-grid">
            <div className="report-section-card">
              <h3>{t('yield.qualitySection')}</h3>
              <div className="quality-pill">{result.quality_assessment.grade}</div>
              <p className="quality-desc">{result.quality_assessment.description}</p>
              <div className="quality-subinfo">
                <span>Target Sugar: <strong>{result.quality_assessment.target_brix}° Brix</strong></span>
                <span>Color Shift: <strong>{result.quality_assessment.color_development}%</strong></span>
              </div>
            </div>

            <div className="report-section-card">
              <h3>⚠️ Yield-Limiting Risk Impactors</h3>
              <ul className="risk-item-list">
                {result.risk_analysis.limiting_factors.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Targeted Recommendations */}
          <div className="report-section-card">
            <h3>{t('yield.agronomicSection')}</h3>
            <div className="rec-row">
              <strong>{t('yield.irrigationGuidance')}</strong>
              <p>{result.recommendations.irrigation}</p>
            </div>
            <div className="rec-row">
              <strong>{t('yield.fertigationGuidance')}</strong>
              <p>{result.recommendations.fertigation}</p>
            </div>
            <div className="rec-row">
              <strong>🍃 Organic Farming Protocol:</strong>
              <p>{result.recommendations.organic_farming}</p>
            </div>
            <div className="rec-row">
              <strong>✂️ Harvest Readiness Advice:</strong>
              <p>{result.recommendations.harvest_readiness}</p>
            </div>
          </div>

          {/* 7-Day & Harvest Action Plans */}
          <div className="report-split-grid">
            <div className="report-section-card">
              <h3>{t('yield.actionPlanSection')}</h3>
              <ol className="step-ol">
                {result.action_plans.seven_day_plan.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="report-section-card">
              <h3>🏆 Milestone Action Plan Until Harvest</h3>
              <div className="milestone-timeline">
                {result.action_plans.until_harvest_plan.map((item, i) => (
                  <div key={i} className="milestone-card">
                    <span className="milestone-phase">{item.phase}</span>
                    <p>{item.task}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Print & Action Buttons */}
          <div className="report-actions-bar">
            <button type="button" className="print-btn" onClick={() => window.print()}>
              {t('yield.printReport')}
            </button>
            <button type="button" className="adjust-btn" onClick={() => setActiveTab('inputs')}>
              ✏️ Adjust Vineyard Inputs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

