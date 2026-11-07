"""Create all sample data used by the projects. Safe to re-run: it only
writes inside the sample_data folder next to this script.
Needs openpyxl (python -m pip install openpyxl) for the .xlsx samples."""
import csv
import os
import random
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "sample_data"


def write(path, text="", mtime=None, binary=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    if binary is not None:
        path.write_bytes(binary)
    else:
        path.write_text(text, encoding="utf-8", newline="\n")
    if mtime:
        ts = time.mktime(time.strptime(mtime, "%Y-%m-%d"))
        os.utime(path, (ts, ts))


def write_csv(path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)


def tiny_pdf(path, pages):
    """Hand-built PDF. Each item in pages is a list of text lines; an empty
    list gives a blank page, like a scanned page that has no text layer."""
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None,
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for lines in pages:
        n = len(objs) + 1
        kids.append(f"{n} 0 R")
        body = "BT /F1 12 Tf 72 720 Td 16 TL "
        body += " ".join(f"({l}) Tj T*" for l in lines) + " ET"
        objs.append("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                    "/Resources << /Font << /F1 3 0 R >> >> "
                    f"/Contents {n + 1} 0 R >>")
        objs.append(f"<< /Length {len(body)} >>\nstream\n{body}\nendstream")
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} >>"
    out = b"%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{o}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += (f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref}\n%%EOF\n").encode()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(out)


def main():
    rng = random.Random(7)  # fixed seed: same sample data every time
    # Project 1: rename
    for i, name in enumerate(["IMG_4471.jpg", "IMG_4472.jpg", "Beach day.jpg",
                              "notes final v2.txt", "budget (copy).txt"]):
        write(ROOT / "rename_demo" / name, f"demo file {i}\n")
    # Project 2: organise by type
    for name in ["holiday.jpg", "logo.png", "cv_2026.pdf", "minutes.docx",
                 "budget.xlsx", "sales.csv", "backup.zip", "setup.exe",
                 "readme", "song.mp3", "photo2.jpeg", "notes.txt"]:
        write(ROOT / "downloads" / name, f"content of {name}\n")
    # Project 3: duplicates
    write(ROOT / "dupes" / "a" / "invoice_march.txt", "Invoice total 120\n")
    write(ROOT / "dupes" / "b" / "invoice_march_copy.txt", "Invoice total 120\n")
    write(ROOT / "dupes" / "b" / "invoice_april.txt", "Invoice total 135\n")
    write(ROOT / "dupes" / "c" / "photo.bin", binary=bytes(range(256)) * 8)
    write(ROOT / "dupes" / "photo_again.bin", binary=bytes(range(256)) * 8)
    write(ROOT / "dupes" / "unique.txt", "Only one of me\n")
    # Projects 4 and 5: a folder to back up and measure
    write(ROOT / "project_files" / "plan.txt", "Plan\n" * 50)
    write(ROOT / "project_files" / "data" / "numbers.csv", "a,b\n1,2\n" * 400)
    write(ROOT / "project_files" / "data" / "big.bin", binary=b"x" * 150_000)
    write(ROOT / "project_files" / "docs" / "guide.md", "# Guide\n" * 200)
    # Project 6: photos (dummy bytes; the date comes from modified time)
    for name, d in [("a.jpg", "2026-08-14"), ("b.jpg", "2026-08-30"),
                    ("c.png", "2026-09-02"), ("d.jpeg", "2026-10-21"),
                    ("e.jpg", "2026-10-22"), ("notes.txt", "2026-10-22")]:
        write(ROOT / "photos" / name, binary=b"\xff\xd8dummy " + name.encode(),
              mtime=d)
    # Project 7: messy CSV
    write(ROOT / "sales_messy.csv",
          "Name, Region ,Amount,Date\n"
          "  alice  JOHNSON ,north,\"$1,200.50\",2026-10-03\n"
          "BOB smith,SOUTH,340,03/10/2026\n"
          ",,,\n"
          "bob smith,south,340,03/10/2026\n"
          "carol  Diaz,East,\"$89.9\",Oct 5 2026\n"
          "dan Lee,north,abc,2026-10-06\n"
          "erin Cho,West,150,31-10-2026\n"
          "erin Cho,West,150,not a date\n")
    # Project 8: a CSV to split
    write_csv(ROOT / "orders.csv", ["order_id", "customer", "total"],
              [[1000 + i, f"customer{rng.randint(1, 9)}",
                f"{rng.randint(10, 500)}.00"] for i in range(25)])
    # Project 9: expenses
    base = {"Rent": 900, "Food": 40, "Transport": 25, "Software": 15,
            "Health": 60}
    rows = []
    for m in (9, 10):
        for day, cat in [(1, "Rent"), (3, "Food"), (5, "Transport"),
                         (8, "Food"), (12, "Software"), (15, "Food"),
                         (18, "Health"), (21, "Transport"), (25, "Food")]:
            amt = base[cat] + rng.randint(0, 20) + (0.5 if cat == "Food" else 0)
            rows.append([f"2026-{m:02d}-{day:02d}", cat, f"{cat} item", amt])
    write_csv(ROOT / "expenses.csv",
              ["date", "category", "description", "amount"], rows)
    # Project 25 reads the newest CSV from an "inbox" folder
    write_csv(ROOT / "inbox" / "expenses_latest.csv",
              ["date", "category", "description", "amount"], rows)
    # Project 10: contacts
    write_csv(ROOT / "contacts.csv", ["name", "email", "phone"], [
        ["Alice Johnson", "alice@example.com", "+1 555 0101"],
        ["A. Johnson", "ALICE@example.com", "555-0101"],
        ["Bob Smith", "bob@example.com", "555 0102"],
        ["Robert Smith", "bob.smith@example.com", "555-0102"],
        ["Carol Diaz", "carol@example.com", "555 0103"],
        ["Dan Lee", "", "555 0104"],
        ["Dan Lee", "", "555-0104"]])
    # Project 11: validation
    write_csv(ROOT / "orders_to_check.csv",
              ["order_id", "email", "amount", "date", "status"], [
        ["1001", "a@example.com", "25.00", "2026-10-01", "paid"],
        ["1002", "not-an-email", "10.00", "2026-10-02", "paid"],
        ["1003", "c@example.com", "-5", "2026-10-03", "paid"],
        ["1004", "d@example.com", "12.50", "2026-13-40", "pending"],
        ["1005", "e@example.com", "9.99", "2026-10-05", "shipped??"],
        ["", "f@example.com", "7", "2026-10-06", "paid"]])
    # Projects 13 and 22: monthly sales CSVs
    header = ["date", "region", "product", "units", "unit_price"]
    prods = {"Notebook": 4.5, "Pen set": 7.25, "Planner": 12.0, "Folder": 2.2}
    for month in (9, 10):
        rows = []
        for _ in range(24):
            p = rng.choice(list(prods))
            rows.append([f"2026-{month:02d}-{rng.randint(1, 28):02d}",
                         rng.choice(["North", "South", "East"]), p,
                         rng.randint(1, 30), prods[p]])
        rows.sort()
        write_csv(ROOT / "sales" / f"sales_2026_{month:02d}.csv", header, rows)
    # Project 14: branch workbooks
    from openpyxl import Workbook
    (ROOT / "branches").mkdir(parents=True, exist_ok=True)
    for branch in ("north", "south", "east"):
        wb = Workbook()
        ws = wb.active
        ws.title = "Sales"
        ws.append(["date", "product", "units", "revenue"])
        for i in range(4):
            ws.append([f"2026-10-{i + 2:02d}", rng.choice(list(prods)),
                       rng.randint(1, 20), round(rng.uniform(20, 200), 2)])
        wb.save(ROOT / "branches" / f"branch_{branch}.xlsx")
    wb = Workbook()
    ws = wb.active
    ws.title = "Sales"
    ws.append(["day", "item", "qty"])
    ws.append(["2026-10-02", "Pen", 3])
    wb.save(ROOT / "branches" / "branch_west_wrong_headers.xlsx")
    # Projects 15 to 17: PDFs
    tiny_pdf(ROOT / "pdfs" / "invoice_a.pdf",
             [["Invoice A-100", "Total due: 120.00 EUR", "Pay within 14 days"]])
    tiny_pdf(ROOT / "pdfs" / "invoice_b.pdf",
             [["Invoice B-200", "Total due: 135.00 EUR"]])
    tiny_pdf(ROOT / "pdfs" / "handbook.pdf",
             [[f"Handbook page {n}", f"Section {n} text for the demo."]
              for n in range(1, 6)])
    tiny_pdf(ROOT / "pdfs" / "scanned_like.pdf", [[]])
    # Projects 18 to 20: text
    write(ROOT / "notes" / "a.txt", "Python makes small tasks easy. Python is "
          "readable and the community is friendly.\n")
    write(ROOT / "notes" / "b.txt", "Automation saves time when the task "
          "repeats. The task must be clear before the script is written.\n")
    write(ROOT / "notes" / "c.md", "The old name was ACME Tools. ACME Tools "
          "is now Northwind Tools.\nAsk ACME Tools support.\n")
    write(ROOT / "release_notes_raw.txt",
          "  * fixed login bug  \n\n\n- Added dark mode\n• improved   "
          "search speed\n-added dark mode\n\n* FIXED crash on startup.\n"
          "   -  update   docs\n")
    # Project 21: log file
    lines = []
    for i in range(40):
        lvl = rng.choice(["INFO"] * 6 + ["WARNING", "ERROR"])
        msg = {"INFO": "request ok", "WARNING": "slow response",
               "ERROR": rng.choice(["payment timeout", "db connection lost"])
               }[lvl]
        lines.append(f"2026-11-01 {8 + i // 6:02d}:{(i * 7) % 60:02d}:00 "
                     f"{lvl} {msg}")
    lines.insert(5, "this line is not a log entry")
    write(ROOT / "app.log", "\n".join(lines) + "\n")
    # Project 23: reminder recipients
    write_csv(ROOT / "reminders.csv",
              ["name", "email", "invoice", "amount", "due"], [
        ["Alice Johnson", "alice@example.com", "INV-2026-0001", "120.00",
         "2026-11-15"],
        ["Bob Smith", "bob@example.com", "INV-2026-0002", "340.50",
         "2026-11-20"],
        ["Bad Row", "missing-at-sign", "INV-2026-0003", "10.00",
         "2026-11-22"]])
    print("Sample data written to", ROOT)


if __name__ == "__main__":
    main()
