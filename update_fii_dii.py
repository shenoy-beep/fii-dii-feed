import requests
import csv
import os
from datetime import datetime

def fetch_fii_dii():
    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nseindia.com",
        "Accept-Language": "en-US,en;q=0.9",
    }
    session.get("https://www.nseindia.com", headers=headers, timeout=10)
    url = "https://www.nseindia.com/api/fiidiiTradeReact"
    resp = session.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    fii_net = float(str(data[0]["netVal"]).replace(",", ""))
    dii_net = float(str(data[1]["netVal"]).replace(",", ""))
    print(f"✅ FII Net: ₹{fii_net} Cr | DII Net: ₹{dii_net} Cr")
    return fii_net, dii_net

def update_csv(filepath, value):
    today = datetime.now().strftime("%Y-%m-%d")
    row = [today, "00:00", value, value, value, value, 0]

    rows = []
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            rows = list(csv.reader(f))

    header = ["Date", "Time", "Open", "High", "Low", "Close", "Volume"]
    if not rows:
        rows.append(header)

    updated = False
    for i, r in enumerate(rows):
        if r and r[0] == today:
            rows[i] = row
            updated = True
            break
    if not updated:
        rows.append(row)

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", newline="") as f:
        csv.writer(f).writerows(rows)
    print(f"✅ Updated {filepath}")

if __name__ == "__main__":
    fii, dii = fetch_fii_dii()
    update_csv("data/FII_NET/data.csv", fii)
    update_csv("data/DII_NET/data.csv", dii)
