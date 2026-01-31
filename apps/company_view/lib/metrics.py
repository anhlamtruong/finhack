import pandas as pd

def compute_kpis(df: pd.DataFrame, col_date: str, col_amount: str, col_account: str) -> dict:
    if df.empty:
        return {
            "total_tx": 0,
            "unique_accounts": 0,
            "income": 0.0,
            "spend": 0.0,
            "net": 0.0,
            "active_accounts_7d": 0,
        }

    income = df.loc[df[col_amount] > 0, col_amount].sum()
    spend = -df.loc[df[col_amount] < 0, col_amount].sum()
    net = income - spend

    unique_accounts = df[col_account].nunique()

    # Active accounts in last 7 days based on latest date in dataset
    last_day = pd.to_datetime(df[col_date]).max()
    cutoff = last_day - pd.Timedelta(days=7)
    active_accounts_7d = df.loc[df[col_date] >= cutoff, col_account].nunique()

    return {
        "total_tx": int(len(df)),
        "unique_accounts": int(unique_accounts),
        "income": float(income),
        "spend": float(spend),
        "net": float(net),
        "active_accounts_7d": int(active_accounts_7d),
    }

def daily_series(df: pd.DataFrame, col_date: str, col_amount: str) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["day", "income", "spend", "net"])

    tmp = df.copy()
    tmp["day"] = pd.to_datetime(tmp[col_date]).dt.date
    income = tmp[tmp[col_amount] > 0].groupby("day")[col_amount].sum()
    spend = -tmp[tmp[col_amount] < 0].groupby("day")[col_amount].sum()
    out = pd.DataFrame({"income": income, "spend": spend}).fillna(0.0)
    out["net"] = out["income"] - out["spend"]
    out = out.reset_index()
    return out

def top_entities(df: pd.DataFrame, col_amount: str, col_category: str, col_payee: str, n: int = 8):
    if df.empty:
        return (pd.DataFrame(), pd.DataFrame())

    spend_df = df[df[col_amount] < 0].copy()
    if spend_df.empty:
        return (pd.DataFrame(), pd.DataFrame())

    by_cat = spend_df.groupby(col_category)[col_amount].sum().sort_values().head(n)
    by_payee = spend_df.groupby(col_payee)[col_amount].sum().sort_values().head(n)

    cat = by_cat.reset_index().rename(columns={col_amount: "spend"})
    cat["spend"] = -cat["spend"]
    payee = by_payee.reset_index().rename(columns={col_amount: "spend"})
    payee["spend"] = -payee["spend"]
    return cat, payee

def overspend_alerts(df: pd.DataFrame, col_amount: str, col_account: str, n: int = 10):
    """
    Accounts with net < 0 (overspent) in the selected window.
    """
    if df.empty:
        return pd.DataFrame(columns=[col_account, "income", "spend", "net"])

    g = df.groupby(col_account)[col_amount].sum().sort_values()
    neg = g[g < 0].head(n)
    if neg.empty:
        return pd.DataFrame(columns=[col_account, "income", "spend", "net"])

    # build table with income/spend/net
    tmp = df.copy()
    income = tmp[tmp[col_amount] > 0].groupby(col_account)[col_amount].sum()
    spend = -tmp[tmp[col_amount] < 0].groupby(col_account)[col_amount].sum()
    out = pd.DataFrame({
        col_account: neg.index,
        "income": income.reindex(neg.index).fillna(0.0).values,
        "spend": spend.reindex(neg.index).fillna(0.0).values,
        "net": (income.reindex(neg.index).fillna(0.0) - spend.reindex(neg.index).fillna(0.0)).values
    })
    out = out.sort_values("net")
    return out