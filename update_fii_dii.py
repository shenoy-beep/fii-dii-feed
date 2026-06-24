import requests
import csv
import os
from datetime import datetime
import time

def fetch_fii_dii():
    session = requests.Session()
    
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.nseindia.com/",
        "Connection": "keep-alive",
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Linux"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    }

    # Step 1: Hit homepage to get cookies
    print("Getting NSE cookies...")
    session.get("https://www.nseindia.com", headers=headers, timeout=15)
    time.sleep(3)

    # Step 2: Hit a page that warms up the session
    session.get("https://www.nseindia.com/market-data/live-equity-market", headers=headers, timeout=15)
    time.sleep(2)

    # Step 3: Fetch FII/DII data
    print("Fetching FII/DII data...")
    url = "https://www.nseindia.com/api/fiidiiTradeReact"
    resp = session.get(url, headers=headers, timeout=15)
    
    print(f"Status code: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    
    resp.raise_for_status()
    data = resp.json()

    # Parse — NSE returns a list, FII is index 0, DII is index 1
    print(f"Raw data: {data}")
    
    fii_net = float(str(data[0]["netVal"]).replace(",", "").strip())
    dii_net = float(str(data[1]["netVal"]).replace(",", "").strip())

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
