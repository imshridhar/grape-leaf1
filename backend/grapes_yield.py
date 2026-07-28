import math
from datetime import datetime

# Grape Variety Preset Database
VARIETY_PRESETS = {
    "Thompson Seedless": {
        "cluster_weight_g": 350.0,
        "berry_weight_g": 4.5,
        "berries_per_cluster": 80,
        "clusters_per_vine": 35,
        "default_price": 65.0,  # Currency per kg
        "typical_brix": 19.5,
        "purpose": "table grapes",
        "trellis": "Bower / Pandal / Overhead",
    },
    "Cabernet Sauvignon": {
        "cluster_weight_g": 135.0,
        "berry_weight_g": 1.6,
        "berries_per_cluster": 90,
        "clusters_per_vine": 42,
        "default_price": 90.0,
        "typical_brix": 23.5,
        "purpose": "wine grapes",
        "trellis": "VSP (Vertical Shoot Positioning)",
    },
    "Shiraz / Syrah": {
        "cluster_weight_g": 160.0,
        "berry_weight_g": 1.8,
        "berries_per_cluster": 90,
        "clusters_per_vine": 38,
        "default_price": 85.0,
        "typical_brix": 24.0,
        "purpose": "wine grapes",
        "trellis": "VSP (Vertical Shoot Positioning)",
    },
    "Flame Seedless": {
        "cluster_weight_g": 400.0,
        "berry_weight_g": 5.2,
        "berries_per_cluster": 80,
        "clusters_per_vine": 32,
        "default_price": 75.0,
        "typical_brix": 18.0,
        "purpose": "table grapes",
        "trellis": "Y-Trellis",
    },
    "Sharad Seedless": {
        "cluster_weight_g": 380.0,
        "berry_weight_g": 4.8,
        "berries_per_cluster": 82,
        "clusters_per_vine": 34,
        "default_price": 70.0,
        "typical_brix": 19.0,
        "purpose": "table grapes",
        "trellis": "Bower / Pandal / Overhead",
    },
    "Concord": {
        "cluster_weight_g": 150.0,
        "berry_weight_g": 2.5,
        "berries_per_cluster": 60,
        "clusters_per_vine": 45,
        "default_price": 40.0,
        "typical_brix": 16.5,
        "purpose": "juice",
        "trellis": "Single Curtain",
    },
    "Red Globe": {
        "cluster_weight_g": 550.0,
        "berry_weight_g": 9.5,
        "berries_per_cluster": 60,
        "clusters_per_vine": 25,
        "default_price": 80.0,
        "typical_brix": 17.5,
        "purpose": "table grapes",
        "trellis": "Bower / Pandal / Overhead",
    },
    "Bangalore Blue": {
        "cluster_weight_g": 220.0,
        "berry_weight_g": 3.0,
        "berries_per_cluster": 75,
        "clusters_per_vine": 40,
        "default_price": 45.0,
        "typical_brix": 17.0,
        "purpose": "juice",
        "trellis": "Bower / Pandal / Overhead",
    },
    "Pinot Noir": {
        "cluster_weight_g": 120.0,
        "berry_weight_g": 1.4,
        "berries_per_cluster": 85,
        "clusters_per_vine": 35,
        "default_price": 110.0,
        "typical_brix": 23.0,
        "purpose": "wine grapes",
        "trellis": "VSP (Vertical Shoot Positioning)",
    },
    "Chardonnay": {
        "cluster_weight_g": 140.0,
        "berry_weight_g": 1.5,
        "berries_per_cluster": 95,
        "clusters_per_vine": 36,
        "default_price": 100.0,
        "typical_brix": 23.5,
        "purpose": "wine grapes",
        "trellis": "VSP (Vertical Shoot Positioning)",
    },
    "Crimson Seedless": {
        "cluster_weight_g": 420.0,
        "berry_weight_g": 5.0,
        "berries_per_cluster": 85,
        "clusters_per_vine": 30,
        "default_price": 85.0,
        "typical_brix": 19.0,
        "purpose": "table grapes",
        "trellis": "Y-Trellis",
    },
}

DEFAULT_PRESET = VARIETY_PRESETS["Thompson Seedless"]


def calculate_grapes_yield(data):
    """
    Calculates detailed grape yield, quality risk, financial revenue,
    and action plans for grape vineyards.
    """
    estimations = {}
    missing_count = 0
    limiting_factors = []

    # ----------------------------------------------------
    # 1. Vineyard & Vine Parameters
    # ----------------------------------------------------
    variety = data.get("grape_variety") or "Thompson Seedless"
    preset = VARIETY_PRESETS.get(variety, DEFAULT_PRESET)

    area_val = float(data.get("farm_area") or 1.0)
    area_unit = data.get("area_unit") or "acres"
    # Convert to acres for standard internal math
    acres = area_val if area_unit.lower() == "acres" else area_val * 2.47105

    row_spacing = float(data.get("row_spacing") or 9.0)  # ft
    vine_spacing = float(data.get("vine_spacing") or 6.0)  # ft
    sqft_per_vine = row_spacing * vine_spacing

    vines_input = data.get("number_of_vines")
    if vines_input and float(vines_input) > 0:
        total_vines = int(float(vines_input))
    else:
        # Estimate vines from spacing (1 acre = 43,560 sq ft)
        total_vines = int((acres * 43560.0) / max(1.0, sqft_per_vine))
        estimations["number_of_vines"] = f"{total_vines:,} vines (calculated from {row_spacing}ft × {vine_spacing}ft spacing)"
        missing_count += 1

    vine_age = float(data.get("vine_age") or 5.0)

    # ----------------------------------------------------
    # 2. Yield Component Parameters
    # ----------------------------------------------------
    clusters_input = data.get("clusters_per_vine")
    if clusters_input and float(clusters_input) > 0:
        clusters_per_vine = float(clusters_input)
    else:
        clusters_per_vine = float(preset["clusters_per_vine"])
        estimations["clusters_per_vine"] = f"{clusters_per_vine:.0f} clusters/vine (typical for {variety})"
        missing_count += 1

    berry_wt_input = data.get("berry_weight_g")
    berries_cluster_input = data.get("berries_per_cluster")
    cluster_wt_input = data.get("cluster_weight_g")

    if cluster_wt_input and float(cluster_wt_input) > 0:
        cluster_weight_g = float(cluster_wt_input)
    elif berry_wt_input and berries_cluster_input and float(berry_wt_input) > 0 and float(berries_cluster_input) > 0:
        cluster_weight_g = float(berry_wt_input) * float(berries_cluster_input)
        estimations["cluster_weight_g"] = f"{cluster_weight_g:.1f} g (derived from {berry_wt_input}g berry × {berries_cluster_input} berries)"
    else:
        cluster_weight_g = float(preset["cluster_weight_g"])
        estimations["cluster_weight_g"] = f"{cluster_weight_g:.0f} g (estimated for {variety})"
        missing_count += 1

    fruit_drop_pct = float(data.get("fruit_drop_pct") or 5.0)

    # Base Yield (unadjusted kg)
    cluster_weight_kg = cluster_weight_g / 1000.0
    yield_per_vine_base = clusters_per_vine * cluster_weight_kg * (1.0 - (fruit_drop_pct / 100.0))
    raw_total_yield_kg = yield_per_vine_base * total_vines

    # ----------------------------------------------------
    # 3. Risk & Impact Penalties
    # ----------------------------------------------------
    risk_factor = 1.0

    # Age impact
    if vine_age < 3:
        risk_factor *= 0.60
        limiting_factors.append("Young Vines (< 3 years): Reduced cluster bearing capacity")
    elif vine_age > 25:
        risk_factor *= 0.88
        limiting_factors.append("Aging Vine Trunk (> 25 years): Gradual vascular decline")

    # Powdery Mildew
    powdery = (data.get("powdery_mildew_severity") or "None").lower()
    if "severe" in powdery or "high" in powdery:
        risk_factor *= 0.72
        limiting_factors.append("Severe Powdery Mildew: High berry scarring & cracking risk (-28%)")
    elif "moderate" in powdery or "medium" in powdery:
        risk_factor *= 0.86
        limiting_factors.append("Moderate Powdery Mildew: Canopy & cluster infection (-14%)")

    # Downy Mildew
    downy = (data.get("downy_mildew_severity") or "None").lower()
    if "severe" in downy or "high" in downy:
        risk_factor *= 0.68
        limiting_factors.append("Severe Downy Mildew: Defoliation & cluster drop risk (-32%)")
    elif "moderate" in downy or "medium" in downy:
        risk_factor *= 0.84
        limiting_factors.append("Moderate Downy Mildew: Foliar lesions & cluster damage (-16%)")

    # Botrytis / Bunch Rot
    botrytis = (data.get("botrytis_severity") or "None").lower()
    if "severe" in botrytis or "high" in botrytis:
        risk_factor *= 0.70
        limiting_factors.append("Severe Botrytis Bunch Rot: Berry decay & soft rot (-30%)")
    elif "moderate" in botrytis or "medium" in botrytis:
        risk_factor *= 0.85
        limiting_factors.append("Moderate Botrytis Rot: Partial cluster decay (-15%)")

    # Mealybug / Thrips
    pests = (data.get("mealybug_presence") or "None").lower()
    if "heavy" in pests or "severe" in pests or "high" in pests:
        risk_factor *= 0.88
        limiting_factors.append("Heavy Mealybug / Thrips: Sooty mold & honeydew damage (-12%)")

    # Weather Risks
    heat_risk = (data.get("heat_wave_risk") or "Low").lower()
    if "severe" in heat_risk or "high" in heat_risk:
        risk_factor *= 0.88
        limiting_factors.append("Heat Wave Risk: Berry sunburn & desiccation threat (-12%)")

    rain_hail_risk = (data.get("heavy_rain_hail_risk") or "Low").lower()
    if "severe" in rain_hail_risk or "high" in rain_hail_risk:
        risk_factor *= 0.82
        limiting_factors.append("Heavy Rain / Hail Risk: Cluster shatter & splitting threat (-18%)")

    # Soil & Salinity
    try:
        ec_val = float(data.get("soil_ec") or 1.2)
        if ec_val > 2.5:
            risk_factor *= 0.90
            limiting_factors.append(f"High Soil Salinity (EC {ec_val} dS/m): Salt stress & reduced berry sizing (-10%)")
    except (ValueError, TypeError):
        pass

    try:
        ph_val = float(data.get("soil_ph") or 7.0)
        if ph_val < 5.5 or ph_val > 8.2:
            risk_factor *= 0.93
            limiting_factors.append(f"Suboptimal Soil pH ({ph_val}): Micronutrient uptake restriction (-7%)")
    except (ValueError, TypeError):
        pass

    drainage = (data.get("drainage_condition") or "Moderate").lower()
    if "poor" in drainage or "waterlogged" in drainage:
        risk_factor *= 0.88
        limiting_factors.append("Poor Soil Drainage: Root asphyxiation & fungal decay risk (-12%)")

    # ----------------------------------------------------
    # 4. Final Calculated Yield Metrics
    # ----------------------------------------------------
    final_yield_kg = raw_total_yield_kg * risk_factor
    expected_yield_tons = final_yield_kg / 1000.0

    yield_per_vine_kg = final_yield_kg / max(1, total_vines)
    yield_per_acre_tons = expected_yield_tons / max(0.1, acres)
    yield_per_ha_tons = yield_per_acre_tons * 2.47105

    # Yield Scenarios
    best_case_tons = expected_yield_tons * 1.14
    worst_case_tons = expected_yield_tons * 0.78

    # Confidence Score
    confidence_score = max(65, min(97, int(92 - (missing_count * 4) - (len(limiting_factors) * 3))))

    # ----------------------------------------------------
    # 5. Quality Grade Prediction
    # ----------------------------------------------------
    brix_val = float(data.get("brix_level") or preset["typical_brix"])
    if not data.get("brix_level"):
        estimations["brix_level"] = f"{brix_val}° Brix (typical for {variety})"

    color_dev = float(data.get("color_development_pct") or 85.0)

    if (
        brix_val >= 18.0
        and color_dev >= 85.0
        and "severe" not in powdery
        and "severe" not in downy
        and "severe" not in botrytis
    ):
        quality_grade = "Export Grade (A+ Premium)"
        quality_desc = "Excellent berry size, uniform sugar accumulation, and zero cosmetic defect risk."
    elif brix_val >= 16.5 and color_dev >= 75.0:
        quality_grade = "Local Market Grade (Grade A)"
        quality_desc = "Good market quality suitable for domestic fresh table fruit distribution."
    elif brix_val >= 14.0:
        quality_grade = "Processing / Juice Grade (Grade B)"
        quality_desc = "Suitable for juice extraction, raisins, or secondary processing."
    else:
        quality_grade = "Distillery / Domestic Grade (Grade C)"
        quality_desc = "Suboptimal sugar or color development; best allocated for wine distillation or processing."

    # ----------------------------------------------------
    # 6. Revenue & Financial Math
    # ----------------------------------------------------
    market_price = float(data.get("market_price") or preset["default_price"])
    if not data.get("market_price"):
        estimations["market_price"] = f"₹{market_price:.0f}/kg (average market rate for {variety})"

    expected_revenue = final_yield_kg * market_price
    # Estimated input costs: ~₹120 / $1.50 per vine per season
    estimated_costs = total_vines * 125.0
    expected_profit = expected_revenue - estimated_costs

    # ----------------------------------------------------
    # 7. Action Plans & Specific Recommendations
    # ----------------------------------------------------
    stage = data.get("growth_stage") or "Berry Development / Pea Stage"

    # Irrigation Recommendation
    if "flowering" in stage.lower():
        irrigation_rec = "Maintain moderate soil moisture (55-65%). Avoid heavy irrigation during bloom to prevent shatter."
    elif "veraison" in stage.lower() or "ripening" in stage.lower():
        irrigation_rec = "Regulated Deficit Irrigation (RDI): Reduce water by 20-30% to concentrate sugars and color development."
    else:
        irrigation_rec = "Apply 20-28 Liters/vine/day via surface drip. Keep root zone moisture steady at 65-70% field capacity."

    # Fertigation Recommendation
    if "veraison" in stage.lower() or "ripening" in stage.lower():
        fertigation_rec = "Foliar & Drip Potash (SOP - Potassium Sulfate 0-0-50 @ 4kg/acre weekly) + Boron for sugar transkocation."
    elif "flowering" in stage.lower() or "bud" in stage.lower():
        fertigation_rec = "Balanced NPK (19-19-19) + Phosphoric Acid for root vigor and early cluster development."
    else:
        fertigation_rec = "Calcium Nitrate (5kg/acre) + Magnesium Sulfate (3kg/acre) to build tough berry skins and prevent bitter pit."

    # Organic Recommendation
    organic_rec = (
        "Apply Trichoderma viride & Pseudomonas fluorescens root drench to suppress wood rots. "
        "Use Neem oil (10,000 ppm @ 2ml/L) and Vermicompost (3 tons/acre) for soil carbon enrichment."
    )

    # Harvest Readiness Advice
    harvest_advice = (
        f"Target Harvest Brix: {brix_val:.1f}° Brix. Monitor sugar accumulation every 3 days. "
        f"Harvest in early morning hours (6:00 AM - 10:00 AM) to maintain berry firmness and field heat control."
    )

    # 7-Day Action Plan
    seven_day_plan = [
        "Inspect 20 random vines for early signs of Powdery or Downy mildew lesions.",
        "Verify drip emitter discharge rate and clean Y-filters to ensure uniform water delivery.",
        "Execute foliar spray of Potassium & Calcium to enhance berry skin strength.",
        "Perform light canopy thinning around cluster zone to improve sunlight exposure and air drying.",
        "Refine harvest labor schedule based on sugar Brix progression.",
    ]

    # Until-Harvest Action Plan
    until_harvest_plan = [
        {"phase": "Next 1-2 Weeks", "task": "Maintain canopy airflow and apply protective organic or mild fungicide cover."},
        {"phase": "Veraison (Color Shift)", "task": "Initiate Regulated Deficit Irrigation and transition to High-Potash fertigation."},
        {"phase": "10 Days Pre-Harvest", "task": "Stop all chemical sprays to observe pre-harvest interval (PHI) safety compliance."},
        {"phase": "Harvest Week", "task": "Test Brix daily, sanitize harvesting shears, and prepare cold-chain transport crates."},
    ]

    return {
        "status": "success",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "inputs": {
            "variety": variety,
            "farm_area": area_val,
            "area_unit": area_unit,
            "acres": round(acres, 2),
            "total_vines": total_vines,
            "growth_stage": stage,
            "row_spacing": row_spacing,
            "vine_spacing": vine_spacing,
            "vine_age": vine_age,
        },
        "estimations": estimations,
        "yield_summary": {
            "total_yield_tons": round(expected_yield_tons, 2),
            "total_yield_kg": round(final_yield_kg, 1),
            "yield_per_vine_kg": round(yield_per_vine_kg, 2),
            "yield_per_acre_tons": round(yield_per_acre_tons, 2),
            "yield_per_ha_tons": round(yield_per_ha_tons, 2),
            "range": {
                "worst_case_tons": round(worst_case_tons, 2),
                "expected_tons": round(expected_yield_tons, 2),
                "best_case_tons": round(best_case_tons, 2),
            },
            "confidence_score": confidence_score,
        },
        "quality_assessment": {
            "grade": quality_grade,
            "description": quality_desc,
            "target_brix": brix_val,
            "color_development": color_dev,
        },
        "risk_analysis": {
            "risk_multiplier": round(risk_factor, 2),
            "limiting_factors": limiting_factors if limiting_factors else ["Optimal vineyard conditions detected; no major yield suppressors."],
        },
        "financials": {
            "market_price_per_kg": market_price,
            "expected_revenue": round(expected_revenue, 2),
            "estimated_costs": round(estimated_costs, 2),
            "expected_profit": round(expected_profit, 2),
        },
        "recommendations": {
            "irrigation": irrigation_rec,
            "fertigation": fertigation_rec,
            "organic_farming": organic_rec,
            "harvest_readiness": harvest_advice,
        },
        "action_plans": {
            "seven_day_plan": seven_day_plan,
            "until_harvest_plan": until_harvest_plan,
        },
    }
