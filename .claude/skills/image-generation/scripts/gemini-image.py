#!/usr/bin/env python3
"""Generate an image with Google Gemini (Nano Banana) and save it as PNG.

Usage:
  python3 gemini-image.py "prompt text" [-o output/image.png] [--aspect 16:9] [--model MODEL]

Requires GEMINI_API_KEY in the environment. Standard library only.
"""
import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("prompt")
    p.add_argument("-o", "--out", default="output/image.png")
    p.add_argument("--aspect", default="1:1", help="e.g. 1:1, 16:9, 9:16, 4:3, 3:4")
    p.add_argument("--model", default=os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image"))
    a = p.parse_args()

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY is not set")

    body = {
        "contents": [{"parts": [{"text": a.prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": a.aspect},
        },
    }
    req = urllib.request.Request(
        API.format(model=a.model),
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode(errors='replace')}")

    for cand in data.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline:
                os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
                with open(a.out, "wb") as f:
                    f.write(base64.b64decode(inline["data"]))
                print(a.out)
                return
    sys.exit("No image in response: " + json.dumps(data)[:2000])


if __name__ == "__main__":
    main()
