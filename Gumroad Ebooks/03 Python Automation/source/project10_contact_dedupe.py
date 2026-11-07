"""Project 10: find duplicate contacts by email or phone number.
Writes a de-duplicated copy and a list of what was dropped; the original
file is untouched."""
import argparse
import csv
import re
from pathlib import Path


def phone_key(phone):
    digits = re.sub(r"\D", "", phone)
    return digits[-7:] if len(digits) >= 7 else ""  # compare the last 7 digits


def main(argv=None):
    parser = argparse.ArgumentParser(description="Contact list de-duplicator.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, default=Path("contacts_unique.csv"))
    parser.add_argument("--dropped", type=Path, default=Path("contacts_dropped.csv"))
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1

    seen_email, seen_phone = {}, {}
    keep, dropped = [], []
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        fields = reader.fieldnames
        for row in reader:
            email = row["email"].strip().lower()
            phone = phone_key(row["phone"])
            match = seen_email.get(email) if email else None
            match = match or (seen_phone.get(phone) if phone else None)
            if match:
                dropped.append({**row, "duplicate_of": match})
                continue
            keep.append(row)
            if email:
                seen_email[email] = row["name"]
            if phone:
                seen_phone[phone] = row["name"]

    with args.out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(keep)
    with args.dropped.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields + ["duplicate_of"])
        writer.writeheader()
        writer.writerows(dropped)
    print(f"Kept {len(keep)}, flagged {len(dropped)} as duplicates:")
    for row in dropped:
        print(f"  {row['name']} looks like {row['duplicate_of']}")
    print("Review the dropped list before trusting it: matches can be wrong.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
