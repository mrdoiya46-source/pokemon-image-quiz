from __future__ import annotations

import argparse
import csv
import re
import sys
import time
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

DEFAULT_SOURCE_URL = "https://zukan.pokemon.co.jp/?word=%E3%83%A1%E3%82%AC&no_min=1&no_max=1025"
BASE_SITE = "https://zukan.pokemon.co.jp"

BLOCKLIST = (
    "logo", "twitter", "facebook", "line", "sns", "icon", "favicon",
    "pagetop", "banner", "share", "header", "footer", "common"
)

@dataclass
class Entry:
    row_num: int
    row_id: str
    name: str
    form_category: str
    region: str
    image_path: str

    @property
    def base_no(self) -> str:
        return self.row_id.split("-", 1)[0]

def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("　", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text

def compact(text: str) -> str:
    text = normalize_text(text).lower()
    for ch in (" ", "(", ")", "・", "/", "／", "-", "_", ":", "：", "、", ",", ".", "．", "　"):
        text = text.replace(ch, "")
    return text

def parse_missing_images(txt_path: Path) -> list[Entry]:
    lines = txt_path.read_text(encoding="utf-8").splitlines()
    entries: list[Entry] = []
    pattern = re.compile(r"^\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*$")

    started = False
    row_num = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("不足画像詳細"):
            started = True
            continue
        if not started:
            continue
        m = pattern.match(line)
        if not m:
            continue

        row_num += 1
        row_id, name, form_category, region, image_path = [normalize_text(x) for x in m.groups()]
        entries.append(
            Entry(
                row_num=row_num,
                row_id=row_id,
                name=name,
                form_category=form_category,
                region=region,
                image_path=image_path,
            )
        )
    return entries

def build_queries(entry: Entry) -> list[tuple[str, str]]:
    name = normalize_text(entry.name)
    queries: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add(query: str, strategy: str) -> None:
        query = normalize_text(query)
        if query and query not in seen:
            seen.add(query)
            queries.append((query, strategy))

    add(name, "exact")

    if name.startswith("メガ"):
        stripped = name[2:]
        add(stripped, "drop_mega")

        if re.search(r"[XYZ]$", stripped):
            add(stripped[:-1], "drop_suffix_letter")
            add(name[:-1], "drop_suffix_letter_keep_mega")

        base_species = stripped.split(" ", 1)[0]
        add(base_species, "base_species")
    else:
        add(name.split(" ", 1)[0], "base_species")

    return queries

def score_candidate(entry: Entry, query: str, strategy: str, cand: dict) -> int:
    text = compact(cand.get("text", ""))
    href = compact(cand.get("href", ""))
    row_id_attr = compact(cand.get("id_attr", ""))
    target = compact(entry.name)
    query_c = compact(query)
    base_species = compact(entry.name[2:] if entry.name.startswith("メガ") else entry.name).split(" ", 1)[0]
    base_no = entry.base_no

    score = 0
    if text == target:
        score += 800
    if target and target in text:
        score += 280
    if query_c == text:
        score += 220
    if query_c and query_c in text:
        score += 140
    if base_species and base_species in text:
        score += 90
    if base_no in href or base_no in row_id_attr or base_no in compact(cand.get("detail_id", "")):
        score += 80

    if strategy == "exact":
        score += 20
    elif strategy in ("drop_suffix_letter", "drop_suffix_letter_keep_mega", "base_species"):
        score -= 5

    hay = " ".join(
        [cand.get("text", ""), cand.get("href", ""), cand.get("img_src", ""), cand.get("class_name", "")]
    ).lower()
    if any(token in hay for token in BLOCKLIST):
        score -= 500

    score += int(cand.get("img_w", 0) * cand.get("img_h", 0) / 2500)
    return score

JS_COLLECT_RESULT_CARDS = r"""
() => {
  const isVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (!style) return false;
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) return false;
    return rect.bottom > 0 && rect.right > 0;
  };

  const area = (rect) => rect.width * rect.height;
  const roots = Array.from(document.querySelectorAll('[id^="item"], a, li, article, section, div'));
  const out = [];
  const seen = new Set();

  for (const root of roots) {
    if (!isVisible(root)) continue;

    const text = (root.innerText || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2) continue;

    const imgs = Array.from(root.querySelectorAll('img')).filter(isVisible);
    if (!imgs.length) continue;

    const bestImg = imgs.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return area(rb) - area(ra);
    })[0];

    const ir = bestImg.getBoundingClientRect();
    if (ir.width < 80 || ir.height < 80) continue;

    const anchor = root.matches('a[href]') ? root : root.querySelector('a[href]');
    const href = anchor ? anchor.href : '';
    const idAttr = root.id || '';
    const key = [text.slice(0, 120), href, bestImg.currentSrc || bestImg.src || '', idAttr].join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      text,
      href,
      id_attr: idAttr,
      class_name: String(root.className || ''),
      img_src: bestImg.currentSrc || bestImg.src || '',
      img_x: ir.x + window.scrollX,
      img_y: ir.y + window.scrollY,
      img_w: ir.width,
      img_h: ir.height,
      root_x: root.getBoundingClientRect().x + window.scrollX,
      root_y: root.getBoundingClientRect().y + window.scrollY,
      root_w: root.getBoundingClientRect().width,
      root_h: root.getBoundingClientRect().height,
      detail_id: (() => {
        const m = (href || '').match(/\/detail\/([0-9]{4}(?:-[0-9]+)?)/);
        return m ? m[1] : '';
      })(),
    });
  }

  out.sort((a, b) => (b.img_w * b.img_h) - (a.img_w * a.img_h));
  return out.slice(0, 500);
}
"""

JS_PICK_DETAIL_MAIN_IMAGE = r"""
() => {
  const block = /logo|twitter|facebook|line|sns|icon|favicon|pagetop|banner|share|header|footer|common/i;

  const isVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (!style) return false;
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 120) return false;
    return rect.bottom > 0 && rect.right > 0;
  };

  const imgs = Array.from(document.querySelectorAll('img')).filter(isVisible);
  const candidates = [];

  for (const img of imgs) {
    const rect = img.getBoundingClientRect();
    const meta = [
      img.currentSrc || img.src || '',
      img.alt || '',
      img.id || '',
      String(img.className || '')
    ].join(' ');
    if (block.test(meta)) continue;

    let score = rect.width * rect.height;
    if (rect.top < 900) score += 200000;
    if (rect.width >= 250 && rect.height >= 250) score += 120000;
    if ((img.currentSrc || img.src || '').match(/pokemon|zukan|detail/i)) score += 30000;
    if ((img.currentSrc || img.src || '').match(/\.(png|webp|jpg|jpeg)(\?|$)/i)) score += 15000;

    candidates.push({
      src: img.currentSrc || img.src || '',
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
      w: rect.width,
      h: rect.height,
      score
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}
"""

def safe_goto(page, url: str, wait_ms: int = 1200) -> None:
    try:
        page.goto(url, wait_until="networkidle", timeout=30000)
    except PlaywrightTimeoutError:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(wait_ms)

def scroll_page(page) -> None:
    for _ in range(5):
        page.mouse.wheel(0, 1800)
        page.wait_for_timeout(350)
    page.mouse.wheel(0, -5000)
    page.wait_for_timeout(300)

def choose_best_card(entry: Entry, query: str, strategy: str, cards: list[dict]) -> tuple[Optional[dict], list[tuple[int, dict]]]:
    scored = sorted(
        [(score_candidate(entry, query, strategy, c), c) for c in cards],
        key=lambda x: x[0],
        reverse=True,
    )
    if not scored:
        return None, []

    best_score, best = scored[0]
    second_score = scored[1][0] if len(scored) >= 2 else -9999

    if best_score < 180:
        return None, scored
    if best_score - second_score < 30 and best_score < 500:
        return None, scored

    return best, scored

def save_clip(page, clip: dict, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(
        path=str(out_path),
        clip={
            "x": max(0, float(clip["x"])),
            "y": max(0, float(clip["y"])),
            "width": max(1.0, float(clip["w"])),
            "height": max(1.0, float(clip["h"])),
        },
        omit_background=True,
    )

def save_from_detail(context, detail_url: str, out_path: Path) -> tuple[bool, str]:
    page = context.new_page()
    try:
        safe_goto(page, detail_url)
        scroll_page(page)
        candidates = page.evaluate(JS_PICK_DETAIL_MAIN_IMAGE)
        if not candidates:
            page.close()
            return False, "detail_main_image_not_found"

        best = candidates[0]
        save_clip(page, {"x": best["x"], "y": best["y"], "w": best["w"], "h": best["h"]}, out_path)
        src = best.get("src", "")
        page.close()
        return True, f"detail:{src}"
    except Exception as e:
        try:
            page.close()
        except Exception:
            pass
        return False, f"detail_error:{e!r}"

def zip_images(root_dir: Path, zip_path: Path) -> None:
    if not root_dir.exists():
        return
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(root_dir.rglob("*")):
            if p.is_file():
                zf.write(p, arcname=p.relative_to(root_dir.parent))

def run(missing_txt: Path, output_dir: Path, zip_name: str, headless: bool, skip_existing: bool) -> int:
    entries = parse_missing_images(missing_txt)
    if not entries:
        print("テキストファイルから対象行を読み取れませんでした。", file=sys.stderr)
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / "download_report.csv"
    zip_path = output_dir.parent / zip_name

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={"width": 1600, "height": 2200},
            device_scale_factor=2,
            locale="ja-JP",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        with report_path.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow([
                "row_num", "id", "name", "query_used", "strategy", "selected_text",
                "selected_href", "selected_detail_id", "status", "note"
            ])

            for i, entry in enumerate(entries, start=1):
                out_path = output_dir / entry.image_path
                out_path.parent.mkdir(parents=True, exist_ok=True)

                print(f"[{i}/{len(entries)}] {entry.row_id} {entry.name}")

                if skip_existing and out_path.exists():
                    writer.writerow([entry.row_num, entry.row_id, entry.name, "", "", "", "", "", "skipped_existing", ""])
                    print("  -> skipped_existing")
                    continue

                resolved = False
                last_note = ""

                for query, strategy in build_queries(entry):
                    search_url = f"{BASE_SITE}/?word={quote(query)}&no_min={int(entry.base_no)}&no_max={int(entry.base_no)}"

                    try:
                        safe_goto(page, search_url)
                        scroll_page(page)
                        cards = page.evaluate(JS_COLLECT_RESULT_CARDS)
                        selected, scored = choose_best_card(entry, query, strategy, cards)

                        if selected is None:
                            last_note = " | ".join(
                                [f"{c.get('detail_id','') or c.get('id_attr','')}: {c.get('text','')[:40]} : {score}" for score, c in scored[:5]]
                            )
                            continue

                        href = selected.get("href", "")
                        detail_id = selected.get("detail_id", "")

                        if href and "/detail/" in href:
                            ok, src_note = save_from_detail(context, href, out_path)
                            if ok:
                                writer.writerow([
                                    entry.row_num, entry.row_id, entry.name, query, strategy,
                                    selected.get("text", ""), href, detail_id, "downloaded_detail", src_note
                                ])
                                print(f"  -> downloaded_detail ({strategy})")
                                resolved = True
                                break

                        save_clip(
                            page,
                            {
                                "x": selected["img_x"],
                                "y": selected["img_y"],
                                "w": selected["img_w"],
                                "h": selected["img_h"],
                            },
                            out_path,
                        )
                        writer.writerow([
                            entry.row_num, entry.row_id, entry.name, query, strategy,
                            selected.get("text", ""), href, detail_id, "downloaded_search_card",
                            selected.get("img_src", "")
                        ])
                        print(f"  -> downloaded_search_card ({strategy})")
                        resolved = True
                        break

                    except Exception as e:
                        last_note = repr(e)
                        continue

                if not resolved:
                    writer.writerow([
                        entry.row_num, entry.row_id, entry.name, "", "", "", "", "", "unresolved", last_note
                    ])
                    print("  -> unresolved")

                time.sleep(0.15)

        browser.close()

    zip_images(output_dir / "images", zip_path)
    print(f"完了: {report_path}")
    print(f"ZIP: {zip_path}")
    return 0

def main() -> int:
    parser = argparse.ArgumentParser(
        description="missing_images.txt を使って、ポケモンずかんから不足画像を取得します。"
    )
    parser.add_argument("missing_txt", help="missing_images.txt のパス")
    parser.add_argument("--output-dir", default="missing_images_download_output", help="出力先")
    parser.add_argument("--zip-name", default="missing_images_download.zip", help="ZIP名")
    parser.add_argument("--headless", action="store_true", help="ヘッドレス実行")
    parser.add_argument("--skip-existing", action="store_true", help="既存画像を再取得しない")
    args = parser.parse_args()

    return run(
        missing_txt=Path(args.missing_txt),
        output_dir=Path(args.output_dir),
        zip_name=args.zip_name,
        headless=args.headless,
        skip_existing=args.skip_existing,
    )

if __name__ == "__main__":
    raise SystemExit(main())
