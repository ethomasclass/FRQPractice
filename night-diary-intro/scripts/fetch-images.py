"""Downloads the Wikimedia Commons images into public/images/originals/ and records
their source and license in src/data/image-credits.json (used to write CREDITS.md).

Wikimedia rate-limits aggressively; this script is patient and resumable (skips files it has).
Usage: python3 scripts/fetch-images.py
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commons import api, download

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(ROOT, "public", "images", "originals")
CREDITS = os.path.join(ROOT, "src", "data", "image-credits.json")

IMAGES = {
    "gandhi": "Mahatma-Gandhi,_studio,_1931.jpg",
    "nehru": "Pt_Jawaharlal_Nehru.jpg",
    "jinnah": "Jinnah1945c.jpg",
    "mountbatten": "Lord_Louis_Mountbatten,_Bestanddeelnr_902-0486.jpg",
    # Refugee trains and migration, from Category:Partition of India
    "refugees-train": "Hindus_and_Sikh_on_train_to_India.jpg",
    "refugees-train-punjab": "A_refugee_train,_Punjab,_1947.jpg",
    "refugees-columns": "Columns_of_refugees_from_West_Punjab.jpg",
    "refugees-to-india": "Refugees_en_route_to_India.jpg",
    "refugees-to-pakistan": "Refugees_en_route_to_Pakistan;.jpg",
}


def main():
    os.makedirs(ORIG, exist_ok=True)
    credits = json.load(open(CREDITS)) if os.path.exists(CREDITS) else {}
    for key, title in IMAGES.items():
        dest = os.path.join(ORIG, key + ".jpg")
        ok = os.path.exists(dest) and open(dest, "rb").read(3) == b"\xff\xd8\xff"
        if ok and key in credits:
            print("have", key)
            continue
        meta = download(title.replace("_", " "), dest)
        credits[key] = meta
        json.dump(credits, open(CREDITS, "w"), indent=2)
        print("got", key, meta["license"])
    if "--list-refugees" in sys.argv:
        d = api(action="query", list="categorymembers", cmtitle="Category:Partition of India refugees",
                cmlimit=500, cmtype="file")
        for m in d["query"]["categorymembers"]:
            print(m["title"])


if __name__ == "__main__":
    main()
