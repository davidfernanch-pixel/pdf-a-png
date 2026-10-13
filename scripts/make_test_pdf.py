#!/usr/bin/env python3
"""Create a small test PDF with 3 pages."""
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import os

output = '/home/z/my-project/test.pdf'
c = canvas.Canvas(output, pagesize=A4)
width, height = A4

pages_content = [
    ("Pagina 1 - Hola", "Esta es la primera pagina del PDF de prueba."),
    ("Pagina 2 - Mundo", "Segunda pagina con contenido distinto."),
    ("Pagina 3 - Final", "Tercera y ultima pagina del documento."),
]

for title, body in pages_content:
    c.setFont("Helvetica-Bold", 36)
    c.setFillColorRGB(0.1, 0.5, 0.2)
    c.drawString(80, height - 120, title)

    c.setFont("Helvetica", 14)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.drawString(80, height - 160, body)

    c.setFillColorRGB(0.93, 0.93, 0.93)
    c.rect(80, height - 400, width - 160, 200, fill=1, stroke=0)

    c.setFillColorRGB(0.93, 0.31, 0.18)
    c.circle(width / 2, height - 500, 40, fill=1, stroke=0)

    c.showPage()

c.save()
print(f"Test PDF saved to {output}")
print(f"Size: {os.path.getsize(output)} bytes")
