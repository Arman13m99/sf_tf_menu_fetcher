# config.py
import os
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────
#  Snappfood Menu Scraper Configuration
# ──────────────────────────────────────────────────────────────────────────

# Directories for input data and scraper output
DATA_DIR = Path(os.getenv("DATA_DIR", "./data")) # Can be used for tf_menu.csv, tf_info.csv
OUTPUT_DIR_MENU_SCRAPER = Path(os.getenv("OUTPUT_DIR_MENU_SCRAPER", "./output")) # Used by vendor_scrape.py standalone

# Retry and concurrency settings
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "30")) # Not actively used in current single scrape version

# API endpoint for dynamic restaurant details (Snappfood)
BASE_URL = "https://snappfood.ir/mobile/v2/restaurant/details/dynamic"

# Default geographic/location constants (use environment variables to override)
DEFAULT_LAT = os.getenv("DEFAULT_LAT", "35.6892")      # default to Tehran latitude
DEFAULT_LONG = os.getenv("DEFAULT_LONG", "51.3890")    # default to Tehran longitude

# Client and device metadata
APP_VERSION = os.getenv("APP_VERSION", "4.6.1")
UDID = os.getenv("UDID", "") # Keep UDID if your requests need it; otherwise, it can be empty
LOCATION_CACHE_KEY = os.getenv("LOCATION_CACHE_KEY", "") # Similarly, if needed
LOCALE = os.getenv("LOCALE", "fa_IR")

# Parameters sent with each request (Snappfood)
REQUEST_PARAMS = {
    "lat":              DEFAULT_LAT,
    "long":             DEFAULT_LONG,
    "optionalClient":   "WEBSITE",
    "client":           "WEBSITE",
    "deviceType":       "WEBSITE",
    "appVersion":       APP_VERSION,
    "UDID":             UDID,
    "locationCacheKey": LOCATION_CACHE_KEY,
    "show_party":       "1",
    "fetch-static-data":"1",
    "locale":           LOCALE,
    # vendorCode will be added dynamically
}

# HTTP headers for API calls (Snappfood)
USER_AGENT = os.getenv(
    "USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "  \
    "(KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"
)
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept":     "application/json",
    "Referer":    "https://snappfood.ir/",
    # Add any other necessary headers like 'x-access-token' if required by the API
}

# TapsiFood CSV file paths (NEW)
# Assuming these files are in the project root. Adjust if they are in DATA_DIR
TF_MENU_CSV_PATH = Path(os.getenv("TF_MENU_CSV_PATH", "./tf_menu.csv"))
TF_INFO_CSV_PATH = Path(os.getenv("TF_INFO_CSV_PATH", "./tf_info.csv"))
MATCHED_VENDORS_CSV_PATH = Path(os.getenv("MATCHED_VENDORS_CSV_PATH", "./matched_vendors.csv"))


# Define expected columns for consistency for the frontend (merged CSV item rows).
# We'll try to make Tapsifood data conform to this.
# Order might matter if script.js relies on PapaParse's 'columns' option with this order.
EXPECTED_MERGED_ITEM_DATA_COLS = [
    "vendor_code", "snappfood_vendor_id", # `snappfood_vendor_id` will be TF's internal primary ID for TF items, or empty
    "vendor_name", "vendor_branch", "vendor_chain",
    "business_line", "marketing_area", "address", "min_order",
    "latitude", "longitude",
    "rating", # Vendor rating. For TF, this might come from tf_info or be a default.
    "comment_count", # For TF, this might come from tf_info or be a default.
    "shifts", "tag_names",
    "is_express", "is_pro", "is_economical",
    "category_id", "category_name", "item_id", "item_title", "product_title",
    "item_variation", "description", "price",
    # item-specific rating (currently in vendor_scrape as p.get("rating",0) is put into `rating` key in the output row)
    # If TF has item-specific rating, it should map to this key too. For now, vendor level rating used for both.
    # product_toppings is the last one added by vendor_scrape for SF. TF will have "[]".
    "product_toppings"
]

# Define expected keys for the `vendor_info` object passed to frontend
# This is usually the first row of the platform's CSV.
EXPECTED_VENDOR_INFO_KEYS = [
    "vendor_code", "vendor_name", "vendor_branch",
    "vendor_chain", "business_line", "marketing_area", "address", "min_order",
    "latitude", "longitude", "rating", "comment_count", "shifts", "tag_names"
]