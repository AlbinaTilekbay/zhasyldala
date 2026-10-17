"""Report building shared by the owner's report screen, the disease
spread history, the public share link, and the report PDF."""
import io

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from apps.greenhouses.pdf import fonts

from .models import ScanSession, SectorCapture

KK_MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"]


def kk_date(dt):
    return f"{dt.day} {KK_MONTHS[dt.month - 1]} {dt.year}" if dt else ""


def capture_diagnosis(capture):
    if capture is None:
        return None
    request_obj = getattr(capture, "diagnosis_request", None)
    return getattr(request_obj, "result", None) if request_obj else None


def diagnosis_tag(diagnosis):
    """ok / warn / bad from the diagnosis; "unknown" when nothing actually
    analysed the photos (source "rule": no OpenAI key / no internet, no
    trained model) so it never passes as a healthy sector."""
    if diagnosis is None:
        return None
    if diagnosis.source == "rule":
        return "unknown"
    return diagnosis.severity


def diagnosis_name(diagnosis):
    if diagnosis is None:
        return None
    if diagnosis.disease:
        return diagnosis.disease.name
    return (diagnosis.ai_narrative or {}).get("condition_name")


def session_report(session):
    """Every sector of the greenhouse, row by row, tagged by its diagnosis
    in this session (or "unscanned")."""
    captures = {
        c.sector_id: c
        for c in session.captures.select_related("sector", "diagnosis_request__result__disease")
    }
    rows, current_row, row_cells = [], None, []
    counts = {"ok": 0, "warn": 0, "bad": 0, "unscanned": 0, "unknown": 0}
    greenhouse = session.greenhouse
    for sector in greenhouse.sectors.order_by("row", "col"):
        diagnosis = capture_diagnosis(captures.get(sector.id))
        tag = diagnosis_tag(diagnosis) or "unscanned"
        counts[tag] += 1
        cell = {
            "sector_id": sector.id, "label": sector.label, "plants": sector.plant_count, "tag": tag,
            "diagnosis_disease": diagnosis_name(diagnosis),
            "confidence": diagnosis.confidence if diagnosis else None,
        }
        if sector.row != current_row:
            if row_cells:
                rows.append(row_cells)
            row_cells, current_row = [], sector.row
        row_cells.append(cell)
    if row_cells:
        rows.append(row_cells)
    return {
        "session_id": session.id,
        "status": session.status,
        "started_at": session.started_at,
        "greenhouse_name": greenhouse.name,
        "crop_name": greenhouse.crop.name if greenhouse.crop else None,
        "total_sectors": greenhouse.sectors.count(),
        "scanned_count": session.scanned_count,
        "counts": counts,
        "rows": rows,
    }


def greenhouse_history(greenhouse, limit=12):
    """Oldest-first list of finished walkthroughs with each sector's tag —
    drives the "how the disease spread" timeline. Sectors not scanned in
    a given week are simply absent from that week's `tags`."""
    sessions = list(
        ScanSession.objects.filter(greenhouse=greenhouse, status=ScanSession.Status.DONE).order_by("-started_at")[:limit]
    )
    out = []
    for session in reversed(sessions):
        tags = {}
        for capture in session.captures.select_related("diagnosis_request__result"):
            tag = diagnosis_tag(capture_diagnosis(capture))
            if tag:
                tags[str(capture.sector_id)] = tag
        out.append({"session_id": session.id, "started_at": session.started_at, "tags": tags})
    return out


def previous_capture(session, sector):
    """The same sector's capture from the most recent earlier finished
    walkthrough — the "дейін" half of the before/after comparison."""
    return (
        SectorCapture.objects.filter(
            sector=sector, session__status=ScanSession.Status.DONE, session__started_at__lt=session.started_at,
        )
        .exclude(session=session)
        .select_related("session")
        .prefetch_related("photos")
        .order_by("-session__started_at")
        .first()
    )


FILL = {"ok": "#E6F2F0", "warn": "#FBF2DE", "bad": "#F7DED7", "unknown": "#EDEFEE", "unscanned": "#FFFFFF"}
STROKE = {"ok": "#0F766E", "warn": "#B07A12", "bad": "#B4402E", "unknown": "#9AA5A2", "unscanned": "#C9D6D2"}
LABEL = {"ok": "қалыпты", "warn": "қауіп", "bad": "ауру", "unknown": "анықталмады", "unscanned": "түсірілмеген"}


def report_pdf(session):
    """One-page A4 report: header, counts, the sector map, and the list of
    problem sectors — what an agronomist needs at a glance."""
    data = session_report(session)
    regular, bold = fonts()
    ink, mute = HexColor("#14201E"), HexColor("#6B7A76")
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    x0, y = 18 * mm, height - 22 * mm

    c.setFillColor(HexColor("#0F766E"))
    c.setFont(bold, 11)
    c.drawString(x0, y + 6 * mm, "ZhasylDala · жылыжай есебі")
    c.setFillColor(ink)
    c.setFont(bold, 22)
    c.drawString(x0, y - 4 * mm, data["greenhouse_name"])
    c.setFont(regular, 11)
    c.setFillColor(mute)
    crop = f" · {data['crop_name']}" if data["crop_name"] else ""
    c.drawString(x0, y - 11 * mm, f"Шолу: {kk_date(session.started_at)}{crop} · {data['scanned_count']}/{data['total_sectors']} сектор тексерілді")

    y -= 24 * mm
    for i, key in enumerate(["ok", "warn", "bad", "unknown", "unscanned"]):
        if key in ("unknown", "unscanned") and not data["counts"][key]:
            continue
        c.setFillColor(HexColor(STROKE[key]))
        c.setFont(bold, 18)
        c.drawString(x0 + i * 32 * mm, y, str(data["counts"][key]))
        c.setFillColor(mute)
        c.setFont(regular, 9)
        c.drawString(x0 + i * 32 * mm, y - 5 * mm, LABEL[key])

    y -= 14 * mm
    widest = max((len(r) for r in data["rows"]), default=1)
    cell = min(22 * mm, (width - 2 * x0 - 8 * mm) / widest)
    for row in data["rows"]:
        c.setFillColor(mute)
        c.setFont(regular, 9)
        c.drawString(x0, y - cell / 2 - 1.5 * mm, row[0]["label"].rstrip("0123456789"))
        for j, cellinfo in enumerate(row):
            cx = x0 + 8 * mm + j * cell
            c.setFillColor(HexColor(FILL[cellinfo["tag"]]))
            c.setStrokeColor(HexColor(STROKE[cellinfo["tag"]]))
            c.roundRect(cx + 1, y - cell + 1, cell - 2, cell - 2, 3, fill=1, stroke=1)
            c.setFillColor(HexColor(STROKE[cellinfo["tag"]]))
            c.setFont(bold, 9)
            c.drawCentredString(cx + cell / 2, y - cell / 2 - 1.5 * mm, cellinfo["label"])
        y -= cell
        if y < 70 * mm:
            break

    findings = [cl for r in data["rows"] for cl in r if cl["tag"] in ("bad", "warn")]
    y -= 10 * mm
    c.setFillColor(ink)
    c.setFont(bold, 13)
    c.drawString(x0, y, "Назар аударатын секторлар" if findings else "Ауру табылмады")
    y -= 7 * mm
    for cl in findings:
        if y < 20 * mm:
            c.showPage()
            y = height - 20 * mm
        c.setFillColor(HexColor(STROKE[cl["tag"]]))
        c.setFont(bold, 11)
        c.drawString(x0, y, cl["label"])
        c.setFillColor(ink)
        c.setFont(regular, 11)
        conf = f" · {round(cl['confidence'] * 100)}%" if cl["confidence"] else ""
        c.drawString(x0 + 14 * mm, y, f"{cl['diagnosis_disease'] or LABEL[cl['tag']]} ({LABEL[cl['tag']]}{conf}) · {cl['plants']} түп")
        y -= 6.5 * mm
    c.setFillColor(mute)
    c.setFont(regular, 8)
    c.drawString(x0, 12 * mm, "Диагнозды ИИ жасады — шешім қабылдамас бұрын агрономмен ақылдасыңыз.")
    c.save()
    buf.seek(0)
    return buf.read()
