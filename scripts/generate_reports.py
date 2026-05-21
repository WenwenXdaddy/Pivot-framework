#!/usr/bin/env python3
"""
Pivot Framework Report Generator
Called by Claude Code after data refresh to produce HTML dashboard and PDF report.

Usage:
    python3 scripts/generate_reports.py

Reads: data/weekly_log.json (latest entry)
Writes: output/latest.html, output/report.pdf
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "weekly_log.json"
HTML_OUT = ROOT / "output" / "latest.html"
PDF_OUT = ROOT / "output" / "report.pdf"


def load_latest():
    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return data["entries"][-1]


def color_for_direction(d):
    return {"strengthening": "#2D7A3A", "weakening": "#B03030", "stable": "#9C9A8F"}.get(d, "#9C9A8F")


def arrow_for_direction(d):
    return {"strengthening": "&#x2191;", "weakening": "&#x2193;", "stable": "&#x2192;"}.get(d, "&#x2192;")


def to_float(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace("%", "").replace("$", "").replace(",", "").replace("+", "").replace("bp", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def fmt_num(value, digits=1, suffix="", prefix=""):
    num = to_float(value)
    if num is None:
        return "&mdash;"
    if digits == 0:
        return f"{prefix}{num:,.0f}{suffix}"
    return f"{prefix}{num:,.{digits}f}{suffix}"


def fmt_money(value, digits=0):
    return fmt_num(value, digits=digits, prefix="$")


def fmt_pct(value, digits=1):
    return fmt_num(value, digits=digits, suffix="%")


def fmt_bp(value):
    num = to_float(value)
    if num is None:
        return "&mdash;"
    return f"{num * 100:+.0f}bp"


def fmt_prob(value):
    num = to_float(value)
    if num is None:
        return "&mdash;"
    if num > 1:
        num = num / 100
    return f"{num * 100:.0f}%"


SCENARIO_PROB_KEYS = {
    "s1": "s1_no_pivot",
    "s2": "s2_tariff_rollback",
    "s3": "s3_oil_trap",
}


def get_scenario_prob(entry, scenario_key):
    probs = entry.get("scenario_probs", {}) or {}
    canonical = to_float(probs.get(SCENARIO_PROB_KEYS.get(scenario_key, "")))
    if canonical is not None:
        return canonical / 100 if canonical > 1 else canonical

    old_prob = to_float((entry.get("scenarios", {}) or {}).get(scenario_key, {}).get("prob"))
    if old_prob is not None:
        return old_prob / 100 if old_prob > 1 else old_prob
    return None


def recompute_derived_readings(readings):
    r = dict(readings or {})
    y10 = to_float(r.get("yield_10y"))
    y2 = to_float(r.get("yield_2y"))
    pe = to_float(r.get("sp500_forward_pe"))
    if r.get("spread_2s10s") is None and y10 is not None and y2 is not None:
        r["spread_2s10s"] = round(y10 - y2, 2)
    if r.get("erp") is None and y10 is not None and pe:
        r["erp"] = round((1 / pe) * 100 - y10, 2)
    return r


def generate_html(entry):
    r = recompute_derived_readings(entry.get("readings", {}))
    s = entry.get("scenario_probs", {})
    scenarios = entry.get("scenarios", {})
    alerts = entry.get("threshold_alerts", [])
    headline = entry.get("headline", "")
    positioning = entry.get("positioning_update", "")
    elaborations = entry.get("elaborations", {})
    date = entry.get("date", datetime.now().strftime("%Y-%m-%d"))

    # Build scenario cards
    sc_configs = [
        {"key": "s1", "prob_key": "s1_no_pivot", "tag": "No pivot", "tag_bg": "#FDF0F0", "tag_color": "#B03030",
         "title": "S1: Stagflation lock-in", "label": "Scenario 1"},
        {"key": "s2", "prob_key": "s2_tariff_rollback", "tag": "Base case", "tag_bg": "#EDF2FA", "tag_color": "#2D5A9E",
         "title": "S2: Tariff rollback", "label": "Scenario 2"},
        {"key": "s3", "prob_key": "s3_oil_trap", "tag": "Trap", "tag_bg": "#FDF6E8", "tag_color": "#9A6B11",
         "title": "S3: Oil trap", "label": "Scenario 3"},
    ]

    sc_cards_html = ""
    for sc in sc_configs:
        prob = get_scenario_prob(entry, sc["key"])
        sc_detail = scenarios.get(sc["key"], {})
        direction = sc_detail.get("direction", "stable")
        signal = sc_detail.get("key_signal", "")
        arrow = arrow_for_direction(direction)
        dc = color_for_direction(direction)
        featured = ' style="border:2px solid #2D5A9E"' if sc["key"] == "s2" else ""
        sc_cards_html += f"""
        <div class="sc"{featured} onclick="showElaboration('{sc['key']}')">
          <div class="sc-tag" style="background:{sc['tag_bg']};color:{sc['tag_color']}">{sc['tag']}</div>
          <h3>{sc['title']}</h3>
          <div class="prob">{fmt_prob(prob)}</div>
          <div class="dir" style="color:{dc}">{arrow} {direction}</div>
          <div class="signal">{signal}</div>
        </div>"""

    # Build alerts
    alerts_html = "".join(f'<span class="alert-tag">{a}</span>' for a in alerts)

    # Build elaboration sections
    elab_html = ""
    for key, content in elaborations.items():
        title = {"s1": "Scenario 1: No pivot — deep dive",
                 "s2": "Scenario 2: Tariff rollback — deep dive",
                 "s3": "Scenario 3: Oil trap — deep dive"}.get(key, key)
        elab_html += f"""
        <div class="elab-section" id="elab-{key}" style="display:none">
          <h3>{title}</h3>
          <div class="elab-content">{content}</div>
        </div>"""

    # Headline section
    headline_html = ""
    if headline:
        headline_html = f"""
        <div class="headline-box">
          <div class="hl">{headline}</div>
          <div class="pos">{positioning}</div>
        </div>"""

    # History chart data
    all_entries = []
    try:
        with open(DATA_FILE, encoding="utf-8") as f:
            all_entries = json.load(f).get("entries", [])
    except Exception:
        pass

    chart_labels = json.dumps([e["date"] for e in all_entries])
    chart_econ = json.dumps([e.get("readings", {}).get("econ_approval", None) for e in all_entries])
    chart_gop = json.dumps([e.get("readings", {}).get("gop_approval", None) for e in all_entries])
    chart_y10 = json.dumps([recompute_derived_readings(e.get("readings", {})).get("yield_10y", None) for e in all_entries])
    chart_erp = json.dumps([recompute_derived_readings(e.get("readings", {})).get("erp", None) for e in all_entries])
    chart_s1 = json.dumps([round(p * 100) if (p := get_scenario_prob(e, "s1")) is not None else None for e in all_entries])
    chart_s2 = json.dumps([round(p * 100) if (p := get_scenario_prob(e, "s2")) is not None else None for e in all_entries])
    chart_s3 = json.dumps([round(p * 100) if (p := get_scenario_prob(e, "s3")) is not None else None for e in all_entries])

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pivot Framework — {date}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
:root {{ --bg:#FAF9F6;--card:#FFF;--card-alt:#F3F1EC;--border:#E2DFD6;--text:#1A1A18;--sec:#6B6960;--tert:#9C9A8F;
  --danger:#B03030;--warning:#9A6B11;--success:#2D7A3A;--info:#2D5A9E;
  --danger-bg:#FDF0F0;--warning-bg:#FDF6E8;--success-bg:#EDF7EF;--info-bg:#EDF2FA;
  --font:'DM Sans',-apple-system,sans-serif;--serif:'DM Serif Display',Georgia,serif; }}
* {{ box-sizing:border-box;margin:0;padding:0 }}
body {{ font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6 }}
.container {{ max-width:880px;margin:0 auto;padding:2rem 1.5rem 4rem }}
header h1 {{ font-family:var(--serif);font-size:24px;font-weight:400 }}
header p {{ font-size:12px;color:var(--tert);margin-top:2px }}
.divider {{ height:1px;background:var(--border);margin:1.5rem 0 }}
.section-label {{ font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--tert);margin-bottom:10px }}
.gauge-row {{ display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:1.5rem }}
.gauge {{ background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px }}
.gauge-label {{ font-size:11px;color:var(--sec) }}
.gauge-val {{ font-size:22px;font-weight:600;margin-top:2px }}
.gauge-sub {{ font-size:10px;color:var(--tert);margin-top:2px }}
.market-row {{ display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.5rem }}
.mkt {{ background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 12px }}
.mkt-label {{ font-size:10px;color:var(--tert);text-transform:uppercase;letter-spacing:0.05em }}
.mkt-val {{ font-size:16px;font-weight:600;margin-top:2px }}
.headline-box {{ background:var(--info-bg);border-radius:10px;padding:14px 18px;margin-bottom:1.5rem }}
.headline-box .hl {{ font-size:14px;font-weight:500;color:var(--info) }}
.headline-box .pos {{ font-size:12px;color:var(--sec);margin-top:6px;line-height:1.5 }}
.alerts {{ display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1.5rem }}
.alert-tag {{ font-size:11px;padding:4px 10px;border-radius:6px;background:var(--danger-bg);color:var(--danger) }}
.scenario-row {{ display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:1.5rem }}
.sc {{ background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;cursor:pointer;transition:border-color .15s }}
.sc:hover {{ border-color:var(--info) }}
.sc-tag {{ display:inline-block;font-size:10px;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:5px;margin-bottom:6px }}
.sc h3 {{ font-size:14px;font-weight:600;margin-bottom:2px }}
.sc .prob {{ font-size:20px;font-weight:600 }}
.sc .dir {{ font-size:11px;margin-top:2px }}
.sc .signal {{ font-size:11px;color:var(--sec);margin-top:6px;line-height:1.4 }}
.elab-section {{ background:var(--card-alt);border-radius:10px;padding:18px;margin-bottom:1.5rem }}
.elab-section h3 {{ font-size:15px;font-weight:600;margin-bottom:10px }}
.elab-content {{ font-size:13px;color:var(--sec);line-height:1.7 }}
.elab-content p {{ margin-bottom:12px }}
.elab-content b {{ color:var(--text);font-weight:600 }}
.chart-box {{ background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:1.5rem }}
.chart-box h3 {{ font-size:13px;font-weight:600;margin-bottom:10px }}
footer {{ font-size:10px;color:var(--tert);margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border) }}
@media(max-width:600px) {{ .gauge-row,.scenario-row,.market-row {{ grid-template-columns:1fr }} }}
</style>
</head>
<body>
<div class="container">

<header>
  <h1>Pivot framework</h1>
  <p>Updated: {date}</p>
</header>
<div class="divider"></div>

<div class="section-label">Key readings</div>
<div class="gauge-row">
  <div class="gauge"><div class="gauge-label">Economic approval</div><div class="gauge-val" style="color:var(--danger)">{fmt_pct(r.get('econ_approval'), 0)}</div><div class="gauge-sub">Reuters/Ipsos</div></div>
  <div class="gauge"><div class="gauge-label">GOP approval</div><div class="gauge-val" style="color:var(--warning)">{fmt_pct(r.get('gop_approval'), 0)}</div><div class="gauge-sub">Reuters/Ipsos among Republicans</div></div>
  <div class="gauge"><div class="gauge-label">Generic ballot</div><div class="gauge-val" style="color:var(--danger)">{r.get('generic_ballot') or '&mdash;'}</div><div class="gauge-sub">2026 midterms</div></div>
</div>

<div class="section-label">Market context</div>
<div class="market-row">
  <div class="mkt"><div class="mkt-label">VIX</div><div class="mkt-val">{fmt_num(r.get('vix'), 1)}</div></div>
  <div class="mkt"><div class="mkt-label">Gold</div><div class="mkt-val">{fmt_money(r.get('gold'), 0)}</div></div>
  <div class="mkt"><div class="mkt-label">WTI crude</div><div class="mkt-val">{fmt_money(r.get('wti'), 2)}</div></div>
  <div class="mkt"><div class="mkt-label">Gas avg</div><div class="mkt-val">{fmt_money(r.get('gas_price'), 2)}</div></div>
</div>

<div class="section-label">Rates &amp; yield</div>
<div class="market-row">
  <div class="mkt"><div class="mkt-label">10Y yield</div><div class="mkt-val">{fmt_pct(r.get('yield_10y'), 2)}</div></div>
  <div class="mkt"><div class="mkt-label">2s10s</div><div class="mkt-val">{fmt_bp(r.get('spread_2s10s'))}</div></div>
  <div class="mkt"><div class="mkt-label">30Y yield</div><div class="mkt-val">{fmt_pct(r.get('yield_30y'), 2)}</div></div>
  <div class="mkt"><div class="mkt-label">ERP</div><div class="mkt-val">{fmt_pct(r.get('erp'), 2)}</div></div>
  <div class="mkt"><div class="mkt-label">Fed hike prob</div><div class="mkt-val">{fmt_prob(r.get('fed_hike_prob'))}</div></div>
</div>

{headline_html}

<div class="alerts">{alerts_html}</div>

<div class="divider"></div>

<div class="section-label">Scenario probabilities — click to expand</div>
<div class="scenario-row">{sc_cards_html}</div>

{elab_html}

<div class="section-label">Historical trend</div>
<div class="chart-box">
  <h3>Approval readings over time</h3>
  <canvas id="approvalChart" height="160"></canvas>
</div>
<div class="chart-box">
  <h3>Scenario probability over time</h3>
  <canvas id="scenarioChart" height="160"></canvas>
</div>
<div class="chart-box">
  <h3>10Y yield over time</h3>
  <canvas id="yieldChart" height="160"></canvas>
</div>
<div class="chart-box">
  <h3>Equity risk premium over time</h3>
  <canvas id="erpChart" height="160"></canvas>
</div>

<div class="divider"></div>
<div style="font-size:12px;color:var(--sec);line-height:1.5;margin-bottom:1rem">
  <b>Iran status:</b> {r.get('iran_status','')}
</div>
<div style="font-size:12px;color:var(--sec);line-height:1.5">
  <b>Notes:</b> {entry.get('notes','')}
</div>

<footer>
  Sources: Reuters/Ipsos, Silver Bulletin, Pew Research, RealClearPolling, Morning Consult, Wells Fargo, JP Morgan, Allianz. Not investment advice.
</footer>

</div>

<script>
function showElaboration(key) {{
  document.querySelectorAll('.elab-section').forEach(el => el.style.display = 'none');
  const el = document.getElementById('elab-' + key);
  if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
}}

const labels = {chart_labels};
if (labels.length > 1) {{
  new Chart(document.getElementById('approvalChart'), {{
    type: 'line',
    data: {{
      labels,
      datasets: [
        {{ label: 'Econ approval %', data: {chart_econ}, borderColor: '#B03030', borderWidth: 1.5, pointRadius: 3, tension: 0.3 }},
        {{ label: 'GOP approval %', data: {chart_gop}, borderColor: '#9A6B11', borderWidth: 1.5, pointRadius: 3, tension: 0.3 }}
      ]
    }},
    options: {{ responsive: true, plugins: {{ legend: {{ labels: {{ font: {{ family: "'DM Sans'" }} }} }} }},
      scales: {{ y: {{ beginAtZero: false }} }} }}
  }});
  new Chart(document.getElementById('scenarioChart'), {{
    type: 'line',
    data: {{
      labels,
      datasets: [
        {{ label: 'S1: No pivot', data: {chart_s1}, borderColor: '#B03030', borderWidth: 1.5, pointRadius: 3, tension: 0.3 }},
        {{ label: 'S2: Rollback', data: {chart_s2}, borderColor: '#2D5A9E', borderWidth: 1.5, pointRadius: 3, tension: 0.3 }},
        {{ label: 'S3: Oil trap', data: {chart_s3}, borderColor: '#9A6B11', borderWidth: 1.5, pointRadius: 3, tension: 0.3 }}
      ]
    }},
    options: {{ responsive: true, plugins: {{ legend: {{ labels: {{ font: {{ family: "'DM Sans'" }} }} }} }},
      scales: {{ y: {{ min: 0, max: 100, ticks: {{ callback: v => v + '%' }} }} }} }}
  }});
  new Chart(document.getElementById('yieldChart'), {{
    type: 'line',
    data: {{
      labels,
      datasets: [
        {{ label: '10Y yield %', data: {chart_y10}, borderColor: '#2D5A9E', borderWidth: 1.5, pointRadius: 3, tension: 0.3 }}
      ]
    }},
    options: {{ responsive: true, plugins: {{ legend: {{ labels: {{ font: {{ family: "'DM Sans'" }} }} }} }},
      scales: {{ y: {{ beginAtZero: false, ticks: {{ callback: v => v + '%' }} }} }} }}
  }});
  new Chart(document.getElementById('erpChart'), {{
    type: 'line',
    data: {{
      labels,
      datasets: [
        {{ label: 'ERP %', data: {chart_erp}, borderColor: '#9A6B11', borderWidth: 1.5, pointRadius: 3, tension: 0.3 }}
      ]
    }},
    options: {{ responsive: true, plugins: {{ legend: {{ labels: {{ font: {{ family: "'DM Sans'" }} }} }} }},
      scales: {{ y: {{ beginAtZero: false, ticks: {{ callback: v => v + '%' }} }} }} }}
  }});
}}
</script>
</body>
</html>"""
    return html


def generate_pdf(entry):
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.colors import HexColor
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_JUSTIFY
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
    except ImportError:
        print("reportlab not installed. Run: pip install reportlab --break-system-packages")
        return False

    r = recompute_derived_readings(entry.get("readings", {}))
    s = entry.get("scenario_probs", {})
    scenarios = entry.get("scenarios", {})
    alerts = entry.get("threshold_alerts", [])
    headline = entry.get("headline", "")
    positioning = entry.get("positioning_update", "")
    elaborations = entry.get("elaborations", {})
    date = entry.get("date", datetime.now().strftime("%Y-%m-%d"))

    C = {
        "border": HexColor('#E2DFD6'), "text": HexColor('#1A1A18'), "sec": HexColor('#6B6960'),
        "tert": HexColor('#9C9A8F'), "card": HexColor('#F3F1EC'), "danger": HexColor('#B03030'),
        "warning": HexColor('#9A6B11'), "success": HexColor('#2D7A3A'), "info": HexColor('#2D5A9E'),
        "white": HexColor('#FFFFFF'), "head_bg": HexColor('#EDEBE4'),
    }

    doc = SimpleDocTemplate(str(PDF_OUT), pagesize=letter,
        topMargin=0.75*inch, bottomMargin=0.75*inch, leftMargin=0.85*inch, rightMargin=0.85*inch)
    W = letter[0] - 1.7*inch
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle('T2', fontSize=22, leading=26, spaceAfter=6, textColor=C["text"], fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle('SL', fontSize=9, leading=12, textColor=C["tert"], fontName='Helvetica-Bold', spaceAfter=8, spaceBefore=14))
    styles.add(ParagraphStyle('H2s', fontSize=16, leading=20, textColor=C["text"], fontName='Helvetica-Bold', spaceAfter=10, spaceBefore=4))
    styles.add(ParagraphStyle('H3s', fontSize=12, leading=16, textColor=C["text"], fontName='Helvetica-Bold', spaceAfter=6, spaceBefore=10))
    styles.add(ParagraphStyle('B', fontSize=10, leading=15, textColor=C["sec"], alignment=TA_JUSTIFY, spaceAfter=8))
    styles.add(ParagraphStyle('Sm', fontSize=8.5, leading=12, textColor=C["tert"], spaceAfter=4))
    styles.add(ParagraphStyle('CT', fontSize=10, leading=13, textColor=C["text"], fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle('CB', fontSize=9, leading=13, textColor=C["sec"]))

    def hr():
        return HRFlowable(width="100%", thickness=0.5, color=C["border"], spaceAfter=12, spaceBefore=12)

    story = []
    cw3 = [W/3]*3

    # Title
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph(f"PIVOT FRAMEWORK REPORT — {date}", styles['SL']))
    story.append(Paragraph("Trump Economic Approval<br/>→ Policy Pivot Framework", styles['T2']))
    story.append(hr())

    # Gauges table
    gd = [
        [Paragraph("<b>Economic Approval</b>", styles['CT']), Paragraph("<b>GOP Approval</b>", styles['CT']), Paragraph("<b>Generic Ballot</b>", styles['CT'])],
        [Paragraph(f"<font color='#B03030' size='16'><b>{fmt_pct(r.get('econ_approval'), 0)}</b></font>", styles['CB']),
         Paragraph(f"<font color='#9A6B11' size='16'><b>{fmt_pct(r.get('gop_approval'), 0)}</b></font>", styles['CB']),
         Paragraph(f"<font color='#B03030' size='16'><b>{r.get('generic_ballot') or '&mdash;'}</b></font>", styles['CB'])],
    ]
    gt = Table(gd, colWidths=cw3)
    gt.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),C["head_bg"]),('BACKGROUND',(0,1),(-1,-1),C["card"]),
        ('BOX',(0,0),(-1,-1),0.5,C["border"]),('INNERGRID',(0,0),(-1,-1),0.5,C["border"]),
        ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),
        ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('VALIGN',(0,0),(-1,-1),'TOP'),
    ]))
    story.append(gt)
    story.append(Spacer(1, 10))

    # Market context
    story.append(Paragraph(
        f"<b>Market context:</b> VIX {fmt_num(r.get('vix'), 1)} | Gold {fmt_money(r.get('gold'), 0)} | WTI {fmt_money(r.get('wti'), 2)} | Brent {fmt_money(r.get('brent'), 2)} | Gas {fmt_money(r.get('gas_price'), 2)}",
        styles['B']))
    story.append(Paragraph(
        f"<b>Rates &amp; yield:</b> 10Y {fmt_pct(r.get('yield_10y'), 2)} | 2s10s {fmt_bp(r.get('spread_2s10s'))} | 30Y {fmt_pct(r.get('yield_30y'), 2)} | ERP {fmt_pct(r.get('erp'), 2)} | Fed hike probability {fmt_prob(r.get('fed_hike_prob'))}",
        styles['B']))

    # Headline
    if headline:
        story.append(hr())
        story.append(Paragraph(f"<b>This week:</b> {headline}", styles['B']))
        if positioning:
            story.append(Paragraph(f"<b>Positioning update:</b> {positioning}", styles['B']))

    # Alerts
    if alerts:
        story.append(hr())
        story.append(Paragraph("THRESHOLD ALERTS", styles['SL']))
        for a in alerts:
            story.append(Paragraph(f"• {a}", styles['B']))

    # Scenario probabilities
    story.append(hr())
    story.append(Paragraph("SCENARIO PROBABILITIES", styles['SL']))

    sc_configs = [
        ("s1", "s1_no_pivot", "No pivot", "#B03030"),
        ("s2", "s2_tariff_rollback", "Tariff rollback (base case)", "#2D5A9E"),
        ("s3", "s3_oil_trap", "Oil trap", "#9A6B11"),
    ]
    for key, prob_key, name, color in sc_configs:
        prob = get_scenario_prob(entry, key)
        sc_detail = scenarios.get(key, {})
        direction = sc_detail.get("direction", "stable")
        signal = sc_detail.get("key_signal", "")
        story.append(Paragraph(
            f"<font color='{color}'><b>{name}: {fmt_prob(prob)}</b></font> ({direction}) — {signal}",
            styles['B']))

    # Elaborations
    elab_titles = {"s1": "Scenario 1: No Pivot — Stagflation Lock-in",
                   "s2": "Scenario 2: GOP Defections → Tariff Rollback",
                   "s3": "Scenario 3: Oil Drop → Approval Bounce → No Pivot"}

    for key in ["s1", "s2", "s3"]:
        content = elaborations.get(key, "")
        if content:
            story.append(PageBreak())
            story.append(Paragraph(elab_titles.get(key, key).upper(), styles['SL']))
            story.append(Paragraph(elab_titles.get(key, key), styles['H2s']))
            # Content is HTML-formatted with <p> tags
            # Extract paragraphs: split on </p> boundaries, strip tags for clean text
            import re
            # Split on <p> tags to get individual paragraphs
            paragraphs = re.split(r'</?p\s*/?>', content)
            for para in paragraphs:
                para = para.strip()
                if para:
                    # ReportLab's Paragraph supports <b> tags natively, so keep them
                    # But strip any other HTML tags that ReportLab can't handle
                    para = re.sub(r'<(?!/?b(?:\s|>|/))[^>]+>', '', para)
                    try:
                        story.append(Paragraph(para, styles['B']))
                    except Exception:
                        # Fallback: strip all tags if rendering fails
                        clean = re.sub(r'<[^>]+>', '', para)
                        if clean.strip():
                            story.append(Paragraph(clean, styles['B']))

    # Notes
    story.append(hr())
    notes = entry.get("notes", "")
    if notes:
        story.append(Paragraph(f"<b>Notes:</b> {notes}", styles['Sm']))
    iran = r.get("iran_status", "")
    if iran:
        story.append(Paragraph(f"<b>Iran status:</b> {iran}", styles['Sm']))

    story.append(Spacer(1, 16))
    story.append(Paragraph(
        f"Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}. Sources: Reuters/Ipsos, Silver Bulletin, Pew, RCP, "
        "Morning Consult, WF, JPM, Allianz. Not investment advice.", styles['Sm']))

    doc.build(story)
    return True


def main():
    entry = load_latest()
    date = entry.get("date", "unknown")

    print(f"Generating reports for {date}...")

    # HTML
    html = generate_html(entry)
    with open(HTML_OUT, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  HTML → {HTML_OUT}")

    # PDF
    if generate_pdf(entry):
        print(f"  PDF  → {PDF_OUT}")
    else:
        print("  PDF  → SKIPPED (reportlab not available)")

    print("Done.")


if __name__ == "__main__":
    main()
