import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
import json
import glob
from pathlib import Path

files = glob.glob("submissions/crypto_wizards/ml_model/data/*.csv")
for file in files:
    filename = f"submissions/crypto_wizards/ml_model/weights/{Path(file).stem}.json"

    df = pd.read_csv(file)
    df['Date'] = pd.to_datetime(df['Date'])
        
    # Daily return
    df['return'] = df['Close'].pct_change()
    # Moving average
    df['ma_7'] = df['Close'].rolling(window=7).mean()
    # Volatility (std of returns)
    df['volatility_7'] = df['return'].rolling(window=7).std()
    # High-Low range
    df['hl_range'] = df['High'] - df['Low']
    # Target: next day up/down
    df['target'] = (df['Close'].shift(-1) > df['Close']).astype(int)
    # Drop NaN rows
    df = df.dropna()

    X = df.drop(columns=['target','Date'])
    y = df['target']

    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.dropna()
    y = y.loc[X.index]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test=scaler.transform(X_test)

    model = LogisticRegression()
    model.fit(X_train, y_train)

    print(Path(file).stem)
    print("Accuracy:", model.score(X_test, y_test))
    print(y.value_counts(normalize=True))

    print(confusion_matrix(y_test, model.predict(X_test)))

    original_weights = model.coef_[0]
    original_bias = model.intercept_[0]
    mean = scaler.mean_
    scale = scaler.scale_
    # Transform weights
    new_weights = original_weights / scale
    # Transform bias
    new_bias = original_bias - np.sum((original_weights * mean) / scale)
    model_data = {
        "weights": new_weights.tolist(),
        "bias": float(new_bias),
    }
    with open(filename, "w") as f:
        json.dump(model_data, f, indent=4)
    print("-------------------------------------------------------------------------------")