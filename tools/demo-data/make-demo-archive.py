#!/usr/bin/env python3
"""Creates a fictional demo mailbox for tests, app screenshots and store listings.

    tools/demo-data/make-demo-archive.py [output directory]

Writes "Demo-Postfach.mbox" (Google Takeout style with labels, read/starred
state, HTML mails, inline images and PDF, PNG, ICS, VCF, CSV and EML
attachments; dates relative to today) and a folder "Demo-Ordner" with .eml
files. All people, companies and addresses are made up.
"""

import datetime as dt
import email.utils
import struct
import sys
import zlib
from email.message import EmailMessage
from email.policy import SMTP
from pathlib import Path

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "demo-archive")
ME = ("Mario Beispiel", "mario@beispiel-mail.de")
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


def ics(summary: str, start: dt.datetime, minutes: int, location: str, organizer, attendees) -> bytes:
    fmt = "%Y%m%dT%H%M%SZ"
    utc = start.astimezone(dt.timezone.utc)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PST Viewer//Demo//DE",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{int(utc.timestamp())}@beispiel-mail.de",
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
            f"ADR;TYPE=WORK:;;{street};{city};;{zip_code};Deutschland",
            "END:VCARD",
            "",
        ]
    ).encode()


# -----------------------------------------------------------------------------
# Messages


def html_body(paragraphs: list[str], signature: str, image_cid: str | None = None, remote_image: bool = False) -> str:
    parts = "".join(f"<p>{p}</p>" for p in paragraphs)
    image = f'<p><img src="cid:{image_cid}" alt="Foto" width="320"></p>' if image_cid else ""
    tracker = '<img src="https://tracking.fachmagazin-digital.example/open.gif" width="1" height="1" alt="">' if remote_image else ""
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
    msg["Message-ID"] = email.utils.make_msgid(domain="beispiel-mail.de")
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
    photo = png(480, 300, (61, 139, 255), (90, 61, 255))
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


def write_mbox(messages: list[EmailMessage], path: Path) -> None:
    with path.open("wb") as out:
        for msg in messages:
            raw = msg.as_bytes().replace(b"\r\n", b"\n")
            # mboxrd: quote "From " lines in the body.
            lines = [b">" + line if line.lstrip(b">").startswith(b"From ") else line for line in raw.split(b"\n")]
            date = email.utils.parsedate_to_datetime(msg["Date"]).strftime("%a %b %d %H:%M:%S %Y")
            out.write(b"From demo@beispiel-mail.de " + date.encode() + b"\n" + b"\n".join(lines) + b"\n\n")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    messages = build()
    write_mbox(messages, OUT / "Demo-Postfach.mbox")
    folder = OUT / "Demo-Ordner"
    for sub in ("Kunden", "Projekte"):
        (folder / sub).mkdir(parents=True, exist_ok=True)
    picks = {"Kunden": [8, 16], "Projekte": [0, 3], "": [1]}
    for sub, indices in picks.items():
        for index in indices:
            msg = messages[index]
            name = "".join(c if c.isalnum() or c in " -" else "_" for c in msg["Subject"])[:60].strip() + ".eml"
            (folder / sub / name).write_bytes(msg.as_bytes())
    print(f"{len(messages)} messages written to {OUT}")


if __name__ == "__main__":
    main()
