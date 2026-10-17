"""PDF helpers for the printable QR sheets.

reportlab's built-in Helvetica has no Cyrillic at all, so every Kazakh
label used to print as black boxes. These helpers register a TTF that
covers Kazakh (ә ғ қ ң ө ұ ү һ і) — DejaVu Sans in the Docker images
(fonts-dejavu-core), the macOS system Arial Unicode for local dev — and
only fall back to Helvetica if neither exists.
"""
import io
import os

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

FONT_CANDIDATES = [
    ("ZD", "ZD-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("ZD", "ZD-Bold", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
]

INK, ACCENT, MUTE, RULE = HexColor("#14201E"), HexColor("#0F766E"), HexColor("#6B7A76"), HexColor("#C9D6D2")


def fonts():
    """Returns (regular, bold) font names, registering a Kazakh-capable
    TTF on first use."""
    if "ZD" in pdfmetrics.getRegisteredFontNames():
        return "ZD", "ZD-Bold"
    for regular, bold, regular_path, bold_path in FONT_CANDIDATES:
        if os.path.exists(regular_path) and os.path.exists(bold_path):
            pdfmetrics.registerFont(TTFont(regular, regular_path))
            pdfmetrics.registerFont(TTFont(bold, bold_path))
            return regular, bold
    return "Helvetica", "Helvetica-Bold"


def qr_image(data):
    q = qrcode.QRCode(error_correction=ERROR_CORRECT_H, border=2, box_size=20)
    q.add_data(data)
    q.make(fit=True)
    buf = io.BytesIO()
    q.make_image(fill_color="#14201E", back_color="white").save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def row_labels_pdf(row_count, greenhouse_name=""):
    """One A4 page per greenhouse row: a big "N-қатар" heading and a QR
    encoding `zhasyldala://row/N`. Row labels aren't tied to any sector
    token, so they stay valid when the grid is regenerated (the scan
    screen resolves them against the farmer's greenhouse at scan time)."""
    regular, bold = fonts()
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    for n in range(1, row_count + 1):
        c.setFillColor(ACCENT)
        c.rect(0, height - 14 * mm, width, 14 * mm, fill=1, stroke=0)
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFont(bold, 12)
        c.drawString(18 * mm, height - 9.5 * mm, "ZhasylDala")
        if greenhouse_name:
            c.setFont(regular, 11)
            c.drawRightString(width - 18 * mm, height - 9.5 * mm, greenhouse_name)
        c.setFillColor(INK)
        c.setFont(bold, 64)
        c.drawCentredString(width / 2, height - 52 * mm, f"{n}-қатар")
        size = 140 * mm
        c.drawImage(qr_image(f"zhasyldala://row/{n}"), (width - size) / 2, height - 62 * mm - size, size, size)
        c.setFillColor(MUTE)
        c.setFont(regular, 13)
        c.drawCentredString(width / 2, 52 * mm, "Қатарды тексеру үшін ZhasylDala қосымшасында")
        c.drawCentredString(width / 2, 45 * mm, "«Шолу» бөлімін ашып, осы белгіні сканерлеңіз")
        c.setStrokeColor(RULE)
        c.setDash(3, 3)
        c.rect(10 * mm, 10 * mm, width - 20 * mm, height - 30 * mm)
        c.setDash()
        c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()
