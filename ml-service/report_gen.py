import io
import base64
import time
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.units import inch


def generate_pdf(data, summary):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        leftMargin=inch,
        rightMargin=inch
    )
    styles = getSampleStyleSheet()
    elems = []

    case_ref = f"FA-{int(time.time())}"
    verdict = data.get('label', 'UNKNOWN')
    score = data.get('score', 0)
    confidence = data.get('confidence', 0)
    media = data.get('mediaType', 'image')

    # risk level
    if score >= 70:
        risk = 'CRITICAL'
        risk_color = colors.HexColor('#dc2626')
    elif score >= 50:
        risk = 'HIGH'
        risk_color = colors.HexColor('#ea580c')
    elif score >= 35:
        risk = 'MEDIUM'
        risk_color = colors.HexColor('#d97706')
    else:
        risk = 'LOW'
        risk_color = colors.HexColor('#16a34a')

    verdict_color = colors.HexColor('#ef4444') if verdict == 'MANIPULATED' else \
                    colors.HexColor('#f59e0b') if verdict == 'SUSPICIOUS' else \
                    colors.HexColor('#22c55e')

    # ══════════════════════════════════════════════════
    #  HEADER
    # ══════════════════════════════════════════════════
    elems.append(Paragraph("FORENSIC ANALYSIS REPORT", styles['Title']))
    elems.append(Paragraph("ForensicAI DeepScan | CHAK36-CS-05 | AI-Based Deepfake Detection", styles['Normal']))
    elems.append(Spacer(1, 0.1 * inch))
    elems.append(HRFlowable(width='100%', thickness=2, color=colors.HexColor('#1e293b')))
    elems.append(Spacer(1, 0.15 * inch))
    elems.append(Paragraph(f"<b>Case Reference:</b> {case_ref}", styles['Normal']))
    elems.append(Paragraph(f"<b>Generated:</b> {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}", styles['Normal']))
    elems.append(Paragraph(f"<b>File Hash (SHA-256):</b> {data.get('fileHash', 'N/A')}", styles['Normal']))
    elems.append(Spacer(1, 0.25 * inch))

    # ══════════════════════════════════════════════════
    #  SECTION 1: AUTHENTICITY ASSESSMENT
    # ══════════════════════════════════════════════════
    elems.append(Paragraph("1. AUTHENTICITY ASSESSMENT", styles['Heading2']))
    elems.append(Spacer(1, 0.08 * inch))

    assess_data = [
        ['Parameter', 'Result'],
        ['Verdict', verdict],
        ['Confidence', f"{confidence}%"],
        ['Manipulation Score', f"{score}%"],
        ['Risk Level', risk],
        ['Media Type', str(media).upper()],
    ]

    t = Table(assess_data, colWidths=[2.5 * inch, 4 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        # verdict row color
        ('TEXTCOLOR', (1, 1), (1, 1), verdict_color),
        ('FONTNAME', (1, 1), (1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (1, 1), (1, 1), 13),
        # risk level color
        ('TEXTCOLOR', (1, 4), (1, 4), risk_color),
        ('FONTNAME', (1, 4), (1, 4), 'Helvetica-Bold'),
        ('FONTSIZE', (1, 4), (1, 4), 12),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 0.25 * inch))

    # ══════════════════════════════════════════════════
    #  SECTION 2: DETECTED INDICATORS
    # ══════════════════════════════════════════════════
    elems.append(Paragraph("2. DETECTED INDICATORS", styles['Heading2']))
    elems.append(Spacer(1, 0.08 * inch))

    indicators = []
    model_score = data.get('modelScore')
    if model_score is not None:
        if model_score > 50:
            indicators.append('AI-generation probability HIGH')
        elif model_score > 25:
            indicators.append('AI-generation probability MODERATE')
        else:
            indicators.append('AI-generation probability LOW')

    ela = data.get('elaAdvanced', 0)
    if ela > 40:
        indicators.append('ELA irregularity detected')

    freq = data.get('freqScore', 0)
    if freq > 40:
        indicators.append('Frequency spectrum anomaly detected')

    noise = data.get('noiseScore', 0)
    if noise > 40:
        indicators.append('Synthetic noise pattern detected')
    elif noise > 20:
        indicators.append('Noise consistency anomaly')

    ghost = data.get('ghostScore', 0)
    if ghost > 30:
        indicators.append('Compression anomaly detected')

    gradient = data.get('gradientScore', 0)
    if gradient > 30:
        indicators.append('Gradient smoothing detected')

    ca = data.get('caScore', 0)
    if ca > 25:
        indicators.append('No chromatic aberration (AI signature)')

    qt_origin = data.get('qtOrigin', '')
    if qt_origin == 'library':
        indicators.append('Library-encoded JPEG (non-camera source)')
    elif qt_origin == 'camera':
        indicators.append('Camera-proprietary JPEG encoding confirmed')

    exif_label = data.get('exifLabel', '')
    if exif_label == 'AI_TOOL':
        indicators.append('AI generation tool identified in metadata')
    elif exif_label == 'EDITED':
        indicators.append('Editing software detected in metadata')
    elif exif_label == 'CLEAN' and data.get('exifScore', 99) == 0:
        indicators.append('Valid camera EXIF metadata present')

    exif_flags = data.get('exifFlags', [])
    if any('no camera' in f for f in exif_flags):
        indicators.append('Camera metadata missing')

    if not indicators:
        indicators.append('No significant anomalies detected')

    for ind in indicators:
        bullet_color = colors.HexColor('#ef4444') if any(w in ind.upper() for w in ['HIGH', 'ANOMALY', 'DETECTED', 'SYNTHETIC', 'AI ', 'MISSING', 'LIBRARY']) else \
                       colors.HexColor('#22c55e') if any(w in ind.upper() for w in ['CAMERA', 'VALID', 'LOW', 'NO SIGNIFICANT']) else \
                       colors.HexColor('#f59e0b')
        elems.append(Paragraph(
            f'<font color="{bullet_color.hexval()}">&#8226;</font>  {ind}',
            styles['Normal']
        ))
        elems.append(Spacer(1, 0.04 * inch))

    elems.append(Spacer(1, 0.2 * inch))

    # ══════════════════════════════════════════════════
    #  SECTION 3: SYSTEM SIGNALS (Multi-Signal Matrix)
    # ══════════════════════════════════════════════════
    elems.append(Paragraph("3. SYSTEM SIGNALS — MULTI-SIGNAL DETECTION MATRIX", styles['Heading2']))
    elems.append(Spacer(1, 0.08 * inch))

    signal_rows = [['Signal', 'Score', 'Status']]

    signals = [
        ('Deepfake AI Model', data.get('modelScore')),
        ('ELA Anomaly', data.get('elaAdvanced')),
        ('Frequency Spectrum', data.get('freqScore')),
        ('Noise Consistency', data.get('noiseScore')),
        ('Compression Pattern', data.get('ghostScore')),
        ('Gradient Analysis', data.get('gradientScore')),
        ('Chromatic Aberration', data.get('caScore')),
        ('Quantization Forensics', data.get('qtScore')),
        ('Metadata Risk', data.get('exifScore')),
        ('Pixel Statistics', data.get('pixelScore')),
    ]

    for name, val in signals:
        v = val if val is not None else 0
        status = 'ALERT' if v > 50 else 'WARNING' if v > 25 else 'NORMAL'
        signal_rows.append([name, f'{v:.0f}', status])

    signal_rows.append(['FINAL AUTHENTICITY SCORE', f'{score:.1f}', verdict])

    st = Table(signal_rows, colWidths=[3 * inch, 1.5 * inch, 2 * inch])

    # build style commands
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f8fafc')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        # final row
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.white),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 11),
    ]

    # color status cells
    for i in range(1, len(signal_rows) - 1):
        val = signals[i-1][1] or 0
        c = colors.HexColor('#dc2626') if val > 50 else colors.HexColor('#d97706') if val > 25 else colors.HexColor('#16a34a')
        style_cmds.append(('TEXTCOLOR', (2, i), (2, i), c))
        style_cmds.append(('FONTNAME', (2, i), (2, i), 'Helvetica-Bold'))

    st.setStyle(TableStyle(style_cmds))
    elems.append(st)
    elems.append(Spacer(1, 0.25 * inch))

    # ══════════════════════════════════════════════════
    #  SECTION 4: ENGINE VERDICTS
    # ══════════════════════════════════════════════════
    explanation = data.get('explanation', {})
    ev = explanation.get('engineVerdicts', {})

    if ev:
        elems.append(Paragraph("4. CROSS-EXAMINATION ENGINE VERDICTS", styles['Heading2']))
        elems.append(Spacer(1, 0.08 * inch))

        eng_data = [
            ['Engine', 'Type', 'Verdict'],
            ['Engine 1', 'Neural Fingerprint (AI Model Ensemble)', ev.get('neural', 'unknown').upper()],
            ['Engine 2', 'Physics Validator (Forensic Algorithms)', ev.get('physics', 'unknown').upper()],
            ['Engine 3', 'Provenance Tracker (Metadata + Source)', ev.get('provenance', 'unknown').upper()],
        ]

        et = Table(eng_data, colWidths=[1.5 * inch, 3 * inch, 2 * inch])
        eng_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]

        for i, key in enumerate(['neural', 'physics', 'provenance'], 1):
            v = ev.get(key, 'unknown')
            c = colors.HexColor('#dc2626') if v == 'fake' else \
                colors.HexColor('#d97706') if v == 'suspicious' else \
                colors.HexColor('#16a34a') if v == 'authentic' else colors.grey
            eng_style.append(('TEXTCOLOR', (2, i), (2, i), c))

        et.setStyle(TableStyle(eng_style))
        elems.append(et)
        elems.append(Spacer(1, 0.2 * inch))

    # ══════════════════════════════════════════════════
    #  SECTION 5: ANALYSIS SUMMARY
    # ══════════════════════════════════════════════════
    section_num = 5 if ev else 4
    elems.append(Paragraph(f"{section_num}. ANALYSIS SUMMARY", styles['Heading2']))
    elems.append(Spacer(1, 0.08 * inch))

    # conclusion
    conclusion = explanation.get('conclusion', '')
    if conclusion:
        conclusion_style = ParagraphStyle(
            'conclusion', parent=styles['Normal'],
            fontSize=11, leading=16, textColor=colors.HexColor('#1e293b'),
            borderPadding=(8, 8, 8, 8), backColor=colors.HexColor('#f0f9ff'),
            borderColor=colors.HexColor('#3b82f6'), borderWidth=0,
        )
        elems.append(Paragraph(f"<b>Conclusion:</b> {conclusion}", conclusion_style))
        elems.append(Spacer(1, 0.12 * inch))

    # LLM summary
    for line in summary.split('\n'):
        line = line.strip()
        if not line:
            elems.append(Spacer(1, 0.04 * inch))
            continue
        if line[0].isdigit() and '.' in line[:3]:
            elems.append(Spacer(1, 0.06 * inch))
            elems.append(Paragraph(f'<b>{line}</b>', styles['Normal']))
        else:
            elems.append(Paragraph(line, styles['Normal']))
        elems.append(Spacer(1, 0.02 * inch))

    elems.append(Spacer(1, 0.25 * inch))

    # ══════════════════════════════════════════════════
    #  SECTION 6: CHAIN OF CUSTODY
    # ══════════════════════════════════════════════════
    section_num += 1
    elems.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#e2e8f0')))
    elems.append(Spacer(1, 0.1 * inch))
    elems.append(Paragraph(f"{section_num}. CHAIN OF CUSTODY", styles['Heading2']))
    elems.append(Spacer(1, 0.08 * inch))

    chain_data = [
        ['Parameter', 'Value'],
        ['SHA-256 File Hash', data.get('fileHash', 'N/A')],
        ['Case Reference', case_ref],
        ['Analysis Timestamp', time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())],
        ['Media Type', str(media).upper()],
        ['IT Act 65B Status', 'Auto-generated — requires expert certification for legal use'],
    ]

    ct = Table(chain_data, colWidths=[2 * inch, 4.5 * inch])
    ct.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elems.append(ct)

    elems.append(Spacer(1, 0.3 * inch))
    elems.append(HRFlowable(width='100%', thickness=0.5, color=colors.grey))
    elems.append(Spacer(1, 0.1 * inch))

    footer_style = styles['Normal'].clone('footer')
    footer_style.fontSize = 8
    footer_style.textColor = colors.grey
    elems.append(Paragraph(
        f"Generated by ForensicAI DeepScan — CHAK36-CS-05 | Multi-Signal Deepfake Detection System | "
        f"For legal use, certify under IT Act Section 65B. | {case_ref}",
        footer_style
    ))

    doc.build(elems)
    pdf_b64 = base64.b64encode(buf.getvalue()).decode()
    return pdf_b64, case_ref
