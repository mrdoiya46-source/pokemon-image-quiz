import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

ALLOWED_FORM_CATEGORIES = {"base", "regional", "form", "mega"}
ALLOWED_REGIONS = {
    "kanto",
    "johto",
    "hoenn",
    "sinnoh",
    "unova",
    "kalos",
    "alola",
    "galar",
    "hisui",
    "paldea",
}


def normalize_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False

    text = str(value).strip().lower()
    return text in {"true", "1", "yes", "y", "on"}


def split_multi_value(value):
    if value is None:
        return []

    text = str(value).strip()
    if not text:
        return []

    for sep in ["｜", "|"]:
        text = text.replace(sep, "|")

    return [item.strip() for item in text.split("|") if item.strip()]


def normalize_string(value):
    if value is None:
        return ""
    return str(value).strip()


def extract_dex_group(question_id):
    match = re.match(r"^(\d{4})", question_id)
    if not match:
        return ""
    return match.group(1)


def row_to_question(row_dict):
    question = {
        "id": normalize_string(row_dict.get("id")),
        "image": normalize_string(row_dict.get("image")),
        "answer": normalize_string(row_dict.get("answer")),
        "aliases": split_multi_value(row_dict.get("aliases")),
        "enabled": normalize_bool(row_dict.get("enabled")),
        "region": normalize_string(row_dict.get("region")).lower(),
        "form_category": normalize_string(row_dict.get("form_category")).lower(),
        "tags": split_multi_value(row_dict.get("tags")),
    }

    note = normalize_string(row_dict.get("note"))
    if note:
        question["note"] = note

    return question


def validate_question(question, row_number):
    errors = []

    required_fields = ["id", "image", "answer", "region", "form_category"]
    for field in required_fields:
        if not question.get(field):
            errors.append(f"{row_number}行目: {field} が空です")

    if question["image"] and not question["image"].startswith("images/"):
        errors.append(f"{row_number}行目: image は images/ から始めてください")

    if question["region"] and question["region"] not in ALLOWED_REGIONS:
        errors.append(
            f"{row_number}行目: region が不正です: {question['region']}"
        )

    if question["form_category"] and question["form_category"] not in ALLOWED_FORM_CATEGORIES:
        errors.append(
            f"{row_number}行目: form_category が不正です: {question['form_category']}"
        )

    return errors


def validate_group_order(questions):
    """
    同じ図鑑番号グループのうち、最初の行は base であることを確認する。
    ユーザー定義:
    - 原種 = 同じ図鑑番号グループで Excel 上最も上の行
    """
    errors = []
    seen_groups = set()

    for index, question in enumerate(questions, start=2):
        dex_group = extract_dex_group(question["id"])
        if not dex_group:
            errors.append(
                f"{index}行目: id から図鑑番号を抽出できません: {question['id']}"
            )
            continue

        if dex_group not in seen_groups:
            seen_groups.add(dex_group)
            if question["form_category"] != "base":
                errors.append(
                    f"{index}行目: 図鑑番号 {dex_group} の最初の行は base にしてください "
                    f"(現在: {question['form_category']})"
                )

    return errors


def main():
    if len(sys.argv) < 2:
        print("使い方: python convert_excel_to_json.py pokemon_master_test.xlsx")
        sys.exit(1)

    input_path = Path(sys.argv[1]).resolve()
    if not input_path.exists():
        print(f"ファイルが見つかりません: {input_path}")
        sys.exit(1)

    output_path = input_path.with_name("questions.json")

    workbook = load_workbook(input_path, data_only=True)
    sheet = workbook.active

    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        print("Excelにデータがありません。")
        sys.exit(1)

    raw_headers = list(rows[0])
    headers = []
    for h in raw_headers:
        text = normalize_string(h)
        if text:
            headers.append(text)

    required_headers = {
        "id",
        "image",
        "answer",
        "aliases",
        "enabled",
        "region",
        "form_category",
        "tags",
    }
    missing_headers = required_headers - set(headers)
    if missing_headers:
        print(f"不足している列があります: {', '.join(sorted(missing_headers))}")
        sys.exit(1)

    questions = []
    errors = []
    seen_ids = set()

    for index, row in enumerate(rows[1:], start=2):
      row_values = list(row[:len(headers)])
      row_dict = dict(zip(headers, row_values))

      # 完全空行はスキップ
      if not any(normalize_string(v) for v in row_values):
          continue

      question = row_to_question(row_dict)

      row_errors = validate_question(question, index)
      errors.extend(row_errors)

      if question["id"] in seen_ids:
          errors.append(f"{index}行目: id が重複しています: {question['id']}")
      else:
          seen_ids.add(question["id"])

      questions.append(question)

    errors.extend(validate_group_order(questions))

    if errors:
        print("検証エラーがあります。修正してから再実行してください。")
        for error in errors:
            print(f"- {error}")
        sys.exit(1)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    counts = {}
    for question in questions:
        key = question["form_category"]
        counts[key] = counts.get(key, 0) + 1

    print(f"questions.json を出力しました: {output_path}")
    print(f"問題数: {len(questions)}")
    print("form_category 内訳:")
    for key in sorted(counts.keys()):
        print(f"  - {key}: {counts[key]}")


if __name__ == "__main__":
    main()