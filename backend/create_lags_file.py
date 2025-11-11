# ===============================================
# create_lags_file.py
# ===============================================

import pandas as pd
import numpy as np
import json
import os # Added to check if file exists

# --- CONFIG ---
# This assumes the Excel file is in the SAME folder as this script.
DATA_PATH = r"C:\Users\lorry\OneDrive\Documents\GitHub\FYP-CSIT321\backend\excel\Cleaned_Merged_Property_Transactions_v2.xlsx"
OUTPUT_PATH = r"C:\Users\lorry\OneDrive\Documents\GitHub\FYP-CSIT321\backend\cache\regional_lags.json"

# --- Check if files exist ---
if not os.path.exists(DATA_PATH):
    print(f"Error: Data file not found at {DATA_PATH}")
    print("Please make sure 'Cleaned_Merged_Property_Transactions_v2.xlsx' is in the same directory.")
else:
    print(f"Loading dataset from {DATA_PATH}...")
    df = pd.read_excel(DATA_PATH)
    df.columns = df.columns.str.strip()

    # --- Re-create lag features exactly like in training ---
    print("Sorting data and calculating lag features...")
    df = df.sort_values(["region", "transaction_year", "transaction_month"])
    
    for lag in [1, 3, 6]:
        # CRITICAL: Use 'price', just like your training script
        df[f"price_lag_{lag}"] = df.groupby("region")["price"].shift(lag)

    # --- Get the *last* known lags for each region ---
    print(" Finding last known lag for each region...")
    
    # bfill to make sure the last row has values if lags were NaN
    df.fillna(method="bfill", inplace=True) 

    last_lags_df = df.groupby("region").last()

    # --- Select only the lag columns we need ---
    lag_features = ["price_lag_1", "price_lag_3", "price_lag_6"]
    regional_lags = last_lags_df[lag_features]

    # --- Save to JSON ---
    regional_lags.to_json(OUTPUT_PATH, orient="index", indent=4)

    print(f"\nSuccessfully saved regional lags to: {OUTPUT_PATH}")
    print("You can now run your 'app.py' Flask server.")