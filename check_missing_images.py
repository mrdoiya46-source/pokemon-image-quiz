import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
QUESTIONS_JSON = BASE_DIR / "questions.json"
IMAGES_DIR = BASE_DIR / "images"
OUTPUT_TXT = BASE_DIR / "missing_images.txt"


def main():
    if not QUESTIONS_JSON.exists():
        print(f"questions.json が見つかりません: {QUESTIONS_JSON}")
        return

    if not IMAGES_DIR.exists():
        print(f"images フォルダが見つかりません: {IMAGES_DIR}")
        return

    with open(QUESTIONS_JSON, "r", encoding="utf-8") as f:
        questions = json.load(f)

    missing = []
    existing = []
    duplicated_paths = set()
    seen_paths = set()

    for q in questions:
        image_path = str(q.get("image", "")).strip()
        question_id = str(q.get("id", "")).strip()
        answer = str(q.get("answer", "")).strip()
        form_category = str(q.get("form_category", "")).strip()
        region = str(q.get("region", "")).strip()

        if not image_path:
            missing.append({
                "id": question_id,
                "answer": answer,
                "form_category": form_category,
                "region": region,
                "image": "(空欄)"
            })
            continue

        if image_path in seen_paths:
            duplicated_paths.add(image_path)
        seen_paths.add(image_path)

        # questions.json の image は "images/xxxx.png" の形を想定
        relative_image = Path(image_path)
        filename = relative_image.name
        actual_file = IMAGES_DIR / filename

        if actual_file.exists():
            existing.append(image_path)
        else:
            missing.append({
                "id": question_id,
                "answer": answer,
                "form_category": form_category,
                "region": region,
                "image": image_path
            })

    print("=== 画像チェック結果 ===")
    print(f"問題数: {len(questions)}")
    print(f"存在する画像: {len(existing)}")
    print(f"不足画像: {len(missing)}")
    print(f"重複参照パス数: {len(duplicated_paths)}")

    lines = []
    lines.append("不足画像一覧\n")
    lines.append(f"問題数: {len(questions)}")
    lines.append(f"存在する画像: {len(existing)}")
    lines.append(f"不足画像: {len(missing)}")
    lines.append(f"重複参照パス数: {len(duplicated_paths)}\n")

    if duplicated_paths:
        lines.append("重複参照されている image パス")
        for path in sorted(duplicated_paths):
            lines.append(path)
        lines.append("")

    if missing:
        lines.append("不足画像詳細")
        for item in missing:
            lines.append(
                f"{item['id']} | {item['answer']} | {item['form_category']} | "
                f"{item['region']} | {item['image']}"
            )
    else:
        lines.append("不足画像はありません。")

    with open(OUTPUT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nmissing_images.txt を出力しました: {OUTPUT_TXT}")


if __name__ == "__main__":
    main()