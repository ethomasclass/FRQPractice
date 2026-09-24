"""Small Wikimedia Commons helper: polite API calls with retry, file download with validation."""
import json, subprocess, sys, time, urllib.parse

UA = "NightDiaryIntroBuild/1.0 (https://github.com/ethomasclass/frqpractice; classroom video)"
API = "https://commons.wikimedia.org/w/api.php"


def get(url, retries=60):
    for i in range(retries):
        # curl rather than urllib: Wikimedia's rate limiter is much stricter with python-urllib.
        r = subprocess.run(["curl", "-sL", "-A", UA, "-w", "\n%{http_code} %{content_type}", url],
                           capture_output=True)
        body, _, status = r.stdout.rpartition(b"\n")
        code, _, ctype = status.decode().partition(" ")
        if code == "200":
            return body, ctype
        wait = min(120, 2 ** (i + 2))
        print(f"  HTTP {code}; retry {i+1} in {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError(f"failed: {url}")


def api(**params):
    params.update(format="json", formatversion="2")
    body, _ = get(API + "?" + urllib.parse.urlencode(params))
    return json.loads(body)


def info(title, width=1600):
    """Return thumb url, page url and license metadata for a File: title."""
    if not title.startswith("File:"):
        title = "File:" + title
    d = api(action="query", titles=title, prop="imageinfo",
            iiprop="url|extmetadata|size|mime", iiurlwidth=width)
    page = d["query"]["pages"][0]
    if "imageinfo" not in page:
        return None
    ii = page["imageinfo"][0]
    md = ii.get("extmetadata", {})
    val = lambda k: md.get(k, {}).get("value", "")
    return {
        "title": page["title"],
        "thumb": ii.get("thumburl") or ii["url"],
        "page": ii["descriptionurl"],
        "license": val("LicenseShortName"),
        "artist": val("Artist"),
        "credit": val("Credit"),
        "date": val("DateTimeOriginal"),
        "desc": val("ImageDescription"),
        "mime": ii.get("mime"),
        "size": [ii.get("width"), ii.get("height")],
    }


def download(title, dest, width=1600):
    meta = info(title, width)
    if meta is None:
        raise RuntimeError(f"missing: {title}")
    body, ctype = get(meta["thumb"])
    if not ctype.startswith("image/") or body[:15].lower().startswith(b"<!doctype html"):
        raise RuntimeError(f"not an image: {title} ({ctype})")
    open(dest, "wb").write(body)
    time.sleep(1.5)
    return meta
