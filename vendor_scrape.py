import time
import csv
import json
import logging
from pathlib import Path
import webbrowser
import os
import sys
import subprocess
import io

# concurrent.futures and pandas might not be strictly needed if only scraping one
# but good to keep if you expand
# from concurrent.futures import ThreadPoolExecutor, as_completed # Not used for single vendor scrape
import pandas as pd # Used for Timestamp
import requests

try:
    import config # Your scraper's config file
except ImportError:
    # This path is for when script is run directly
    print("Error: config.py not found. Please ensure it's in the same directory or PYTHONPATH.")
    sys.exit(1)


def configure_logging() -> logging.Logger:
    """Configures and returns a logger for the scraper."""
    logger = logging.getLogger("VendorMenuFastScraper")
    if not logger.handlers: # Avoid adding multiple handlers if called again
        # Clear existing handlers if any were added by mistake from other contexts
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)
            handler.close()

        handler = logging.StreamHandler(sys.stdout) # Ensure logs go to stdout for CLI
        fmt = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        handler.setFormatter(fmt)
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


class VendorMenuFastScraper:
    """Scrapes menu data for a single Snappfood vendor."""

    def __init__(self, vendor_code: str):
        """Initializes the scraper with vendor code and configuration."""
        self.data_dir = config.DATA_DIR
        self.output_dir = config.OUTPUT_DIR_MENU_SCRAPER # Used by CLI mode
        self.max_retries = config.MAX_RETRIES
        self.base_url = config.BASE_URL
        self.default_params = config.REQUEST_PARAMS.copy()
        self.headers = config.REQUEST_HEADERS
        self.vendor_code = vendor_code.strip() # Ensure no leading/trailing whitespace

        self.output_dir.mkdir(parents=True, exist_ok=True) # Ensure output dir exists
        self.logger = configure_logging() # Use the shared logger configuration
        self.last_error_message = None

    def fetch_vendor_json(self, code: str) -> dict | None:
        """Fetches the raw JSON data for the vendor from the API."""
        self.last_error_message = None
        params = self.default_params.copy()
        params["vendorCode"] = code
        request_url = f"{self.base_url}?{'&'.join([f'{k}={v}' for k, v in params.items()])}"
        self.logger.debug(f"Requesting URL: {request_url}")

        for attempt in range(1, self.max_retries + 1):
            try:
                if not isinstance(self.headers, dict) or 'User-Agent' not in self.headers:
                    self.logger.error("Request headers are not configured correctly in config.py.")
                    self.last_error_message = "Request headers misconfiguration."
                    return None

                resp = requests.get(self.base_url, params=params, headers=self.headers, timeout=20)
                resp.raise_for_status()
                return resp.json()

            except requests.HTTPError as e:
                status = resp.status_code if hasattr(resp, 'status_code') else 'Unknown'
                self.last_error_message = f"HTTPError for {code} (Status: {status}) on attempt {attempt}: {e}"
                if status in (400, 404, "400", "404"): # API might return status as string
                    self.logger.warning(f"Vendor {code} invalid or not found (HTTP {status}), skipping.")
                    return None 
                self.logger.error(self.last_error_message)
            except requests.exceptions.Timeout:
                 self.last_error_message = f"Timeout error for {code} on attempt {attempt}."
                 self.logger.warning(self.last_error_message + " Retrying...")
            except requests.RequestException as e:
                self.last_error_message = f"Network error for {code} on attempt {attempt}: {e}"
                self.logger.error(self.last_error_message)
            except json.JSONDecodeError as e:
                 self.last_error_message = f"Failed to decode JSON response for {code} on attempt {attempt}: {e}"
                 self.logger.error(self.last_error_message)
                 self.logger.debug(f"Response text was: {getattr(resp, 'text', 'N/A')}")
                 return None
            except Exception as e:
                self.last_error_message = f"Unexpected error during fetch for {code} on attempt {attempt}: {e}"
                self.logger.error(self.last_error_message, exc_info=True)

            if attempt < self.max_retries:
                time.sleep(attempt * 1.5)

        self.logger.error(f"Failed to fetch data for {code} after {self.max_retries} attempts.")
        if not self.last_error_message:
             self.last_error_message = f"Failed to fetch data for {code} after multiple retries and no specific error captured."
        return None

    def parse_menu_items(self, data: dict, vendor_code: str) -> list[dict]:
        if not data or "data" not in data or not isinstance(data["data"], dict):
            self.logger.warning(f"Malformed or empty 'data' section for vendor {vendor_code}.")
            return []
        vendor_section = data["data"].get("vendor", {}) # Default to empty dict
        business_line_map = {
            'RESTAURANT': 'Restaurant', 'CAFFE': 'Cafe', 'CONFECTIONERY': 'Pastry',
            'BAKERY': 'Bakery', 'GROCERY': 'Fruit Shop', 'SUPERMARKET': 'Supermarket',
            'PROTEIN': 'Meat Shop', 'JUICE': 'Ice Cream and Juice Shop', 'OTHER': 'Other',
        }
        api_business_line = vendor_section.get("superTypeAlias", "")
        translated_business_line = business_line_map.get(api_business_line.upper(), api_business_line)
        if not translated_business_line and api_business_line:
             self.logger.info(f"Business line '{api_business_line}' for vendor {vendor_code} not found in translation map.")
        vendor_info = {
            "vendor_code":         vendor_code,
            "snappfood_vendor_id": vendor_section.get("id"),
            "vendor_name":         vendor_section.get("title", ""),
            "vendor_branch":       vendor_section.get("branchTitle", ""),
            "vendor_chain":        vendor_section.get("chainTitle", ""),
            "business_line":       translated_business_line,
            "marketing_area":      vendor_section.get("area", ""),
            "address":             vendor_section.get("address", ""),
            "min_order":           vendor_section.get("minOrder", 0),
            "latitude":            vendor_section.get("lat"),
            "longitude":           vendor_section.get("lon"),
            "rating":              vendor_section.get("rating"),
            "comment_count":       vendor_section.get("commentCount"),
            "shifts":              json.dumps(vendor_section.get("schedules") or [], ensure_ascii=False, indent=None, separators=(',', ':')),
            "tag_names":           json.dumps(vendor_section.get("tagNames") or [], ensure_ascii=False, indent=None, separators=(',', ':')),
            "is_express":          bool(vendor_section.get("isZFExpress", False)),
            "is_pro":              bool(vendor_section.get("isPro", False)),
            "is_economical":       bool(vendor_section.get("isEconomical", False))
        }
        items = []
        BANNED_CATEGORY_NAMES = ["آبکیجات", "مواد اولیه", "سایر"] # Define your banned list
        menus_data = data["data"].get("menus", [])
        if not isinstance(menus_data, list):
            self.logger.warning(f"Menus data section is not a list for {vendor_code}.")
            menus_data = []
        for cat_idx, cat in enumerate(menus_data):
            if not isinstance(cat, dict):
                 self.logger.debug(f"Skipping malformed category at index {cat_idx} for vendor {vendor_code}")
                 continue
            cname = cat.get("category", f"Unknown Category {cat_idx+1}")
            if cname in BANNED_CATEGORY_NAMES:
                self.logger.info(f"Skipping banned category '{cname}' for vendor {vendor_code}.")
                continue # Skip to the next category
            products_data = cat.get("products", [])
            if not isinstance(products_data, list):
                self.logger.debug(f"Products data for category '{cname}' is not a list for vendor {vendor_code}")
                continue
            for prod_idx, p in enumerate(products_data):
                if not isinstance(p, dict):
                    self.logger.debug(f"Skipping malformed product at index {prod_idx} in '{cname}' for vendor {vendor_code}")
                    continue
                toppings_structure = []
                product_toppings_data = p.get("productToppings", [])
                if isinstance(product_toppings_data, list):
                    for grp_idx, grp in enumerate(product_toppings_data):
                        if not isinstance(grp, dict):
                            self.logger.debug(f"Skipping malformed topping group {grp_idx} for product ID {p.get('id', 'N/A')}")
                            continue
                        toppings_list = []
                        inner_toppings = grp.get("toppings", [])
                        if isinstance(inner_toppings, list):
                             for t_idx, t_data in enumerate(inner_toppings): # Renamed t to t_data
                                if isinstance(t_data, dict):
                                    toppings_list.append({
                                        "id": t_data.get("id"), "title": t_data.get("title", ""),
                                        "description": t_data.get("description", ""), "price": t_data.get("price", 0)
                                    })
                                else:
                                     self.logger.debug(f"Skipping malformed topping {t_idx} in group {grp.get('id', 'N/A')}")
                        toppings_structure.append({
                            "group_index": grp_idx, "id": grp.get("id"), "title": grp.get("title", ""),
                            "maxCount": grp.get("maxCount", 1), "minCount": grp.get("minCount", 0),
                            "toppings": toppings_list
                        })
                elif product_toppings_data is not None:
                    self.logger.debug(f"productToppings for item ID {p.get('id')} is not a list: {type(product_toppings_data)}")
                row = {
                    **vendor_info,
                    "category_id":      cat.get("categoryId"), "category_name":    cname,
                    "item_id":          p.get("id"), "item_title":       p.get("title", ""),
                    "product_title":    p.get("productTitle", ""),
                    "item_variation":   p.get("productVariationTitle", ""),
                    "description":      p.get("description", ""), "price": p.get("price", 0),
                    "rating":           p.get("rating", 0),
                    "product_toppings": json.dumps(toppings_structure, ensure_ascii=False, indent=None, separators=(',', ':')),
                }
                items.append(row)
        return items

    def run(self, return_content_as_string=False) -> Path | str | None:
        self.logger.info(f"Starting scrape for vendor: {self.vendor_code}")
        self.last_error_message = None

        data = self.fetch_vendor_json(self.vendor_code)
        if data is None:
            self.logger.error(f"Failed to fetch/decode data for {self.vendor_code}. Error: {self.last_error_message or 'Unknown fetch error'}")
            return None

        self.logger.info(f"Parsing menu items for {self.vendor_code}")
        items = self.parse_menu_items(data, self.vendor_code)
        if not items:
            msg = f"No menu items found/parsed for {self.vendor_code}."
            self.logger.warning(msg)
            if not self.last_error_message: self.last_error_message = msg
            return None

        self.logger.info(f"Parsed {len(items)} menu items for {self.vendor_code}.")
        timestamp = pd.Timestamp.now().strftime("%Y%m%d_%H%M%S")
        safe_vendor_code = ''.join(filter(str.isalnum, self.vendor_code))
        out_filename = f"vendor_menu_{safe_vendor_code}_{timestamp}.csv"
        
        try:
            if not items: # Should be caught, but defensive.
                 self.last_error_message = "CSV Error: 'items' list is empty."
                 self.logger.error(self.last_error_message)
                 return None
            keys = items[0].keys()

            if return_content_as_string:
                string_io = io.StringIO()
                writer = csv.DictWriter(string_io, fieldnames=keys, quoting=csv.QUOTE_MINIMAL)
                writer.writeheader()
                writer.writerows(items)
                csv_content = '\ufeff' + string_io.getvalue()
                string_io.close()
                self.logger.info(f"✅ CSV content generated in memory for {self.vendor_code}.")
                return csv_content
            else: # Write to file (CLI mode)
                out_path = self.output_dir / out_filename
                self.logger.info(f"Writing {len(items)} items to CSV: {out_path}")
                with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
                    writer = csv.DictWriter(f, fieldnames=keys, quoting=csv.QUOTE_MINIMAL)
                    writer.writeheader()
                    writer.writerows(items)
                self.logger.info(f"✅ Successfully wrote CSV to {out_path.resolve()}")
                return out_path
        except Exception as e: # Catch more general errors during CSV generation/writing
            self.last_error_message = f"Error during CSV processing for {self.vendor_code}: {e}"
            self.logger.error(self.last_error_message, exc_info=True)
            return None

def open_file_or_directory(path_str: str):
    path = Path(path_str).resolve()
    logger = configure_logging() # Get main logger instance
    try:
        if sys.platform == 'win32': os.startfile(path)
        elif sys.platform == 'darwin': subprocess.run(['open', path], check=True)
        else: subprocess.run(['xdg-open', path], check=True)
        logger.debug(f"Successfully opened: {path}")
        return True
    except FileNotFoundError:
         logger.error(f"Could not open '{path}'. File/directory not found.")
         return False
    except Exception as e:
        logger.error(f"Could not open '{path}': {e}")
        return False

if __name__ == "__main__":
    cli_logger = configure_logging() # Ensure logger is set up for CLI use

    vendor_code_input = input("Enter Snappfood vendor_code (e.g., 442rr5): ").strip()
    if not vendor_code_input:
        cli_logger.error("No vendor_code entered. Exiting.")
        sys.exit(1)
    
    # For CLI mode, tf_code to sf_code conversion is NOT performed here.
    # User is expected to enter a SnappFood code directly.
    sf_code_to_use = vendor_code_input

    page_url = f"https://snappfood.ir/restaurant/menu/-r-{sf_code_to_use}/"
    print(f"\n▶︎ Snappfood vendor page (for reference): {page_url}\n")

    cli_logger.info(f"Initializing scraper for Snappfood vendor: {sf_code_to_use}")
    scraper = VendorMenuFastScraper(vendor_code=sf_code_to_use)
    scraped_csv_path = scraper.run() # Returns Path object or None

    if scraped_csv_path:
        cli_logger.info(f"Scraping complete. CSV saved at: {scraped_csv_path}")
        flask_server_url = "http://127.0.0.1:5001/"
        cli_logger.info(f"Attempting to open web editor at: {flask_server_url}")
        try:
            opened = webbrowser.open(flask_server_url)
            if opened:
                 cli_logger.info(f"Browser opened. Please use 'Fetch & Load' with SnappFood code '{sf_code_to_use}' OR 'Load Manual CSV' using the generated file: '{scraped_csv_path.name}'.")
            else:
                cli_logger.warning("Could not automatically open the web browser.")
            cli_logger.info(f"If web editor is not open, please navigate to {flask_server_url} manually.")
            open_file_or_directory(str(scraped_csv_path.parent)) # Open the directory
        except Exception as e:
             cli_logger.error(f"Error trying to open browser or directory: {e}")
             cli_logger.info(f"The generated CSV is located in: {scraped_csv_path.parent}")
    else:
        cli_logger.error(f"Scraping failed or no CSV was generated for {sf_code_to_use}. Error: {scraper.last_error_message or 'Unknown scraping error'}. Check logs for details.")

    # Optional: Keep terminal open on Windows
    # if sys.platform == 'win32':
    #    input("\nPress Enter to exit...")