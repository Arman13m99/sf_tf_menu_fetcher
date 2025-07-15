# app.py
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import pandas as pd
import os
from pathlib import Path
import logging
import sys
import io # For creating CSV string
import csv # For writing to CSV string
import json # For parsing shifts/tags if needed

try:
    from vendor_scrape import VendorMenuFastScraper
    import config # Import the updated config
except ImportError as e:
    print(f"Could not import from vendor_scrape.py or config.py: {e}. Ensure they are accessible.")
    sys.exit(1)

# --- Flask App Setup & Logging ---
project_root = Path(__file__).resolve().parent
app = Flask(__name__,
            template_folder=str(project_root / 'templates'),
            static_folder=str(project_root / 'static')
            )
CORS(app)

if not app.debug: 
    app.logger.setLevel(logging.INFO)
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    app.logger.addHandler(stream_handler)
if not app.logger.handlers and app.debug:
    app.logger.setLevel(logging.DEBUG) 
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(logging.Formatter(
        "%(asctime)s - %(name)s (Flask) - %(levelname)s - %(message)s" 
    ))
    app.logger.addHandler(stream_handler)


# --- Data Loading & Preparation ---
TF_MENU_DF = None
TF_INFO_DF = None
tf_to_sf_map = {}
sf_to_tf_map = {}

def load_tapsifood_data():
    global TF_MENU_DF, TF_INFO_DF
    try:
        if config.TF_INFO_CSV_PATH.is_file():
            TF_INFO_DF = pd.read_csv(config.TF_INFO_CSV_PATH, dtype=str)
            if 'vendor_code' in TF_INFO_DF.columns:
                 TF_INFO_DF['vendor_code'] = TF_INFO_DF['vendor_code'].str.strip()
            else:
                app.logger.error(f"'vendor_code' column missing in {config.TF_INFO_CSV_PATH}. Tapsifood info will be incomplete.")
                TF_INFO_DF = pd.DataFrame()

            app.logger.info(f"Loaded {len(TF_INFO_DF)} records from {config.TF_INFO_CSV_PATH}")
        else:
            app.logger.warning(f"{config.TF_INFO_CSV_PATH} not found. Tapsifood vendor info unavailable.")
            TF_INFO_DF = pd.DataFrame()

        if config.TF_MENU_CSV_PATH.is_file():
            TF_MENU_DF = pd.read_csv(config.TF_MENU_CSV_PATH, dtype=str)
            if 'tf_code' in TF_MENU_DF.columns: 
                TF_MENU_DF.rename(columns={'tf_code': 'vendor_code'}, inplace=True)
                TF_MENU_DF['vendor_code'] = TF_MENU_DF['vendor_code'].str.strip()
            elif 'vendor_code' in TF_MENU_DF.columns: 
                TF_MENU_DF['vendor_code'] = TF_MENU_DF['vendor_code'].str.strip()
            else:
                app.logger.error(f"Required vendor code column ('tf_code' or 'vendor_code') missing in {config.TF_MENU_CSV_PATH}.")
                TF_MENU_DF = pd.DataFrame() 

            app.logger.info(f"Loaded {len(TF_MENU_DF)} records from {config.TF_MENU_CSV_PATH}")
        else:
            app.logger.warning(f"{config.TF_MENU_CSV_PATH} not found. Tapsifood menu data unavailable.")
            TF_MENU_DF = pd.DataFrame()

    except Exception as e:
        app.logger.error(f"Error loading Tapsifood data: {e}", exc_info=True)
        TF_MENU_DF = pd.DataFrame()
        TF_INFO_DF = pd.DataFrame()

def load_matched_vendors():
    global tf_to_sf_map, sf_to_tf_map
    try:
        if config.MATCHED_VENDORS_CSV_PATH.is_file():
            df = pd.read_csv(config.MATCHED_VENDORS_CSV_PATH, dtype=str)
            df.dropna(subset=['tf_code', 'sf_code'], inplace=True)
            df['tf_code'] = df['tf_code'].str.strip()
            df['sf_code'] = df['sf_code'].str.strip()
            df = df[(df['tf_code'] != '') & (df['sf_code'] != '')]
            tf_to_sf_map = pd.Series(df.sf_code.values, index=df.tf_code).to_dict()
            sf_to_tf_map = pd.Series(df.tf_code.values, index=df.sf_code).to_dict()
            app.logger.info(f"Loaded {len(tf_to_sf_map)} TapsiFood->SnappFood and {len(sf_to_tf_map)} SnappFood->TapsiFood mappings from {config.MATCHED_VENDORS_CSV_PATH}")
        else:
            app.logger.warning(f"MATCHED_VENDORS_CSV_PATH '{config.MATCHED_VENDORS_CSV_PATH}' not found. Vendor code mapping will be limited.")
    except Exception as e:
        app.logger.error(f"Error loading {config.MATCHED_VENDORS_CSV_PATH}: {e}", exc_info=True)

load_tapsifood_data()
load_matched_vendors()

def get_default_vendor_info(vendor_code=""):
    info = {key: "" for key in config.EXPECTED_VENDOR_INFO_KEYS}
    info.update({
        "vendor_code": vendor_code,
        "min_order": "0", "rating": "0", "comment_count": "0",
        "shifts": "[]", "tag_names": "[]",
        "is_express": "False", "is_pro": "False", "is_economical": "False"
    })
    return info

def get_default_menu_item_data(vendor_code=""):
    item_data = {key: "" for key in config.EXPECTED_MERGED_ITEM_DATA_COLS}
    item_data.update({
        "vendor_code": vendor_code, "price": "0", "rating": "0", 
        "product_toppings": "[]", "min_order": "0", "comment_count": "0", 
        "shifts": "[]", "tag_names": "[]", "is_express": "False", 
        "is_pro": "False", "is_economical": "False"
    })
    return item_data


def prepare_tapsifood_csv_data(tf_vendor_code_input):
    if TF_MENU_DF is None or TF_INFO_DF is None: 
        app.logger.error("Tapsifood DFs are not initialized. Cannot prepare data.")
        return None, None
    if TF_INFO_DF.empty:
        app.logger.warning(f"Tapsifood TF_INFO_DF is empty. Cannot prepare vendor info for {tf_vendor_code_input}.")
        return None, get_default_vendor_info(tf_vendor_code_input)

    tf_vendor_code = str(tf_vendor_code_input).strip()
    vendor_info_rows = TF_INFO_DF[TF_INFO_DF['vendor_code'] == tf_vendor_code]
    if vendor_info_rows.empty:
        app.logger.warning(f"No Tapsifood vendor info found for {tf_vendor_code} in TF_INFO_DF.")
        return None, get_default_vendor_info(tf_vendor_code) 
    
    vendor_info_series = vendor_info_rows.iloc[0]
    tf_vendor_info_dict = get_default_vendor_info(tf_vendor_code)
    
    # --- SHIFTS TRANSFORMATION (FIXED) ---
    shifts_value_from_series = vendor_info_series.get('shifts')
    if pd.isna(shifts_value_from_series):
        tf_shifts_raw_json_str = '[]'
        app.logger.debug(f"Shifts for {tf_vendor_code} was NaN, defaulting to '[]'.")
    else:
        tf_shifts_raw_json_str = str(shifts_value_from_series)

    if not tf_shifts_raw_json_str.strip():
        tf_shifts_raw_json_str = '[]'
        app.logger.debug(f"Shifts for {tf_vendor_code} was empty string, defaulting to '[]'.")

    transformed_shifts_list = []
    DAY_NAME_TO_SF_WEEKDAY = {
        "Saturday": 1, "Sunday": 2, "Monday": 3, "Tuesday": 4,
        "Wednesday": 5, "Thursday": 6, "Friday": 7
    }
    try:
        tf_shifts_data_from_csv = json.loads(tf_shifts_raw_json_str)
        if isinstance(tf_shifts_data_from_csv, list):
            for day_schedule in tf_shifts_data_from_csv:
                day_name = day_schedule.get("DayOfWeek")
                weekday_num = DAY_NAME_TO_SF_WEEKDAY.get(day_name)
                
                if weekday_num is not None and isinstance(day_schedule.get("Shifts"), list):
                    for shift_interval in day_schedule.get("Shifts", []): 
                        start_time = shift_interval.get("StartTime")
                        end_time = shift_interval.get("EndTime")
                        if start_time and end_time:
                            transformed_shifts_list.append({
                                "weekday": weekday_num,
                                "allDay": False, 
                                "startHour": start_time,
                                "stopHour": end_time
                            })
        elif tf_shifts_raw_json_str != '[]': 
            app.logger.warning(f"Tapsifood shifts data for {tf_vendor_code} was valid JSON but not a list: {tf_shifts_raw_json_str}")

    except json.JSONDecodeError:
        app.logger.error(f"Could not decode Tapsifood shifts JSON for {tf_vendor_code}: '{tf_shifts_raw_json_str}'")
    except Exception as e:
        app.logger.error(f"Error transforming Tapsifood shifts for {tf_vendor_code}: {e}", exc_info=True)
    # --- END SHIFTS TRANSFORMATION ---

    tf_vendor_info_dict.update({
        "vendor_code": tf_vendor_code,
        "snappfood_vendor_id": vendor_info_series.get('id', ''), # Using 'id' from your SQL as the unique TF ID
        "vendor_name": vendor_info_series.get('vendor_name', ''),
        "business_line": vendor_info_series.get('business_line', ''), 
        "marketing_area": vendor_info_series.get('marketing_area', ''),
        "address": vendor_info_series.get('address', ''),
        "min_order": str(vendor_info_series.get('min_order', '0')),
        "latitude": str(vendor_info_series.get('latitude', '')),
        "longitude": str(vendor_info_series.get('longitude', '')),
        "shifts": json.dumps(transformed_shifts_list) 
    })
    app.logger.debug(f"Prepared TF vendor_info_dict (with transformed shifts): {tf_vendor_info_dict}")

    if TF_MENU_DF.empty:
        app.logger.warning(f"Tapsifood TF_MENU_DF is empty. Cannot provide menu items for {tf_vendor_code}.")
        return None, tf_vendor_info_dict 
        
    tf_menu_items_df = TF_MENU_DF[TF_MENU_DF['vendor_code'] == tf_vendor_code].copy()
    if tf_menu_items_df.empty:
        app.logger.info(f"No Tapsifood menu items found for {tf_vendor_code} in TF_MENU_DF.")
        return None, tf_vendor_info_dict

    full_menu_data_list = []
    for _, item_row in tf_menu_items_df.iterrows():
        merged_item = get_default_menu_item_data(tf_vendor_code) 
        for key in config.EXPECTED_VENDOR_INFO_KEYS: 
            if key in tf_vendor_info_dict:
                 merged_item[key] = tf_vendor_info_dict[key]
        merged_item.update({
            "category_id": item_row.get('category_id', ''),
            "category_name": item_row.get('category_name', ''),
            "item_id": item_row.get('item_id', ''),
            "item_title": item_row.get('item_title', ''),
            "description": item_row.get('item_description', ''), 
            "price": str(item_row.get('price', '0')),
            "product_toppings": "[]" 
        })
        full_menu_data_list.append(merged_item)

    if not full_menu_data_list: 
        return None, tf_vendor_info_dict

    string_io = io.StringIO()
    writer = csv.DictWriter(string_io, fieldnames=config.EXPECTED_MERGED_ITEM_DATA_COLS, quoting=csv.QUOTE_MINIMAL, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(full_menu_data_list)
    csv_content = '\ufeff' + string_io.getvalue()
    string_io.close()
    return csv_content, tf_vendor_info_dict


# --- Routes ---
@app.route('/')
def index():
    return render_template('menu_editor.html')

@app.route('/static/<path:subfolder>/<path:filename>')
def serve_static_in_subfolder(subfolder, filename):
    return send_from_directory(os.path.join(app.static_folder, subfolder), filename)

@app.route('/scrape', methods=['POST'])
def scrape_route():
    data = request.get_json()
    identifier = data.get('identifier', '').strip()

    if not identifier:
        return jsonify({"success": False, "error": "No identifier provided."}), 400

    app.logger.info(f"Received /scrape request for identifier: {identifier}")

    sf_code_to_scrape = None
    tf_code_to_scrape = None
    query_platform_guess = "unknown"

    if identifier in tf_to_sf_map:
        tf_code_to_scrape = identifier
        sf_code_to_scrape = tf_to_sf_map[identifier]
        query_platform_guess = "tapsifood"
        app.logger.info(f"Identifier '{identifier}' is TapsiFood. Mapped to SF: '{sf_code_to_scrape}'.")
    elif identifier in sf_to_tf_map:
        sf_code_to_scrape = identifier
        tf_code_to_scrape = sf_to_tf_map[identifier]
        query_platform_guess = "snappfood"
        app.logger.info(f"Identifier '{identifier}' is SnappFood. Mapped to TF: '{tf_code_to_scrape}'.")
    else:
        sf_code_to_scrape = identifier 
        query_platform_guess = "snappfood_or_unmapped" 
        app.logger.info(f"Identifier '{identifier}' not in maps. Assuming SnappFood or unmapped. Trying SF: {sf_code_to_scrape}.")
        if sf_code_to_scrape in sf_to_tf_map:
             tf_code_to_scrape = sf_to_tf_map[sf_code_to_scrape]
             app.logger.info(f"Found TF mapping for assumed SF code: {tf_code_to_scrape}")
        else: 
            app.logger.info(f"No TF mapping for '{sf_code_to_scrape}'. It might be a TF code without an SF map entry, or an invalid SF code.")

    response_data = {
        "success": True, 
        "snappfood": {"data_loaded": False, "csv_data": None, "vendor_info": get_default_vendor_info(sf_code_to_scrape or identifier), "filename": None, "original_identifier": sf_code_to_scrape or identifier, "error": None},
        "tapsifood": {"data_loaded": False, "csv_data": None, "vendor_info": get_default_vendor_info(tf_code_to_scrape or identifier), "filename": None, "original_identifier": tf_code_to_scrape or identifier, "error": None},
        "query_identifier": identifier,
        "query_platform_guess": query_platform_guess
    }

    if sf_code_to_scrape:
        app.logger.info(f"Processing SnappFood for code: {sf_code_to_scrape}")
        try:
            scraper_instance = VendorMenuFastScraper(vendor_code=sf_code_to_scrape)
            sf_csv_content = scraper_instance.run(return_content_as_string=True)
            if isinstance(sf_csv_content, str):
                response_data["snappfood"]["data_loaded"] = True
                response_data["snappfood"]["csv_data"] = sf_csv_content
                response_data["snappfood"]["filename"] = f"sf_menu_{''.join(filter(str.isalnum, sf_code_to_scrape))}_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.csv"
                temp_df = pd.read_csv(io.StringIO(sf_csv_content))
                if not temp_df.empty:
                    first_row_dict = temp_df.iloc[0].astype(str).to_dict()
                    sf_vendor_info_from_csv = get_default_vendor_info(sf_code_to_scrape)
                    sf_vendor_info_from_csv.update({k: first_row_dict.get(k, sf_vendor_info_from_csv.get(k, '')) for k in config.EXPECTED_VENDOR_INFO_KEYS if k in first_row_dict})
                    response_data["snappfood"]["vendor_info"] = sf_vendor_info_from_csv
                app.logger.info(f"SnappFood data processed successfully for {sf_code_to_scrape}.")
            else: 
                error_msg = scraper_instance.last_error_message or f"Snappfood scraping failed for {sf_code_to_scrape}"
                response_data["snappfood"]["error"] = error_msg
                app.logger.error(f"SnappFood processing failed for {sf_code_to_scrape}: {error_msg}")
        except Exception as e:
            app.logger.error(f"Exception during SnappFood processing for {sf_code_to_scrape}: {e}", exc_info=True)
            response_data["snappfood"]["error"] = f"Server error processing SnappFood: {str(e)}"
    else:
        app.logger.info("No SnappFood code determined to process.")

    if tf_code_to_scrape:
        app.logger.info(f"Processing TapsiFood for code: {tf_code_to_scrape}")
        try:
            tf_csv_data, tf_vendor_info_from_prep = prepare_tapsifood_csv_data(tf_code_to_scrape)
            if tf_vendor_info_from_prep: 
                response_data["tapsifood"]["vendor_info"] = tf_vendor_info_from_prep # Always update vendor_info if processed
                if tf_csv_data: 
                    response_data["tapsifood"]["data_loaded"] = True
                    response_data["tapsifood"]["csv_data"] = tf_csv_data
                    response_data["tapsifood"]["filename"] = f"tf_menu_{''.join(filter(str.isalnum, tf_code_to_scrape))}_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.csv"
                    app.logger.info(f"TapsiFood data and menu processed successfully for {tf_code_to_scrape}.")
                else: # Vendor info exists, but no menu items
                    response_data["tapsifood"]["data_loaded"] = True 
                    response_data["tapsifood"]["error"] = response_data["tapsifood"]["error"] or "Tapsifood vendor info loaded, but no menu items found."
                    app.logger.warning(f"Tapsifood vendor info for {tf_code_to_scrape} loaded, but no menu items found.")
            else: 
                response_data["tapsifood"]["error"] = response_data["tapsifood"]["error"] or f"No Tapsifood data could be prepared for {tf_code_to_scrape}."
                app.logger.warning(f"No Tapsifood data could be prepared for {tf_code_to_scrape}.")
        except Exception as e:
            app.logger.error(f"Exception during TapsiFood processing for {tf_code_to_scrape}: {e}", exc_info=True)
            response_data["tapsifood"]["error"] = f"Server error processing TapsiFood: {str(e)}"
    else:
        app.logger.info("No TapsiFood code determined to process.")

    if not sf_code_to_scrape and not tf_code_to_scrape: 
        app.logger.info(f"No specific codes determined.")
    elif sf_code_to_scrape and not response_data["snappfood"]["data_loaded"] and not tf_code_to_scrape:
        if query_platform_guess == "snappfood_or_unmapped": 
            app.logger.info(f"SnappFood failed for '{sf_code_to_scrape}'. Now trying original identifier '{identifier}' as TapsiFood code.")
            tf_code_to_try_again = identifier
            response_data["tapsifood"]["original_identifier"] = tf_code_to_try_again
            try:
                tf_csv_data_retry, tf_vendor_info_retry = prepare_tapsifood_csv_data(tf_code_to_try_again)
                if tf_vendor_info_retry:
                    response_data["tapsifood"]["vendor_info"] = tf_vendor_info_retry
                    if tf_csv_data_retry:
                        response_data["tapsifood"]["data_loaded"] = True
                        response_data["tapsifood"]["csv_data"] = tf_csv_data_retry
                        response_data["tapsifood"]["filename"] = f"tf_menu_{''.join(filter(str.isalnum, tf_code_to_try_again))}_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.csv"
                        app.logger.info(f"TapsiFood data (retry) processed successfully for {tf_code_to_try_again}.")
                        response_data["query_platform_guess"] = "tapsifood_after_sf_fail"
                    else:
                        response_data["tapsifood"]["data_loaded"] = True 
                        response_data["tapsifood"]["error"] = response_data["tapsifood"]["error"] or f"Tapsifood (retry) vendor info for {tf_code_to_try_again} loaded, but no menu."
                        app.logger.warning(f"Tapsifood (retry) for {tf_code_to_try_again}: vendor info loaded, no menu.")
                else:
                    response_data["tapsifood"]["error"] = response_data["tapsifood"]["error"] or f"No Tapsifood data (retry) found for {tf_code_to_try_again}."
            except Exception as e_retry:
                app.logger.error(f"Exception during TapsiFood retry processing for {tf_code_to_try_again}: {e_retry}", exc_info=True)
                response_data["tapsifood"]["error"] = f"Server error processing TapsiFood (retry): {str(e_retry)}"

    if not response_data["snappfood"]["data_loaded"] and not response_data["tapsifood"]["data_loaded"]:
        sf_attempted = bool(sf_code_to_scrape) or (query_platform_guess == "snappfood_or_unmapped" and not tf_code_to_scrape)
        tf_attempted = bool(tf_code_to_scrape) or (response_data["query_platform_guess"] == "tapsifood_after_sf_fail")
        sf_had_error = response_data["snappfood"]["error"] is not None
        tf_had_error = response_data["tapsifood"]["error"] is not None
        
        # If any platform was attempted and had an error, AND no data was loaded for EITHER platform, then overall success is false.
        if (sf_attempted and sf_had_error) or (tf_attempted and tf_had_error):
            response_data["success"] = False

    return jsonify(response_data), 200

if __name__ == '__main__':
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.OUTPUT_DIR_MENU_SCRAPER.mkdir(parents=True, exist_ok=True)
    (project_root / "templates").mkdir(exist_ok=True)
    (project_root / "static" / "js").mkdir(parents=True, exist_ok=True)
    (project_root / "static" / "css").mkdir(parents=True, exist_ok=True)
    
    app.logger.info(f"Flask app starting on http://127.0.0.1:5001 (Debug mode: {app.debug})")
    app.logger.info(f"Ensure '{config.TF_INFO_CSV_PATH.name}', '{config.TF_MENU_CSV_PATH.name}', and '{config.MATCHED_VENDORS_CSV_PATH.name}' are present or configured.")
    app.run(host="127.0.0.1", port=5001, debug=True, use_reloader=False) # use_reloader=False recommended with current data loading pattern