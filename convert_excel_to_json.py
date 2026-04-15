import json
import re
from pathlib import Path
import openpyxl

BASE_DIR = Path(__file__).resolve().parent
INPUT_FILE = BASE_DIR / "pokemon_master_test.xlsx"
OUTPUT_FILE = BASE_DIR / "questions.json"

def split_aliases(value):
    if value in (None, ""):
        return []
    return [part.strip() for part in re.split(r"[｜|]", str(value)) if part and str(part).strip()]

def main():
    wb = openpyxl.load_workbook(INPUT_FILE, data_only=True)
    ws = wb[wb.sheetnames[0]]
    headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    header_map = {header: idx for idx, header in enumerate(headers)}
    rows = []

    for excel_row in ws.iter_rows(min_row=2, values_only=True):
        if not any(excel_row):
            continue
        record = {header: excel_row[idx] if idx < len(excel_row) else None for header, idx in header_map.items()}
        enabled = record.get("enabled")
        if enabled in (False, None, "", 0, "FALSE", "false"):
            continue
        rows.append({
            "id": str(record.get("id") or "").strip(),
            "image": str(record.get("image") or "").strip(),
            "answer": str(record.get("answer") or "").strip(),
            "aliases": split_aliases(record.get("aliases")),
            "enabled": True,
            "note": "" if record.get("note") is None else str(record.get("note")).strip()
        })

    OUTPUT_FILE.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} questions to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
