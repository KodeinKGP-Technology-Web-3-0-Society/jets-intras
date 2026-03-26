import pandas as pd
import numpy as np
import json
import warnings
warnings.filterwarnings('ignore')

from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, f1_score, classification_report
from sklearn.ensemble import (
    RandomForestClassifier, 
    GradientBoostingClassifier,
    VotingClassifier,
    StackingClassifier
)
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit



df = pd.read_csv('final_processed_data.csv')
df['Date'] = pd.to_datetime(df['Date'])
df = df.sort_values(by=['Token', 'Date']).reset_index(drop=True)


def add_enhanced_features(group):
    g = group.copy()
    close = g['Close']
    
    
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    g['MACD'] = ema12 - ema26
    g['MACD_Signal'] = g['MACD'].ewm(span=9, adjust=False).mean()
    g['MACD_Hist'] = g['MACD'] - g['MACD_Signal']
    
    
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    g['BB_Upper'] = sma20 + 2 * std20
    g['BB_Lower'] = sma20 - 2 * std20
    g['BB_Width'] = (g['BB_Upper'] - g['BB_Lower']) / sma20
    g['BB_Position'] = (close - g['BB_Lower']) / (g['BB_Upper'] - g['BB_Lower'])
    
    
    high = g['High']
    low = g['Low']
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs()
    ], axis=1).max(axis=1)
    g['ATR_14'] = tr.rolling(14).mean()
    
    
    low14 = low.rolling(14).min()
    high14 = high.rolling(14).max()
    g['Stoch_K'] = 100 * (close - low14) / (high14 - low14)
    g['Stoch_D'] = g['Stoch_K'].rolling(3).mean()
    
    
    daily_ret = close.pct_change()
    g['Lag_Return_1'] = daily_ret.shift(1)
    g['Lag_Return_2'] = daily_ret.shift(2)
    g['Lag_Return_3'] = daily_ret.shift(3)
    g['Lag_Return_5'] = daily_ret.shift(5)
    
    
    g['Return_Std_5'] = daily_ret.rolling(5).std()
    g['Return_Skew_10'] = daily_ret.rolling(10).skew()
    g['Return_Kurt_10'] = daily_ret.rolling(10).kurt()
    
    
    g['Price_SMA20_ratio'] = close / sma20
    
    
    if 'Volume' in g.columns:
        g['Volume_SMA_10'] = g['Volume'].rolling(10).mean()
        g['Volume_Ratio'] = g['Volume'] / g['Volume_SMA_10']
    
    
    g['ROC_5'] = close.pct_change(5)
    g['ROC_10'] = close.pct_change(10)
    
    
    g['Williams_R'] = -100 * (high14 - close) / (high14 - low14)
    
    return g

print("Adding enhanced features...")
df = df.groupby('Token', group_keys=False).apply(add_enhanced_features)


base_features = [
    'Daily_Return', 'Moving_Avg_7', 'Moving_Avg_30', 'Volatility', 
    'Momentum', 'Volume_Change', 'Price_MAvg_7_ratio', 
    'Price_Change', 'RSI_14', 'EMA_7', 'EMA_30', 'High_Low_Diff',
    'BTC_Daily_Return', 'BTC_EMA_7', 'BTC_RSI_14'
]


new_features = [
    'MACD', 'MACD_Signal', 'MACD_Hist',
    'BB_Width', 'BB_Position',
    'ATR_14',
    'Stoch_K', 'Stoch_D',
    'Lag_Return_1', 'Lag_Return_2', 'Lag_Return_3', 'Lag_Return_5',
    'Return_Std_5', 'Return_Skew_10', 'Return_Kurt_10',
    'Price_SMA20_ratio',
    'ROC_5', 'ROC_10',
    'Williams_R'
]


volume_features = ['Volume_SMA_10', 'Volume_Ratio']
for vf in volume_features:
    if vf in df.columns:
        new_features.append(vf)

features = base_features + new_features

features = [f for f in features if f in df.columns]

print(f"Total features: {len(features)}")


df[features] = df[features].replace([np.inf, -np.inf], np.nan)
df = df.dropna(subset=features + ['Target'])


df = df[df['Token'] == df['Token'].shift(-1)].copy()

X = df[features]
y = df['Target']


split_idx = int(len(df) * 0.8)
X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

print(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")
print(f"Class distribution (train): {dict(y_train.value_counts())}")
print(f"Class distribution (test):  {dict(y_test.value_counts())}")


results = {}


print("\n[1/4] Training Logistic Regression (baseline)...")
lr = LogisticRegression(class_weight='balanced', C=1.0, max_iter=1000)
lr.fit(X_train_scaled, y_train)
y_pred_lr = lr.predict(X_test_scaled)
results['Logistic Regression'] = {
    'accuracy': accuracy_score(y_test, y_pred_lr),
    'f1': f1_score(y_test, y_pred_lr),
    'model': lr,
    'preds': y_pred_lr
}
print(f"  F1: {results['Logistic Regression']['f1']:.4f}")


print("\n[2/4] Training Random Forest with hyperparameter tuning...")
rf_params = {
    'n_estimators': [200, 300, 500, 800],
    'max_depth': [5, 8, 10, 15, 20, None],
    'min_samples_split': [2, 5, 10, 20],
    'min_samples_leaf': [1, 2, 4, 8],
    'max_features': ['sqrt', 'log2', 0.3, 0.5],
    'class_weight': ['balanced', 'balanced_subsample'],
    'bootstrap': [True],
    'criterion': ['gini', 'entropy']
}

rf = RandomForestClassifier(random_state=42)
tscv = TimeSeriesSplit(n_splits=3)
rf_search = RandomizedSearchCV(
    rf, rf_params, n_iter=60, cv=tscv, scoring='f1',
    random_state=42, n_jobs=-1, verbose=0
)
rf_search.fit(X_train_scaled, y_train)
best_rf = rf_search.best_estimator_
y_pred_rf = best_rf.predict(X_test_scaled)
results['Random Forest'] = {
    'accuracy': accuracy_score(y_test, y_pred_rf),
    'f1': f1_score(y_test, y_pred_rf),
    'model': best_rf,
    'preds': y_pred_rf,
    'best_params': rf_search.best_params_
}
print(f"  F1: {results['Random Forest']['f1']:.4f}")
print(f"  Best params: {rf_search.best_params_}")


print("\n[3/4] Training Gradient Boosting with hyperparameter tuning...")
gb_params = {
    'n_estimators': [100, 200, 300, 500],
    'max_depth': [3, 4, 5, 6, 8],
    'learning_rate': [0.01, 0.05, 0.1, 0.15, 0.2],
    'min_samples_split': [2, 5, 10, 20],
    'min_samples_leaf': [1, 2, 4, 8],
    'subsample': [0.6, 0.7, 0.8, 0.9, 1.0],
    'max_features': ['sqrt', 'log2', 0.3, 0.5]
}

gb = GradientBoostingClassifier(random_state=42)
gb_search = RandomizedSearchCV(
    gb, gb_params, n_iter=60, cv=tscv, scoring='f1',
    random_state=42, n_jobs=-1, verbose=0
)
gb_search.fit(X_train_scaled, y_train)
best_gb = gb_search.best_estimator_
y_pred_gb = best_gb.predict(X_test_scaled)
results['Gradient Boosting'] = {
    'accuracy': accuracy_score(y_test, y_pred_gb),
    'f1': f1_score(y_test, y_pred_gb),
    'model': best_gb,
    'preds': y_pred_gb,
    'best_params': gb_search.best_params_
}
print(f"  F1: {results['Gradient Boosting']['f1']:.4f}")
print(f"  Best params: {gb_search.best_params_}")


print("\n[4/4] Training Stacking Ensemble...")
estimators = [
    ('rf', RandomForestClassifier(
        **rf_search.best_params_, random_state=42
    )),
    ('gb', GradientBoostingClassifier(
        **gb_search.best_params_, random_state=42
    ))
]
stacking = StackingClassifier(
    estimators=estimators,
    final_estimator=LogisticRegression(class_weight='balanced', max_iter=1000),
    cv=3,
    n_jobs=-1
)
stacking.fit(X_train_scaled, y_train)
y_pred_stack = stacking.predict(X_test_scaled)
results['Stacking Ensemble'] = {
    'accuracy': accuracy_score(y_test, y_pred_stack),
    'f1': f1_score(y_test, y_pred_stack),
    'model': stacking,
    'preds': y_pred_stack
}
print(f"  F1: {results['Stacking Ensemble']['f1']:.4f}")


print("\n" + "=" * 60)
print("MODEL COMPARISON")
print("=" * 60)
print(f"{'Model':<25} {'Accuracy':>10} {'F1 Score':>10}")
print("-" * 47)
for name, r in sorted(results.items(), key=lambda x: x[1]['f1'], reverse=True):
    print(f"{name:<25} {r['accuracy']*100:>9.2f}% {r['f1']:>9.4f}")


best_name = max(results, key=lambda k: results[k]['f1'])
best_result = results[best_name]
best_model = best_result['model']
best_preds = best_result['preds']

print(f"\n*** BEST MODEL: {best_name} ***")
print(f"    Accuracy: {best_result['accuracy']*100:.2f}%")
print(f"    F1 Score: {best_result['f1']:.4f}")

print("\n--- Classification Report (BEST MODEL) ---")
print(classification_report(y_test, best_preds))


if hasattr(best_model, 'feature_importances_'):
    importance = best_model.feature_importances_
    feat_imp = pd.Series(importance, index=features).sort_values(ascending=False)
    print("\nTop 15 Feature Importances:")
    for feat, imp in feat_imp.head(15).items():
        print(f"  {feat:<25} {imp:.4f}")


winning_export = {
    "model_type": f"Best Model: {best_name}",
    "features_ordered": features,
    "scaling": {
        "mean": scaler.mean_.tolist(),
        "std": np.sqrt(scaler.var_).tolist()
    },
    "metadata": {
        "accuracy": round(best_result['accuracy'], 4),
        "f1": round(best_result['f1'], 4),
        "tokens_trained": df['Token'].unique().tolist(),
        "total_features": len(features),
        "train_samples": len(X_train),
        "test_samples": len(X_test)
    },
    "all_results": {
        name: {"accuracy": round(r['accuracy'], 4), "f1": round(r['f1'], 4)}
        for name, r in results.items()
    }
}


if best_name == 'Logistic Regression':
    winning_export["weights"] = best_model.coef_[0].tolist()
    winning_export["intercept"] = best_model.intercept_[0]
elif best_name in ('Random Forest', 'Gradient Boosting'):
    winning_export["feature_importances"] = best_model.feature_importances_.tolist()
    if 'best_params' in best_result:
        winning_export["best_params"] = {
            k: v if not isinstance(v, np.integer) else int(v)
            for k, v in best_result['best_params'].items()
        }

with open('data.json', 'w') as f:
    json.dump(winning_export, f, indent=4, default=str)

print("\n--- Universal ML Engine Training Complete ---")
print(f"Final Best Model: {best_name}")
print(f"Final Model Accuracy: {best_result['accuracy']*100:.2f}%")
print(f"Final F1 Score: {best_result['f1']:.4f}")
print("\n'data.json' created successfully!")