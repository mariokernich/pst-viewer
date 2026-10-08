#!/usr/bin/env python3
"""Creates a fictional demo mailbox for tests, app screenshots and store listings.

    tools/demo-data/make-demo-archive.py [--lang de|en] [output directory]

Writes "Demo-Postfach.mbox" ("Demo-Mailbox.mbox" in English) (Google Takeout style with labels, read/starred
state, HTML mails, inline images and PDF, PNG, ICS, VCF, CSV and EML
attachments; dates relative to today) and a folder "Demo-Ordner" with .eml
files ("Demo-Folder"). All people, companies and addresses are made up.
"""

import datetime as dt
import email.utils
import struct
import sys
import zlib
from email.message import EmailMessage
from email.policy import SMTP
from pathlib import Path

ARGS = sys.argv[1:]
LANG = "de"
if ARGS[:1] == ["--lang"] and len(ARGS) > 1:
    LANG, ARGS = ARGS[1], ARGS[2:]
if LANG not in ("de", "en"):
    sys.exit("--lang must be de or en")
OUT = Path(ARGS[0] if ARGS else "demo-archive")
ME = ("Mario Beispiel", "mario@beispiel-mail.de") if LANG == "de" else ("Alex Morgan", "alex@example-mail.com")
NOW = dt.datetime.now().astimezone().replace(second=0, microsecond=0)

PEOPLE = {
    "anna": ("Anna Becker", "anna.becker@nordwind-design.de"),
    "jonas": ("Jonas Weber", "j.weber@weber-it.de"),
    "lena": ("Lena Hoffmann", "lena.hoffmann@stadtwerke-musterstadt.de"),
    "tim": ("Tim Schröder", "tim@schroeder-messebau.de"),
    "sara": ("Sara Yilmaz", "s.yilmaz@kanzlei-yilmaz.de"),
    "felix": ("Felix Wagner", "felix.wagner@beispiel-mail.de"),
    "news": ("Fachmagazin Digital", "newsletter@fachmagazin-digital.de"),
    "bank": ("Muster Bank", "service@musterbank.example"),
    "julia": ("Julia Neumann", "julia.neumann@nordwind-design.de"),
}

PEOPLE_EN = {
    "anna": ("Emma Clarke", "emma.clarke@northwind-design.example"),
    "jonas": ("Daniel Brooks", "d.brooks@brooks-it.example"),
    "lena": ("Olivia Hughes", "olivia.hughes@riverton-utilities.example"),
    "tim": ("Ryan Foster", "ryan@foster-exhibits.example"),
    "sara": ("Priya Shah", "p.shah@shah-legal.example"),
    "felix": ("Lucas Bennett", "lucas.bennett@example-mail.com"),
    "news": ("Digital Business Weekly", "newsletter@digital-business-weekly.example"),
    "bank": ("Sample Bank", "service@samplebank.example"),
    "julia": ("Sophie Turner", "sophie.turner@northwind-design.example"),
}


# -----------------------------------------------------------------------------
# Attachments


def pdf(title: str, lines: list[str]) -> bytes:
    """A small but valid one-page PDF with text (Helvetica, A4)."""
    text = ["BT", "/F1 20 Tf", "60 770 Td", f"({escape_pdf(title)}) Tj", "/F1 11 Tf"]
    for line in lines:
        text += ["0 -22 Td", f"({escape_pdf(line)}) Tj"]
    text.append("ET")
    stream = "\n".join(text).encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for number, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for offset in offsets:
        out += b"%010d 00000 n \n" % offset
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


def escape_pdf(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def png(width: int, height: int, top: tuple, bottom: tuple) -> bytes:
    """A vertical gradient PNG."""
    rows = []
    for y in range(height):
        t = y / max(1, height - 1)
        color = bytes(int(a + (b - a) * t) for a, b in zip(top, bottom))
        rows.append(b"\x00" + color * width)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")


def mockup(width: int = 560, height: int = 340) -> bytes:
    """A simple wireframe of a web page (navigation, hero, three cards) as PNG."""
    bg, line, soft, accent, accent2 = (246, 247, 250), (222, 225, 232), (233, 236, 242), (74, 92, 255), (122, 92, 255)
    pixels = [[bg] * width for _ in range(height)]

    def rect(x0, y0, x1, y1, color):
        for y in range(max(0, y0), min(height, y1)):
            row = pixels[y]
            for x in range(max(0, x0), min(width, x1)):
                row[x] = color(x, y) if callable(color) else color

    rect(0, 0, width, 44, (255, 255, 255))
    rect(0, 44, width, 45, line)
    rect(24, 16, 44, 30, accent)
    for i, w in enumerate((46, 58, 40, 52)):
        rect(width - 300 + i * 70, 19, width - 300 + i * 70 + w, 27, line)
    rect(24, 64, width - 24, 186, lambda x, y: tuple(int(a + (b - a) * (x - 24) / (width - 48)) for a, b in zip(accent, accent2)))
    rect(48, 96, 300, 112, (255, 255, 255))
    rect(48, 124, 240, 132, (205, 212, 255))
    rect(48, 144, 136, 166, (255, 255, 255))
    card = (width - 48 - 2 * 16) // 3
    for i in range(3):
        x = 24 + i * (card + 16)
        rect(x, 204, x + card, height - 24, (255, 255, 255))
        rect(x + 14, 220, x + 50, 244, soft)
        rect(x + 14, 258, x + card - 30, 266, line)
        rect(x + 14, 276, x + card - 60, 284, line)
    for x in range(width):
        pixels[0][x] = pixels[height - 1][x] = line
    for y in range(height):
        pixels[y][0] = pixels[y][width - 1] = line
    rows = [b"\x00" + b"".join(bytes(c) for c in row) for row in pixels]

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")


def ics(summary: str, start: dt.datetime, minutes: int, location: str, organizer, attendees) -> bytes:
    fmt = "%Y%m%dT%H%M%SZ"
    utc = start.astimezone(dt.timezone.utc)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PST Viewer//Demo//DE",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{int(utc.timestamp())}@{ME[1].split('@')[1]}",
        f"DTSTAMP:{NOW.astimezone(dt.timezone.utc).strftime(fmt)}",
        f"DTSTART:{utc.strftime(fmt)}",
        f"DTEND:{(utc + dt.timedelta(minutes=minutes)).strftime(fmt)}",
        f"SUMMARY:{summary}",
        f"LOCATION:{location}",
        f"ORGANIZER;CN={organizer[0]}:mailto:{organizer[1]}",
    ]
    lines += [f"ATTENDEE;CN={name};PARTSTAT=NEEDS-ACTION:mailto:{mail}" for name, mail in attendees]
    lines += ["END:VEVENT", "END:VCALENDAR", ""]
    return "\r\n".join(lines).encode()


def vcf(name: str, first: str, last: str, org: str, title: str, mail: str, phone: str, street: str, city: str, zip_code: str) -> bytes:
    return "\r\n".join(
        [
            "BEGIN:VCARD",
            "VERSION:3.0",
            f"N:{last};{first};;;",
            f"FN:{name}",
            f"ORG:{org}",
            f"TITLE:{title}",
            f"EMAIL;TYPE=INTERNET,WORK:{mail}",
            f"TEL;TYPE=WORK,VOICE:{phone}",
            f"ADR;TYPE=WORK:;;{street};{city};;{zip_code};{'Deutschland' if LANG == 'de' else 'United Kingdom'}",
            "END:VCARD",
            "",
        ]
    ).encode()


# -----------------------------------------------------------------------------
# Messages


def html_body(paragraphs: list[str], signature: str, image_cid: str | None = None, remote_image: bool = False) -> str:
    parts = "".join(f"<p>{p}</p>" for p in paragraphs)
    image = f'<p><img src="cid:{image_cid}" alt="{"Foto" if LANG == "de" else "Photo"}" width="320"></p>' if image_cid else ""
    tracker = '<img src="https://tracking.newsletter.example/open.gif" width="1" height="1" alt="">' if remote_image else ""
    return (
        '<html><head><style>body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d1d1f}'
        ".sig{color:#6e6e73;font-size:13px;border-top:1px solid #e5e5ea;padding-top:8px;margin-top:16px}</style></head>"
        f'<body>{parts}{image}<div class="sig">{signature}</div>{tracker}</body></html>'
    )


def message(sender, to, subject, when, paragraphs, labels, attachments=(), cc=(), important=False, image=None, remote_image=False, signature=None):
    msg = EmailMessage(policy=SMTP)
    msg["From"] = email.utils.formataddr(sender)
    msg["To"] = ", ".join(email.utils.formataddr(p) for p in to)
    if cc:
        msg["Cc"] = ", ".join(email.utils.formataddr(p) for p in cc)
    msg["Subject"] = subject
    msg["Date"] = email.utils.format_datetime(when)
    msg["Message-ID"] = email.utils.make_msgid(domain=ME[1].split("@")[1])
    msg["X-Gmail-Labels"] = ",".join(labels)
    if important:
        msg["X-Priority"] = "1 (Highest)"
        msg["Importance"] = "high"
    text = "\n\n".join(p.replace("<b>", "").replace("</b>", "") for p in paragraphs)
    sig = signature or f"{sender[0]}<br>{sender[1]}"
    msg.set_content(text + "\n\n-- \n" + sig.replace("<br>", "\n"))
    msg.add_alternative(html_body(paragraphs, sig, "bild@demo" if image else None, remote_image), subtype="html")
    if image:
        msg.get_payload()[1].add_related(image, maintype="image", subtype="png", cid="<bild@demo>")
    for name, data, mime in attachments:
        if mime == "message/rfc822":
            msg.add_attachment(data, filename=name)
            continue
        maintype, subtype = mime.split("/")
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=name)
    return msg


def at(days: int, hour: int, minute: int = 0) -> dt.datetime:
    return (NOW - dt.timedelta(days=days)).replace(hour=hour, minute=minute)


def build() -> list[EmailMessage]:
    p = PEOPLE
    inbox, sent, archive = "Posteingang", "Gesendet", "Archiv"
    read, unread, star = "Geöffnet", "Ungelesen", "Markiert"
    contract = pdf("Rahmenvertrag Website-Relaunch", ["Auftraggeber: Beispiel Handels GmbH", "Auftragnehmer: Nordwind Design GmbH", "Laufzeit: 12 Monate", "Vergütung: 24.500 EUR netto"])
    invoice = pdf("Rechnung 2026-1043", ["Weber IT-Service", "Wartungsvertrag Q3", "Betrag: 1.190,00 EUR (inkl. 19 % USt.)", "Zahlbar innerhalb von 14 Tagen"])
    offer = pdf("Angebot Messestand", ["Schröder Messebau", "Standfläche 24 qm, Systembau", "Grafik und Beleuchtung", "Gesamtpreis: 18.900 EUR netto"])
    photo = mockup()
    booth = png(640, 400, (255, 183, 77), (255, 112, 67))
    expenses = "Datum;Beschreibung;Betrag\n02.09.2026;Bahnfahrt Köln;89,90\n03.09.2026;Hotel;134,00\n03.09.2026;Bewirtung;56,40\n".encode()
    forwarded = message(p["lena"], [p["felix"]], "Freigabe Budget Stadtfest", at(20, 9, 12), ["Hallo Felix,", "das Budget für das Stadtfest ist freigegeben. Bitte stimme die Details mit dem Messebauer ab."], [inbox])

    messages = [
        message(p["anna"], [ME], "Entwurf Startseite – Feedback bis Freitag?", at(0, 9, 41), ["Hallo Mario,", "anbei der überarbeitete Entwurf der Startseite. Wir haben die Navigation vereinfacht und die Suche prominenter platziert.", "Kannst du mir bis <b>Freitag</b> Feedback geben?"], [inbox, "Projekte/Website-Relaunch", unread], image=photo),
        message(p["jonas"], [ME], "Rechnung 2026-1043 – Wartungsvertrag Q3", at(0, 8, 5), ["Guten Morgen Herr Beispiel,", "anbei erhalten Sie die Rechnung für den Wartungsvertrag im dritten Quartal.", "Mit freundlichen Grüßen"], [inbox, "Rechnungen", unread], [("Rechnung-2026-1043.pdf", invoice, "application/pdf")]),
        message(p["sara"], [ME], "Vertragsprüfung abgeschlossen", at(0, 7, 30), ["Sehr geehrter Herr Beispiel,", "die Prüfung des Rahmenvertrags ist abgeschlossen. Bitte beachten Sie die Anmerkungen zu § 7 (Haftung) und § 12 (Kündigung)."], [inbox, "Projekte/Website-Relaunch", unread, star], [("Rahmenvertrag-Anmerkungen.pdf", contract, "application/pdf")], important=True),
        message(p["tim"], [ME], "Angebot Messestand Herbst", at(1, 16, 20), ["Hallo Mario,", "wie besprochen das Angebot für den Messestand. Die Lieferung wäre vier Wochen vor Messebeginn möglich."], [inbox, "Projekte/Messe 2026", read], [("Angebot-Messestand.pdf", offer, "application/pdf"), ("Standansicht.png", booth, "image/png")]),
        message(p["julia"], [ME], "Einladung: Abstimmung Website-Relaunch", at(1, 11, 2), ["Hallo Mario,", "ich lade dich zur Abstimmung der nächsten Projektphase ein. Die Einladung liegt als Kalenderdatei bei."], [inbox, "Projekte/Website-Relaunch", read], [("Einladung.ics", ics("Abstimmung Website-Relaunch", at(-2, 10, 0), 60, "Besprechungsraum 2 / Videokonferenz", p["julia"], [ME, p["anna"]]), "text/calendar")]),
        message(p["news"], [ME], "Die Trends der Woche: KI im Mittelstand", at(2, 6, 0), ["Liebe Leserinnen und Leser,", "diese Woche: Wie mittelständische Unternehmen KI sinnvoll einsetzen, neue Regeln zur E-Rechnung und ein Interview zur IT-Sicherheit."], [inbox, "Newsletter", unread], remote_image=True, signature="Fachmagazin Digital · Abmelden"),
        message(ME, [p["anna"]], "Re: Entwurf Startseite – Feedback bis Freitag?", at(3, 14, 15), ["Hallo Anna,", "danke für den Entwurf! Die vereinfachte Navigation gefällt mir sehr. Können wir die Farben im Footer noch etwas abschwächen?"], [sent, read]),
        message(p["felix"], [ME], "Reisekosten September", at(3, 10, 48), ["Hallo Mario,", "anbei meine Reisekostenabrechnung für September. Belege reiche ich im Original nach."], [inbox, read], [("Reisekosten-September.csv", expenses, "text/csv")]),
        message(p["lena"], [ME], "Kontaktdaten Stadtwerke", at(4, 9, 30), ["Hallo Herr Beispiel,", "wie gewünscht meine Kontaktdaten als vCard."], [inbox, "Kunden", read], [("Lena-Hoffmann.vcf", vcf("Lena Hoffmann", "Lena", "Hoffmann", "Stadtwerke Musterstadt", "Leiterin Marketing", p["lena"][1], "+49 221 555 0142", "Hafenstraße 12", "Musterstadt", "50667"), "text/vcard")]),
        message(p["felix"], [ME], "WG: Freigabe Budget Stadtfest", at(6, 15, 5), ["Hallo Mario,", "zur Info die Freigabe von Frau Hoffmann – die Originalnachricht hängt an."], [inbox, "Kunden", read], [("Freigabe Budget Stadtfest.eml", forwarded, "message/rfc822")]),
        message(p["bank"], [ME], "Ihr Kontoauszug ist verfügbar", at(8, 7, 12), ["Sehr geehrter Kunde,", "Ihr elektronischer Kontoauszug für den vergangenen Monat steht im Online-Banking bereit."], [inbox, "Rechnungen", read]),
        message(p["tim"], [ME], "Re: Angebot Messestand Herbst", at(9, 13, 40), ["Hallo Mario,", "wir können die Standfläche auch auf 30 qm erweitern. Ich schicke dir gern eine Variante."], [inbox, "Projekte/Messe 2026", read, star]),
        message(ME, [p["tim"]], "Messestand: Rückfragen zur Beleuchtung", at(10, 11, 0), ["Hallo Tim,", "wie viele Strahler sind im Angebot enthalten, und ist die Stromversorgung inklusive?"], [sent, read]),
        message(p["anna"], [ME], "Moodboard Website-Relaunch", at(15, 16, 45), ["Hallo Mario,", "hier das Moodboard mit den drei Stilrichtungen. Unser Favorit ist Variante B."], [archive, "Projekte/Website-Relaunch", read], image=photo),
        message(p["jonas"], [ME], "Wartungsfenster am Samstag", at(18, 12, 0), ["Hallo zusammen,", "am Samstag zwischen 8 und 12 Uhr spielen wir Updates auf den Servern ein. Es kann zu kurzen Unterbrechungen kommen."], [archive, read], cc=[p["felix"]]),
        message(p["sara"], [ME], "Datenschutzerklärung – aktualisierte Fassung", at(25, 10, 20), ["Sehr geehrter Herr Beispiel,", "anbei die aktualisierte Datenschutzerklärung für die neue Website."], [archive, "Projekte/Website-Relaunch", read], [("Datenschutzerklaerung.pdf", pdf("Datenschutzerklärung", ["Verantwortlicher: Beispiel Handels GmbH", "Stand: aktuell"]), "application/pdf")]),
        message(p["lena"], [ME], "Rückblick Stadtfest", at(34, 17, 30), ["Hallo Herr Beispiel,", "vielen Dank für die tolle Zusammenarbeit beim Stadtfest! Die Fotos schicke ich Ihnen separat."], [archive, "Kunden", read]),
        message(p["tim"], [ME], "Fotos vom Messestand", at(52, 9, 15), ["Hallo Mario,", "hier die Fotos vom Aufbau. Sieht richtig gut aus!"], [archive, "Projekte/Messe 2026", read], [("Messestand-Aufbau.png", booth, "image/png")]),
        message(p["jonas"], [ME], "Rechnung 2026-0871", at(70, 8, 0), ["Guten Tag,", "anbei die Rechnung für den Wartungsvertrag im zweiten Quartal."], [archive, "Rechnungen", read], [("Rechnung-2026-0871.pdf", pdf("Rechnung 2026-0871", ["Weber IT-Service", "Wartungsvertrag Q2", "Betrag: 1.190,00 EUR"]), "application/pdf")]),
        message(p["anna"], [ME], "Kick-off Website-Relaunch", at(96, 15, 0), ["Hallo Mario,", "danke für das gute Kick-off-Meeting! Anbei der unterschriebene Rahmenvertrag."], [archive, "Projekte/Website-Relaunch", read], [("Rahmenvertrag.pdf", contract, "application/pdf")]),
        message(ME, [p["anna"]], "Re: Kick-off Website-Relaunch", at(95, 9, 30), ["Hallo Anna,", "danke, der Vertrag ist angekommen. Ich freue mich auf die Zusammenarbeit!"], [sent, read]),
        message(p["news"], [ME], "Sonderausgabe: E-Rechnung ab 2027", at(130, 6, 0), ["Liebe Leserinnen und Leser,", "alles Wichtige zur E-Rechnungspflicht im Überblick."], ["Newsletter", read], remote_image=True, signature="Fachmagazin Digital · Abmelden"),
        message(p["felix"], [ME], "Urlaubsplanung Sommer", at(160, 11, 11), ["Hallo Mario,", "ich würde gern vom 1. bis 21. August Urlaub nehmen. Passt das in die Projektplanung?"], [archive, read]),
        message(p["sara"], [ME], "Markenanmeldung eingereicht", at(210, 14, 0), ["Sehr geehrter Herr Beispiel,", "die Markenanmeldung wurde beim DPMA eingereicht. Das Aktenzeichen folgt in Kürze."], [archive, read, star], important=True),
        message(p["jonas"], [ME], "Neuer Laptop für Felix", at(260, 10, 0), ["Hallo Mario,", "der neue Laptop für Felix ist eingetroffen und eingerichtet."], [archive, read]),
    ]
    return messages


def build_en() -> list[EmailMessage]:
    p = PEOPLE_EN
    inbox, sent, archive = "Inbox", "Sent", "Archive"
    read, unread, star = "Opened", "Unread", "Starred"
    contract = pdf("Framework Agreement Website Relaunch", ["Client: Sample Trading Ltd", "Contractor: Northwind Design Ltd", "Term: 12 months", "Fee: GBP 21,500 plus VAT"])
    invoice = pdf("Invoice 2026-1043", ["Brooks IT Services", "Maintenance contract Q3", "Amount: GBP 990.00 (incl. 20 % VAT)", "Payable within 14 days"])
    offer = pdf("Quote Exhibition Stand", ["Foster Exhibits", "Stand area 24 sqm, modular system", "Graphics and lighting", "Total: GBP 16,400 plus VAT"])
    photo = mockup()
    booth = png(640, 400, (255, 183, 77), (255, 112, 67))
    expenses = "Date,Description,Amount\n2026-09-02,Train to Manchester,79.90\n2026-09-03,Hotel,118.00\n2026-09-03,Client dinner,48.40\n".encode()
    forwarded = message(p["lena"], [p["felix"]], "Budget approved: City Festival", at(20, 9, 12), ["Hi Lucas,", "the budget for the city festival is approved. Please sort out the details with the stand builder."], [inbox])

    messages = [
        message(p["anna"], [ME], "Homepage draft – feedback by Friday?", at(0, 9, 41), ["Hi Alex,", "here is the revised homepage draft. We simplified the navigation and gave the search a more prominent place.", "Could you send me your feedback by <b>Friday</b>?"], [inbox, "Projects/Website Relaunch", unread], image=photo),
        message(p["jonas"], [ME], "Invoice 2026-1043 – Maintenance Q3", at(0, 8, 5), ["Good morning Alex,", "please find attached the invoice for the maintenance contract in the third quarter.", "Kind regards"], [inbox, "Invoices", unread], [("Invoice-2026-1043.pdf", invoice, "application/pdf")]),
        message(p["sara"], [ME], "Contract review completed", at(0, 7, 30), ["Dear Alex,", "the review of the framework agreement is complete. Please note our comments on clause 7 (liability) and clause 12 (termination)."], [inbox, "Projects/Website Relaunch", unread, star], [("Framework-Agreement-Comments.pdf", contract, "application/pdf")], important=True),
        message(p["tim"], [ME], "Quote: autumn exhibition stand", at(1, 16, 20), ["Hi Alex,", "as discussed, here is our quote for the exhibition stand. We could deliver four weeks before the fair opens."], [inbox, "Projects/Trade Fair 2026", read], [("Quote-Exhibition-Stand.pdf", offer, "application/pdf"), ("Stand-Preview.png", booth, "image/png")]),
        message(p["julia"], [ME], "Invitation: Website relaunch check-in", at(1, 11, 2), ["Hi Alex,", "I'd like to invite you to a check-in about the next project phase. The invitation is attached as a calendar file."], [inbox, "Projects/Website Relaunch", read], [("Invitation.ics", ics("Website relaunch check-in", at(-2, 10, 0), 60, "Meeting room 2 / video call", p["julia"], [ME, p["anna"]]), "text/calendar")]),
        message(p["news"], [ME], "This week: AI for small businesses", at(2, 6, 0), ["Dear readers,", "this week: how small and medium-sized businesses put AI to good use, new e-invoicing rules and an interview on IT security."], [inbox, "Newsletters", unread], remote_image=True, signature="Digital Business Weekly · Unsubscribe"),
        message(ME, [p["anna"]], "Re: Homepage draft – feedback by Friday?", at(3, 14, 15), ["Hi Emma,", "thanks for the draft! I really like the simpler navigation. Could we tone down the footer colours a little?"], [sent, read]),
        message(p["felix"], [ME], "Travel expenses September", at(3, 10, 48), ["Hi Alex,", "attached are my travel expenses for September. I'll hand in the original receipts later."], [inbox, read], [("Travel-Expenses-September.csv", expenses, "text/csv")]),
        message(p["lena"], [ME], "Contact details Riverton Utilities", at(4, 9, 30), ["Hello Alex,", "as requested, here are my contact details as a vCard."], [inbox, "Clients", read], [("Olivia-Hughes.vcf", vcf("Olivia Hughes", "Olivia", "Hughes", "Riverton Utilities", "Head of Marketing", p["lena"][1], "+44 20 7946 0142", "12 Harbour Street", "Riverton", "RT1 2AB"), "text/vcard")]),
        message(p["felix"], [ME], "Fwd: Budget approved: City Festival", at(6, 15, 5), ["Hi Alex,", "FYI, the approval from Olivia – the original message is attached."], [inbox, "Clients", read], [("Budget approved City Festival.eml", forwarded, "message/rfc822")]),
        message(p["bank"], [ME], "Your statement is ready", at(8, 7, 12), ["Dear customer,", "your electronic statement for last month is now available in online banking."], [inbox, "Invoices", read]),
        message(p["tim"], [ME], "Re: Quote: autumn exhibition stand", at(9, 13, 40), ["Hi Alex,", "we can also extend the stand to 30 sqm. Happy to send you an alternative."], [inbox, "Projects/Trade Fair 2026", read, star]),
        message(ME, [p["tim"]], "Exhibition stand: questions about lighting", at(10, 11, 0), ["Hi Ryan,", "how many spotlights are included in the quote, and is the power supply included?"], [sent, read]),
        message(p["anna"], [ME], "Mood board website relaunch", at(15, 16, 45), ["Hi Alex,", "here is the mood board with the three styles. Our favourite is option B."], [archive, "Projects/Website Relaunch", read], image=photo),
        message(p["jonas"], [ME], "Maintenance window on Saturday", at(18, 12, 0), ["Hello everyone,", "on Saturday between 8 am and 12 noon we will install updates on the servers. There may be short interruptions."], [archive, read], cc=[p["felix"]]),
        message(p["sara"], [ME], "Privacy policy – updated version", at(25, 10, 20), ["Dear Alex,", "please find attached the updated privacy policy for the new website."], [archive, "Projects/Website Relaunch", read], [("Privacy-Policy.pdf", pdf("Privacy Policy", ["Controller: Sample Trading Ltd", "Version: current"]), "application/pdf")]),
        message(p["lena"], [ME], "City festival review", at(34, 17, 30), ["Hello Alex,", "thank you so much for the great collaboration at the city festival! I'll send you the photos separately."], [archive, "Clients", read]),
        message(p["tim"], [ME], "Photos of the exhibition stand", at(52, 9, 15), ["Hi Alex,", "here are the photos of the build-up. Looks really good!"], [archive, "Projects/Trade Fair 2026", read], [("Stand-Build-Up.png", booth, "image/png")]),
        message(p["jonas"], [ME], "Invoice 2026-0871", at(70, 8, 0), ["Hello,", "please find attached the invoice for the maintenance contract in the second quarter."], [archive, "Invoices", read], [("Invoice-2026-0871.pdf", pdf("Invoice 2026-0871", ["Brooks IT Services", "Maintenance contract Q2", "Amount: GBP 990.00"]), "application/pdf")]),
        message(p["anna"], [ME], "Website relaunch kick-off", at(96, 15, 0), ["Hi Alex,", "thanks for the productive kick-off meeting! Attached is the signed framework agreement."], [archive, "Projects/Website Relaunch", read], [("Framework-Agreement.pdf", contract, "application/pdf")]),
        message(ME, [p["anna"]], "Re: Website relaunch kick-off", at(95, 9, 30), ["Hi Emma,", "thanks, the agreement arrived. Looking forward to working with you!"], [sent, read]),
        message(p["news"], [ME], "Special issue: e-invoicing in 2027", at(130, 6, 0), ["Dear readers,", "everything you need to know about mandatory e-invoicing at a glance."], ["Newsletters", read], remote_image=True, signature="Digital Business Weekly · Unsubscribe"),
        message(p["felix"], [ME], "Summer holiday planning", at(160, 11, 11), ["Hi Alex,", "I'd like to take holiday from 1 to 21 August. Does that fit the project plan?"], [archive, read]),
        message(p["sara"], [ME], "Trademark application filed", at(210, 14, 0), ["Dear Alex,", "the trademark application has been filed. The reference number will follow shortly."], [archive, read, star], important=True),
        message(p["jonas"], [ME], "New laptop for Lucas", at(260, 10, 0), ["Hi Alex,", "the new laptop for Lucas has arrived and is set up."], [archive, read]),
    ]
    return messages


def write_mbox(messages: list[EmailMessage], path: Path) -> None:
    with path.open("wb") as out:
        for msg in messages:
            raw = msg.as_bytes().replace(b"\r\n", b"\n")
            # mboxrd: quote "From " lines in the body.
            lines = [b">" + line if line.lstrip(b">").startswith(b"From ") else line for line in raw.split(b"\n")]
            date = email.utils.parsedate_to_datetime(msg["Date"]).strftime("%a %b %d %H:%M:%S %Y")
            out.write(b"From demo@" + ME[1].split("@")[1].encode() + b" " + date.encode() + b"\n" + b"\n".join(lines) + b"\n\n")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    english = LANG == "en"
    messages = build_en() if english else build()
    write_mbox(messages, OUT / ("Demo-Mailbox.mbox" if english else "Demo-Postfach.mbox"))
    folder = OUT / ("Demo-Folder" if english else "Demo-Ordner")
    clients, projects = ("Clients", "Projects") if english else ("Kunden", "Projekte")
    for sub in (clients, projects):
        (folder / sub).mkdir(parents=True, exist_ok=True)
    picks = {clients: [8, 16], projects: [0, 3], "": [1]}
    for sub, indices in picks.items():
        for index in indices:
            msg = messages[index]
            name = "".join(c if c.isalnum() or c in " -" else "_" for c in msg["Subject"])[:60].strip() + ".eml"
            (folder / sub / name).write_bytes(msg.as_bytes())
    print(f"{len(messages)} messages written to {OUT}")


if __name__ == "__main__":
    main()
