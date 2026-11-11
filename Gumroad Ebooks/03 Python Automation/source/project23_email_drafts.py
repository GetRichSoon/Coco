"""Project 23: prepare payment reminder emails as .eml files from a CSV.
Nothing is sent: the script has no mail server code and no password.
You open each file in your mail program, read it, and send it yourself."""
import argparse
import csv
import re
from email.message import EmailMessage
from pathlib import Path

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TEMPLATE = """Hello {name},

This is a friendly reminder that invoice {invoice} for {amount} is due on
{due}. If you have already paid, please ignore this message.

Kind regards
"""


def main(argv=None):
    parser = argparse.ArgumentParser(description="Prepare email drafts.")
    parser.add_argument("input", type=Path)
    parser.add_argument("outdir", type=Path)
    parser.add_argument("--sender", required=True, help="your address")
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1
    if not EMAIL.match(args.sender):
        print("Error: --sender does not look like an email address.")
        return 1
    args.outdir.mkdir(parents=True, exist_ok=True)

    made = skipped = 0
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        for line_no, row in enumerate(csv.DictReader(fh), start=2):
            if not EMAIL.match(row["email"].strip()):
                print(f"Skipped line {line_no}: bad address '{row['email']}'")
                skipped += 1
                continue
            msg = EmailMessage()
            msg["From"] = args.sender
            msg["To"] = row["email"].strip()
            msg["Subject"] = f"Reminder: invoice {row['invoice']}"
            msg.set_content(TEMPLATE.format(
                name=row["name"], invoice=row["invoice"],
                amount=f"{float(row['amount']):.2f}", due=row["due"]))
            target = args.outdir / f"{row['invoice']}.eml"
            if target.exists():
                print(f"Skipped {target.name}: already exists")
                skipped += 1
                continue
            target.write_bytes(bytes(msg))  # a file on disk, nothing sent
            print(f"Draft written: {target.name} (to {msg['To']})")
            made += 1
    print(f"{made} drafts prepared, {skipped} skipped. Nothing was sent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
