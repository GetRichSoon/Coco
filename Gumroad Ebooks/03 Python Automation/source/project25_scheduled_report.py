"""Project 25: a report job that is safe to run from a scheduler. It takes
the newest CSV in an inbox folder, writes a dated Markdown report, logs
everything to a file, and skips the run if today's report already exists.
Python-only repeat: add --every-seconds N --runs M (see the book)."""
import argparse
import csv
import logging
import time
from collections import Counter
from datetime import date
from decimal import Decimal
from logging.handlers import RotatingFileHandler
from pathlib import Path


def run_once(inbox, outdir, log):
    files = sorted(inbox.glob("*.csv"), key=lambda p: p.stat().st_mtime)
    if not files:
        log.warning("No CSV files in %s", inbox)
        return 1
    newest = files[-1]
    target = outdir / f"report_{date.today().isoformat()}.md"
    if target.exists():
        log.info("Report %s already exists: nothing to do", target.name)
        return 0
    totals = Counter()
    with newest.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            totals[row["category"]] += Decimal(row["amount"])
    lines = [f"# Spending report {date.today().isoformat()}", "",
             f"Source: {newest.name}", ""]
    lines += [f"- {cat}: {amount:.2f}" for cat, amount in totals.most_common()]
    lines += ["", f"Total: {sum(totals.values()):.2f}"]
    outdir.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    log.info("Wrote %s from %s (%d categories)", target.name, newest.name,
             len(totals))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Scheduled report job.")
    parser.add_argument("inbox", type=Path)
    parser.add_argument("outdir", type=Path)
    parser.add_argument("--log", type=Path, default=Path("report_job.log"))
    parser.add_argument("--every-seconds", type=int, default=0)
    parser.add_argument("--runs", type=int, default=1)
    args = parser.parse_args(argv)

    log = logging.getLogger("report_job")
    log.setLevel(logging.INFO)
    # A rotating file keeps the log from growing without limit.
    handler = RotatingFileHandler(args.log, maxBytes=200_000, backupCount=3,
                                  encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(handler)
    log.addHandler(logging.StreamHandler())  # also show on screen

    if not args.inbox.is_dir():
        log.error("Inbox %s is not a folder", args.inbox)
        return 1
    status = 0
    for run in range(args.runs):
        try:
            status = run_once(args.inbox, args.outdir, log)
        except Exception:  # a scheduled job must log the reason and not vanish
            log.exception("Report job failed")
            status = 1
        if run < args.runs - 1:
            time.sleep(args.every_seconds)
    return status


if __name__ == "__main__":
    raise SystemExit(main())
