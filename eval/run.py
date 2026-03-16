# /// script
# requires-python = ">=3.10"
# dependencies = [
#    "requests>=2.28.0",
# ]
# ///
"""Augment prompt eval runner.

Calls the augment model with each test case, then uses an LLM judge to
verify assertions hold. Requires GEMINI_API_KEY in environment.

Usage:
    uv run eval/run.py                     # run all cases
    uv run eval/run.py --case style-anime  # run one case
    uv run eval/run.py -v                  # verbose scheme output
"""

import argparse
import base64
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds, doubles each retry

REPO_ROOT = Path(__file__).resolve().parent.parent
EVAL_DIR = Path(__file__).resolve().parent
SYSTEM_PROMPT_PATH = REPO_ROOT / "src" / "lib" / "augment-system-prompt.md"
CASES_PATH = EVAL_DIR / "cases.json"

AUGMENT_MODEL = "gemini-3-flash-preview"
JUDGE_MODEL = "gemini-3.1-flash-lite-preview"
API_BASE = "https://generativelanguage.googleapis.com/v1beta"

FIELD_KEYS = [
    "mode", "subject", "action", "scene", "composition", "style",
    "lighting", "colorPalette", "textInImage", "constraints",
    "editType", "primaryRequest", "referenceRole", "targetScene", "invariants",
]

SCHEMES_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "schemes": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    **{
                        k: {"type": "STRING", "enum": ["generate", "edit"]}
                        if k == "mode"
                        else {"type": "STRING"}
                        for k in FIELD_KEYS
                    },
                },
                "required": ["title", "description", *FIELD_KEYS],
            },
        },
    },
    "required": ["schemes"],
}

JUDGE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "pass": {"type": "BOOLEAN"},
        "reason": {"type": "STRING"},
    },
    "required": ["pass", "reason"],
}

SCORE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "score": {"type": "INTEGER"},
        "highlights": {"type": "STRING"},
        "deductions": {"type": "STRING"},
    },
    "required": ["score", "highlights", "deductions"],
}

JUDGE_SYSTEM = """\
You are a strict evaluator for a prompt augmentation system.

You receive:
1. The user's original prompt
2. The JSON output from the augmentation system (containing one or more "schemes")
3. A specific assertion to verify

Rules:
- Be strict. If the assertion says "all schemes must X", every single scheme must satisfy X.
- If even one scheme violates the assertion, the result is fail.
- For assertions about count (e.g. "exactly 1 scheme"), check the array length.
- For assertions about diversity, check that the specified fields are meaningfully different across schemes.
- For keyword/element presence checks, apply semantic matching: a phrase is present if its meaning is clearly expressed, even if the exact wording differs. For example, "红木材质的太师椅" satisfies "contains 红木太师椅"; "窗边" satisfies "contains 窗台". Do not fail on superficial wording differences when the semantic intent is identical.

Return JSON with:
- "pass": true if the assertion holds, false otherwise
- "reason": one sentence in Chinese explaining your judgment
"""

SCORE_SYSTEM = """\
You are a quality scorer for a prompt augmentation system that decomposes user \
image descriptions into structured creative schemes.

You receive:
1. The user's original prompt
2. The JSON output from the augmentation system
3. A rubric describing the scoring dimensions

Score the output from 0 to 10 (integer). Calibration:
- 10: Flawless. Every user-specified detail preserved, creative augmentation \
is excellent, fields are specific and actionable.
- 8-9: Very good. Minor imperfections (e.g. one field slightly vague, one \
scheme less creative than others).
- 6-7: Acceptable. Core intent preserved but noticeable issues (e.g. a \
user-specified field partially altered, augmented fields are generic).
- 4-5: Below average. User intent partially lost or multiple fields are vague.
- 0-3: Poor. Major violations of user intent or unusable output.

Return JSON with:
- "score": integer 0-10
- "highlights": one sentence in Chinese on what the output did well
- "deductions": one sentence in Chinese on what cost it points (or "none" if 10)
"""


def _post_with_retry(url: str, headers: dict, body: dict, timeout: int) -> dict:
    for attempt in range(MAX_RETRIES):
        try:
            res = requests.post(url, headers=headers, json=body, timeout=timeout)
            data = res.json()
            if "error" in data:
                raise RuntimeError(data["error"].get("message", str(data["error"])))
            return data
        except (requests.ConnectionError, requests.Timeout) as e:
            if attempt == MAX_RETRIES - 1:
                raise
            delay = RETRY_DELAY * (2 ** attempt)
            print(f"    [retry {attempt + 1}/{MAX_RETRIES}] {type(e).__name__}, waiting {delay}s...", flush=True)
            time.sleep(delay)


def _load_image_part(image_path: str) -> dict:
    """Load an image file as a Gemini inline_data part."""
    path = EVAL_DIR / image_path
    data = base64.b64encode(path.read_bytes()).decode()
    suffix = path.suffix.lower().lstrip(".")
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(suffix, "image/jpeg")
    return {"inline_data": {"mime_type": mime, "data": data}}


def call_augment(api_key: str, system_prompt: str, user_prompt: str, image_paths: list[str] | None = None) -> dict:
    url = f"{API_BASE}/models/{AUGMENT_MODEL}:generateContent"
    parts: list[dict] = []
    if image_paths:
        for p in image_paths:
            parts.append(_load_image_part(p))
    parts.append({"text": user_prompt})
    body = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": SCHEMES_SCHEMA,
            "thinkingConfig": {"thinkingLevel": "medium"},
        },
    }
    headers = {"Content-Type": "application/json", "x-goog-api-key": api_key}
    data = _post_with_retry(url, headers, body, timeout=120)
    parts_resp = data["candidates"][0]["content"]["parts"]
    text = next(p["text"] for p in reversed(parts_resp) if "text" in p)
    return json.loads(text)


def call_judge(
    api_key: str, user_prompt: str, schemes_json: str, assertion: str
) -> dict:
    url = f"{API_BASE}/models/{JUDGE_MODEL}:generateContent"
    user_text = (
        f"用户原始提示词：{user_prompt}\n\n"
        f"增强系统输出：\n{schemes_json}\n\n"
        f"需要验证的断言：{assertion}"
    )
    body = {
        "system_instruction": {"parts": [{"text": JUDGE_SYSTEM}]},
        "contents": [{"parts": [{"text": user_text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": JUDGE_SCHEMA,
            "thinkingConfig": {"thinkingLevel": "high"},
        },
    }
    headers = {"Content-Type": "application/json", "x-goog-api-key": api_key}
    data = _post_with_retry(url, headers, body, timeout=60)
    parts = data["candidates"][0]["content"]["parts"]
    text = next(p["text"] for p in reversed(parts) if "text" in p)
    return json.loads(text)


def call_scorer(
    api_key: str, user_prompt: str, schemes_json: str, rubric: str
) -> dict:
    url = f"{API_BASE}/models/{JUDGE_MODEL}:generateContent"
    user_text = (
        f"用户原始提示词：{user_prompt}\n\n"
        f"增强系统输出：\n{schemes_json}\n\n"
        f"评分标准：{rubric}"
    )
    body = {
        "system_instruction": {"parts": [{"text": SCORE_SYSTEM}]},
        "contents": [{"parts": [{"text": user_text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": SCORE_SCHEMA,
            "thinkingConfig": {"thinkingLevel": "high"},
        },
    }
    headers = {"Content-Type": "application/json", "x-goog-api-key": api_key}
    data = _post_with_retry(url, headers, body, timeout=60)
    parts = data["candidates"][0]["content"]["parts"]
    text = next(p["text"] for p in reversed(parts) if "text" in p)
    return json.loads(text)


class CaseResult:
    def __init__(self, case_id: str, lines: list[str], assertions: list[dict], score: int | None):
        self.case_id = case_id
        self.lines = lines
        self.assertions = assertions
        self.score = score


def run_case(
    api_key: str, system_prompt: str, case: dict, verbose: bool
) -> CaseResult:
    """Run one case: augment -> judge assertions + score."""
    case_id = case["id"]
    prompt = case["prompt"]
    image_paths: list[str] | None = case.get("images")
    assertion_texts = case["assertions"]
    rubric = case.get("rubric", "")
    lines: list[str] = []

    lines.append(f"\n{'=' * 60}")
    lines.append(f"CASE: {case_id}")
    lines.append(f"PROMPT: {prompt}")
    if image_paths:
        lines.append(f"IMAGES: {', '.join(image_paths)}")

    try:
        result = call_augment(api_key, system_prompt, prompt, image_paths)
    except Exception as e:
        lines.append(f"  AUGMENT ERROR: {e}")
        assertions = [
            {"assertion": a, "pass": False, "reason": f"augment failed: {e}"}
            for a in assertion_texts
        ]
        for r in assertions:
            lines.append(f"  [ FAIL ] {r['assertion']}")
            lines.append(f"           {r['reason']}")
        return CaseResult(case_id, lines, assertions, score=0)

    schemes = result.get("schemes", [])
    lines.append(f"SCHEMES: {len(schemes)}")

    if verbose:
        for i, s in enumerate(schemes):
            lines.append(f"  [{i + 1}] {s['title']}: {s['description']}")
            for k in FIELD_KEYS:
                v = s.get(k, "")
                if v:
                    display = v[:80] + "..." if len(v) > 80 else v
                    lines.append(f"      {k}: {display}")

    schemes_json = json.dumps(result, indent=2, ensure_ascii=False)
    lines.append(f"{'─' * 60}")

    # Judge assertions + score in parallel
    assertions = [None] * len(assertion_texts)
    score_result: dict = {}

    def judge_one(idx: int, assertion: str) -> tuple[str, int, dict]:
        try:
            judgment = call_judge(api_key, prompt, schemes_json, assertion)
            return "assert", idx, {
                "assertion": assertion,
                "pass": judgment.get("pass", False),
                "reason": judgment.get("reason", ""),
            }
        except Exception as e:
            return "assert", idx, {
                "assertion": assertion,
                "pass": False,
                "reason": f"judge error: {e}",
            }

    def score_one() -> tuple[str, int, dict]:
        try:
            s = call_scorer(api_key, prompt, schemes_json, rubric)
            return "score", 0, s
        except Exception as e:
            return "score", 0, {"score": -1, "highlights": "", "deductions": f"scorer error: {e}"}

    with ThreadPoolExecutor(max_workers=len(assertion_texts) + 1) as pool:
        futures = [pool.submit(judge_one, i, a) for i, a in enumerate(assertion_texts)]
        if rubric:
            futures.append(pool.submit(score_one))
        for f in as_completed(futures):
            kind, idx, data = f.result()
            if kind == "assert":
                assertions[idx] = data
            else:
                score_result = data

    for r in assertions:
        tag = " PASS " if r["pass"] else " FAIL "
        lines.append(f"  [{tag}] {r['assertion']}")
        lines.append(f"           {r['reason']}")

    score = score_result.get("score") if score_result else None
    if score is not None and score >= 0:
        lines.append(f"  SCORE: {score}/10")
        lines.append(f"    + {score_result.get('highlights', '')}")
        deductions = score_result.get("deductions", "")
        if deductions and deductions.lower() != "none":
            lines.append(f"    - {deductions}")
    elif score_result:
        lines.append(f"  SCORE: error - {score_result.get('deductions', 'unknown')}")

    return CaseResult(case_id, lines, assertions, score=max(score, 0) if score is not None else None)


def main():
    parser = argparse.ArgumentParser(description="Augment prompt eval runner")
    parser.add_argument("--case", help="Run a specific case by ID")
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Show full scheme output"
    )
    parser.add_argument(
        "-j", "--parallel", type=int, default=1, metavar="N",
        help="Run N cases in parallel (default: 1, sequential)",
    )
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

    system_prompt = SYSTEM_PROMPT_PATH.read_text()
    cases = json.loads(CASES_PATH.read_text())

    if args.case:
        cases = [c for c in cases if c["id"] == args.case]
        if not cases:
            print(f"Error: case '{args.case}' not found", file=sys.stderr)
            sys.exit(1)

    all_cases: list[CaseResult] = []
    parallelism = max(1, args.parallel)

    if parallelism == 1:
        for case in cases:
            cr = run_case(api_key, system_prompt, case, args.verbose)
            print("\n".join(cr.lines), flush=True)
            all_cases.append(cr)
    else:
        print(f"Running {len(cases)} cases with parallelism={parallelism}", flush=True)
        with ThreadPoolExecutor(max_workers=parallelism) as pool:
            futures = {
                pool.submit(run_case, api_key, system_prompt, c, args.verbose): c["id"]
                for c in cases
            }
            for f in as_completed(futures):
                cr = f.result()
                print("\n".join(cr.lines), flush=True)
                all_cases.append(cr)

    # Summary
    total_assertions = sum(len(cr.assertions) for cr in all_cases)
    passed_assertions = sum(1 for cr in all_cases for a in cr.assertions if a["pass"])
    failed_assertions = total_assertions - passed_assertions

    scores = [cr.score for cr in all_cases if cr.score is not None]
    avg_score = sum(scores) / len(scores) if scores else 0

    print(f"\n{'=' * 60}", flush=True)
    print(f"ASSERTIONS: {passed_assertions}/{total_assertions} passed", flush=True)

    # Per-case score table
    if scores:
        print(f"\nSCORES:", flush=True)
        for cr in all_cases:
            s = f"{cr.score}/10" if cr.score is not None else "n/a"
            print(f"  {cr.case_id:.<30s} {s}", flush=True)
        print(f"  {'AVERAGE':.<30s} {avg_score:.1f}/10", flush=True)

    if failed_assertions > 0:
        print(f"\nFailed:", flush=True)
        for cr in all_cases:
            for r in cr.assertions:
                if not r["pass"]:
                    print(f"  {cr.case_id}: {r['assertion']}", flush=True)
                    print(f"    -> {r['reason']}", flush=True)
        sys.exit(1)
    else:
        print("\nAll assertions passed.", flush=True)


if __name__ == "__main__":
    main()
