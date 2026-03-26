"""
Test script: Loads crypto CSVs, builds final_df with all required features, 
then runs ml_engine.py to evaluate model performance.
"""
import pandas as pd
import numpy as np
import os
import warnings
warnings.filterwarnings('ignore')

# ============================================================
# STEP A: Load all CSV files and combine
# ============================================================
data_dir = r"c:\Users\AARUSHI GHOSH\Desktop\submissions\JETs IntraSoc Hackathon"
csv_files = [f for f in os.listdir(data_dir) if f.endswith('.csv')]

all_dfs = []
for csv_file in csv_files:
    token_name = csv_file.replace('coin_', '').replace('.csv', '')
    df = pd.read_csv(os.path.join(data_dir, csv_file))
    df['Token'] = token_name
    all_dfs.append(df)

combined_df = pd.concat(all_dfs, ignore_index=True)
combined_df['Date'] = pd.to_datetime(combined_df['Date'])
combined_df = combined_df.sort_values(by=['Token', 'Date']).reset_index(drop=True)

print(f"Loaded {len(csv_files)} tokens, {len(combined_df)} total rows")
print(f"Columns: {list(combined_df.columns)}")

# ============================================================
# STEP B: Engineer the BASE features that ml_engine.py expects
# ============================================================

# First build BTC features separately
btc_df = combined_df[combined_df['Token'] == 'Bitcoin'].copy()
btc_df['BTC_Daily_Return'] = btc_df['Close'].pct_change()
btc_df['BTC_EMA_7'] = btc_df['Close'].ewm(span=7, adjust=False).mean()

# BTC RSI
delta_btc = btc_df['Close'].diff()
gain_btc = delta_btc.where(delta_btc > 0, 0).rolling(14).mean()
loss_btc = (-delta_btc.where(delta_btc < 0, 0)).rolling(14).mean()
rs_btc = gain_btc / loss_btc
btc_df['BTC_RSI_14'] = 100 - (100 / (1 + rs_btc))

btc_features = btc_df[['Date', 'BTC_Daily_Return', 'BTC_EMA_7', 'BTC_RSI_14']].copy()

def add_base_features(group):
    g = group.copy()
    close = g['Close']
    volume = g['Volume']
    
    # Daily Return
    g['Daily_Return'] = close.pct_change()
    
    # Moving Averages
    g['Moving_Avg_7'] = close.rolling(7).mean()
    g['Moving_Avg_30'] = close.rolling(30).mean()
    
    # Volatility (rolling std of returns)
    g['Volatility'] = close.pct_change().rolling(14).std()
    
    # Momentum (10-day)
    g['Momentum'] = close - close.shift(10)
    
    # Volume Change
    g['Volume_Change'] = volume.pct_change()
    
    # Price to MA ratio
    g['Price_MAvg_7_ratio'] = close / g['Moving_Avg_7']
    
    # Price Change (1-day absolute)
    g['Price_Change'] = close.diff()
    
    # RSI 14
    delta = close.diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss
    g['RSI_14'] = 100 - (100 / (1 + rs))
    
    # EMA 7 and 30
    g['EMA_7'] = close.ewm(span=7, adjust=False).mean()
    g['EMA_30'] = close.ewm(span=30, adjust=False).mean()
    
    # High-Low Diff
    g['High_Low_Diff'] = g['High'] - g['Low']
    
    # Target: 1 if next day close > today close, else 0
    g['Target'] = (close.shift(-1) > close).astype(int)
    
    return g

print("Adding base features...")
final_df = combined_df.groupby('Token', group_keys=False).apply(add_base_features)

# Merge BTC features
final_df = final_df.merge(btc_features, on='Date', how='left')

# For Bitcoin rows, BTC features are already its own
# Fill any remaining NaN BTC features with forward fill
final_df['BTC_Daily_Return'] = final_df['BTC_Daily_Return'].ffill()
final_df['BTC_EMA_7'] = final_df['BTC_EMA_7'].ffill()
final_df['BTC_RSI_14'] = final_df['BTC_RSI_14'].ffill()

print(f"final_df shape: {final_df.shape}")
print(f"Tokens: {final_df['Token'].nunique()}")
print(f"Date range: {final_df['Date'].min()} to {final_df['Date'].max()}")

# ============================================================
# STEP C: Run the ml_engine code
# ============================================================
print("\n" + "=" * 60)
print("RUNNING ML ENGINE")
print("=" * 60 + "\n")

exec(open(r"c:\Users\AARUSHI GHOSH\Desktop\kik intrasoc hackathon\group-7\submissions\group_7\ml_engine.py", encoding='utf-8').read())
