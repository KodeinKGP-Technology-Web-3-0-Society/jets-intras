
# Team Name: KRYPTON

## Team Members
* Member 1: Achal Jain - https://github.com/AchalJain-creator
* Member 2: Aditya Tyagi - https://github.com/warrior2323
* Member 3: Sahil Akash - https://github.com/Zenith-Vaynor
* Member 4: Shreyasi Saha - https://github.com/Shreyasidgpkgp29

## 🔗 Project Links
* **PPT link:** https://www.canva.com/design/DAHGSUPv14U/R0HkNjIwK3ePH9iqPAT7vg/view?utm_content=DAHGSUPv14U&utm_campaign=designshare&utm_medium=link&utm_source=viewer
* **Hosted Demo:** https://submissionkrypto.vercel.app/

## Technical Implementation

### 1. Data Pipeline & Feature Engineering

Data pipeline is the foundation of the entire system. It handles everything from raw CSV
ingestion to producing a clean, model-ready feature matrix — and ours does this differently
depending on what type of coin it's processing.

# Data Loading & Cleaning
The pipeline begins by scanning the project directory for all `coin_*.csv` files (23 coins
total). Each file contains daily OHLCV data — Open, High, Low, Close, and Volume. Every file
passes through a standardized `load_and_clean()` function that applies the following
transformations in order:

Dates are parsed and set as the index, rows are sorted chronologically, and exact duplicate
dates are dropped. Missing values are forward-filled with a limit of 2 consecutive days — this
handles exchange outages or data gaps without fabricating synthetic data over longer periods.
Any row that remains null after the fill is dropped. Finally, an outlier clipping step caps all
feature values at ±10 standard deviations from their mean, which prevents a single anomalous
spike (like Dogecoin's 2021 pump) from destabilizing the scaler or creating extreme tree
splits, without removing the data point entirely.

# Regime Detection (Coin Categorisation)
Before any features are engineered, each coin is automatically classified into one of three
categories using a data-driven regime detector. This is what makes the pipeline universal — it
works on any unknown coin without hardcoding.

A coin is labelled a **stablecoin** if its interquartile range (the spread of the middle 50%
of prices) is less than 5% of the median price. This IQR-based check is deliberately robust to
outliers — a single depeg event won't misclassify USDT as volatile. A coin is labelled
**DeFi-short** if it has fewer than 600 clean rows of data. Everything else is **volatile**.

The three resulting groups are:
- **Stablecoins** — USDT, USDC, etc.
- **DeFi-short** — recently listed coins with limited history
- **Volatile** — Bitcoin, Ethereum, Solana, etc.

# Feature Engineering
Three distinct feature sets are constructed — one per category. All features are strictly
backward-looking to prevent lookahead bias.

**Base features** are computed for every coin regardless of category:

| Feature | Description |
|---|---|
| `Return` | Daily percentage return |
| `LogReturn` | Log return (ln of price ratio) |
| `HL_Range` | High-low range normalized by close |
| `OC_Body` | Open-close candle body |
| `Lag1/2/3_Return` | Lagged returns at 1, 2, and 3 days |
| `Volatility5` | 5-day rolling standard deviation of returns |
| `Volume_change` | Percentage change in daily volume |

**Volatile and DeFi-short coins** receive an additional set of momentum and technical
indicators:

| Feature | Description |
|---|---|
| `RSI14` | Relative Strength Index (14-day) — captures overbought/oversold conditions |
| `MA_Cross` | Binary flag: 1 if MA5 > MA20 (short-term uptrend) |
| `BB_Position` | Bollinger Band position — 0 = lower band, 1 = upper band |
| `Vol_Spike` | Binary flag: 1 if volume > 1.5× the 10-day average |
| `ATR_norm` | Average True Range normalized by close — scale-invariant volatility |
| `BTC_lag1` | Previous day's Bitcoin return — cross-coin leading signal for altcoins |

**Stablecoin coins** receive peg-mechanics features instead, since momentum indicators are
meaningless when price is flat:

| Feature | Description |
|---|---|
| `Dev_from_peg` | Signed deviation from $1.00 peg |
| `Abs_dev_peg` | Absolute deviation from peg |
| `Peg_MA5` | 5-day rolling mean of peg deviation |
| `Below_peg` | Binary flag: 1 if Close < $0.999 |
| `Above_peg` | Binary flag: 1 if Close > $1.001 |

The **target variable** for all coins is binary: `1` if the next day's closing price is higher
than today's (UP), `0` otherwise.

# Feature Selection
After feature engineering, `SelectKBest` with ANOVA F-score (`f_classif`) is used to retain
only the top-K most predictive features. The F-score tests whether the mean of each feature
differs significantly between the UP and DOWN class — more appropriate for classification than
simple correlation. The selector is always fit **on training data only** and then applied to
the test set, so no future information leaks into feature selection.

| Category | Features Selected (k) |
|---|---|
| Volatile | 12 |
| DeFi-short | 8 |
| Stablecoin | 8 |

### 2. The Machine Learning Engine

The ML engine consists of three separate soft-voting ensemble classifiers — one per coin
category — plus a global pooled model used at inference time for unknown coins.

# Train / Test Split Strategy
A strict chronological split is used throughout. The **last 20%** of each coin's data is held
out as the final test set and is never touched during cross-validation or training. This
preserves temporal order — the model always trains on the past and is evaluated on the future,
exactly as it would work in real deployment.

For cross-validation during training, `TimeSeriesSplit` (walk-forward validation) is used
rather than random k-fold. Standard k-fold shuffles the data, which means the model can train
on 2022 data and be tested on 2019 data — a form of **temporal leakage** that produces
inflated accuracy scores. Walk-forward validation creates expanding training windows where each
fold's test set is always strictly in the future relative to its training set.

| Category | CV Folds |
|---|---|
| Volatile | 5 |
| DeFi-short | 3 |
| Stablecoin | 5 |

# The Three Ensemble Models
Each ensemble is a `VotingClassifier` with `voting='soft'`. Soft voting averages the predicted
**probabilities** of UP across all base learners before making the final call, rather than
taking a majority vote on direction. This produces a calibrated confidence percentage and is
more robust than hard voting because it uses the full probability signal from each model.

# Volatile Ensemble
Three diverse base learners working in combination:

| Model | Configuration | Role |
|---|---|---|
| Logistic Regression | `C=0.1`, L2 regularization, StandardScaler | Linear boundary, strong generalization |
| Random Forest | 200 trees, max depth 5, min 10 samples/leaf | Robust to noise via bagging |
| Gradient Boosting | 200 estimators, lr=0.05, subsample=0.8 | Sequentially corrects prior errors |

# DeFi-Short Ensemble
Mirrors the volatile ensemble structurally but applies stronger constraints to combat limited
data:

| Model | Configuration | Reason for Change |
|---|---|---|
| Logistic Regression | `C=0.01` (10× stronger regularization) | Prevents overfitting on small datasets |
| Random Forest | 100 trees, max depth 3, min 15 samples/leaf | Shallower trees generalize better |
| Gradient Boosting | 100 estimators, subsample=0.7 | More aggressive subsampling for variance reduction |

# Why L2 was preferred over L1?
**L1 (Lasso)** drives coefficients to exactly zero — it performs feature selection by eliminating features entirely. 
**L2 (Ridge)** shrinks all coefficients toward zero but rarely eliminates them completely.

L2 is smoother to optimize. The L2 penalty is differentiable everywhere, which means gradient-based solvers 
(like lbfgs, the default in scikit-learn's LogReg) converge faster and more reliably. L1 has a non-differentiable point
at zero, requiring specialized solvers like liblinear or saga. For a pipeline running across 23 coins with max_iter=500, 
L2 is simply more computationally stable.

>If we had to choose one scenario where we'd prefer L1 is if we had hundreds of features and suspected most were noise — letting the model auto-select by zeroing them out would make sense. But with k=8 to k=12 pre-selected features, we're already working with a compact, curated set where L2's smooth shrinkage is the right tool.

# Stablecoin Ensemble
Logistic Regression is **excluded** from this ensemble. Because stablecoins have extreme class
imbalance (most days are near-flat, the UP/DOWN split is heavily skewed), a linear model with
a standard loss function tends to collapse to always predicting the majority class.

| Model | Configuration | Note |
|---|---|---|
| Random Forest | 200 trees, max depth 4, `class_weight='balanced'` | Reweights loss for minority class |
| Gradient Boosting | 200 estimators, lr=0.05, subsample=0.8 | Handles imbalance through boosting |

# Training & Evaluation
For each coin, the pipeline:
1. Selects features on the training split only
2. Runs `TimeSeriesSplit` cross-validation to produce a CV accuracy and standard deviation
3. Re-fits the final model on the full training set
4. Evaluates on the held-out test set using four metrics

Reporting all four metrics is intentional — accuracy alone is misleading under class imbalance,
while precision and recall together reveal whether the model is biased toward always predicting
one direction.

| Metric | What It Measures |
|---|---|
| Accuracy | Overall correct predictions |
| Precision | Of predicted UPs, how many were actually UP |
| Recall | Of actual UP days, how many were correctly caught |
| F1 Score | Harmonic mean of precision and recall |

# Global Pooled Model for Unknown Coins
Individual per-coin models, while accurate on their own coin, overfit to that coin's specific
history — Bitcoin's 2017 bull run, Ethereum's merge dynamics, and so on. When `predict_coin()`
receives a completely unknown coin file, these coin-specific patterns are useless.

The solution is a **global pooled model** trained on all coins within a category concatenated
together. This model learns general market dynamics — how momentum typically behaves, how
volume spikes typically precede moves — rather than memorizing coin-specific episodes. The
regime detector routes the unknown coin to the correct pooled model, which then makes the
prediction.

The final output of `predict_coin()` includes:

| Output Field | Description |
|---|---|
| `prediction` | `"UP"` or `"DOWN"` |
| `confidence` | Probability × 100, expressed as a percentage |
| `category` | Auto-detected coin type |
| `last_date` | Most recent data row used |
| `signal_summary` | Human-readable explanation of the key signals driving the prediction |


### 3. Interactive Web Dashboard & Inference:

we developed a highly interactive cryptocurrency tracking dashboard by strategically decoupling the machine learning pipeline from the frontend architecture. After building and training softvoting classification on aggregated market datasets—engineering key predictive features such as volatility, moving averages, and momentum—I eliminated the need for a persistent Python backend. Instead, I extracted the model's trained weights and intercept and exported them into a static data.json file. The React-based frontend then ingests this configuration to perform lightweight, client-side inference directly in the browser. This architectural approach allows the dashboard to instantly calculate and deliver AI-driven UP or DOWN daily market forecasts, resulting in a seamless, responsive user experience that is highly scalable and cost-effective to host.

##  Setup Instructions

# Prerequisites
First, ensure the following are installed on your system before proceeding:
- Python 3.8 or higher
- pip (Python package manager)
- Git (optional, for cloning the repository)

# 1. Clone the Repository
```bash
git clone https://github.com/your-username/krypton-tokentrend.git
cd krypton-tokentrend
```

# 2. Install Dependencies
All required libraries can be installed in one command:

```bash
pip install numpy pandas matplotlib seaborn scikit-learn
```

Or if a `requirements.txt` is provided:

```bash
pip install -r requirements.txt
```

**Full dependency list:**

| Library | Purpose |
|---|---|
| `numpy` | Numerical operations and array handling |
| `pandas` | Data loading, cleaning, and feature construction |
| `matplotlib` | Plotting accuracy charts and confusion matrices |
| `seaborn` | Enhanced visualizations (heatmaps, bar plots) |
| `scikit-learn` | ML models, pipelines, feature selection, evaluation |


# 3. Prepare the Data
Place all coin CSV files in the **same directory** as the notebook. Each file must follow the
naming convention `coin_<CoinName>.csv` and contain the following columns:


# 4. Run the Notebook
Launch Jupyter and open the notebook:

```bash
jupyter notebook Krypton.ipynb
```

Then run all cells sequentially from top to bottom using **Kernel → Restart & Run All**.

The notebook will automatically:
- Detect and load all `coin_*.csv` files from the current directory
- Clean and categorize all 23 coins
- Engineer features, select top-K features, and split data
- Train three category-specific ensemble models
- Evaluate on held-out test sets and display results
- Export model weights to `model_weights.json`

# 5. Predicting an Unknown Coin
To run inference on any new coin CSV file, navigate to **Cell 30** and update the file path:

```python
TEST_FILE_PATH = 'coin_UNKNOWN.csv'   # ← replace with the test file name
```

Then run that cell. The `predict_coin()` function will:
1. Load and clean the file automatically
2. Detect the coin's category (stablecoin / DeFi-short / volatile)
3. Engineer the appropriate features
4. Route to the correct global pooled model
5. Return a prediction with confidence score and signal summary
   
Local Setup of website & Installation

Prerequisites
Ensure you have the following installed on your local machine:

Node.js (v16 or higher is recommended)

npm (comes with Node.js) or Yarn

Quick Start
1. Clone the repository

Bash
git clone https://github.com/warrior2323/jets-intras.git
2. Navigate to the project directory

Bash
cd Submission_Krypton
3. Install dependencies

Bash
npm install
# or if using yarn: yarn install
4. Start the development server

Bash
npm start
# or if using yarn: yarn start
5. View the dashboard
Open http://localhost:3000 in your browser to view the application.

##  Screenshots
* [Screenshot of the Main Tracking Dashboard and Charts]
* [Screenshot highlighting the AI UP/DOWN Prediction UI]
