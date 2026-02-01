# apps/company_view/lib/viz.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Iterable

import plotly.express as px
import plotly.graph_objects as go


# -----------------------------
# Styling + helpers
# -----------------------------

@dataclass
class VizStyle:
    height_sm: int = 280
    height_md: int = 340
    height_lg: int = 420

    margin_l: int = 10
    margin_r: int = 10
    margin_t: int = 10
    margin_b: int = 10

    template: str = "plotly_white"
    hovermode: str = "x unified"

    paper_bg: str = "rgba(0,0,0,0)"
    plot_bg: str = "rgba(0,0,0,0)"


STYLE = VizStyle()


def _is_empty_df(df) -> bool:
    try:
        return df is None or len(df) == 0
    except Exception:
        return True


def _empty_fig(message: str = "No data") -> go.Figure:
    fig = go.Figure()
    fig.add_annotation(
        text=message,
        x=0.5,
        y=0.5,
        xref="paper",
        yref="paper",
        showarrow=False,
        font=dict(size=14),
    )
    fig.update_layout(
        template=STYLE.template,
        height=STYLE.height_md,
        margin=dict(l=STYLE.margin_l, r=STYLE.margin_r, t=STYLE.margin_t, b=STYLE.margin_b),
        paper_bgcolor=STYLE.paper_bg,
        plot_bgcolor=STYLE.plot_bg,
    )
    return fig


def _apply_layout(fig: go.Figure, *, height: int, showlegend: bool = True, hovermode: Optional[str] = None) -> go.Figure:
    fig.update_layout(
        template=STYLE.template,
        height=height,
        hovermode=hovermode or STYLE.hovermode,
        margin=dict(l=STYLE.margin_l, r=STYLE.margin_r, t=STYLE.margin_t, b=STYLE.margin_b),
        paper_bgcolor=STYLE.paper_bg,
        plot_bgcolor=STYLE.plot_bg,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1) if showlegend else dict(),
    )
    return fig


def _apply_currency_axis(fig: go.Figure, axis: str = "y", prefix: str = "$") -> go.Figure:
    # axis = "y" or "x"
    if axis == "y":
        fig.update_yaxes(tickprefix=prefix, separatethousands=True)
    else:
        fig.update_xaxes(tickprefix=prefix, separatethousands=True)
    return fig


def _safe_cols(df, cols: Iterable[str]) -> bool:
    try:
        have = set(df.columns)
        return all(c in have for c in cols)
    except Exception:
        return False


# -----------------------------
# Charts
# -----------------------------

def line_income_spend_net(
    daily_df,
    *,
    day_col: str = "day",
    income_col: str = "income",
    spend_col: str = "spend",
    net_col: str = "net",
    height: int = STYLE.height_md,
    currency: bool = True,
) -> go.Figure:
    """
    Line chart for daily income/spend/net.
    Expects columns: day, income, spend, net (customizable via args).
    """
    if _is_empty_df(daily_df):
        return _empty_fig("No daily cashflow data")

    needed = [day_col, income_col, spend_col, net_col]
    if not _safe_cols(daily_df, needed):
        return _empty_fig(f"Missing columns: {', '.join([c for c in needed if c not in getattr(daily_df, 'columns', [])])}")

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=daily_df[day_col], y=daily_df[income_col], name="Income", mode="lines+markers"))
    fig.add_trace(go.Scatter(x=daily_df[day_col], y=daily_df[spend_col], name="Spend", mode="lines+markers"))
    fig.add_trace(go.Scatter(x=daily_df[day_col], y=daily_df[net_col], name="Net", mode="lines+markers"))

    fig.update_xaxes(title_text="")
    fig.update_yaxes(title_text="")

    _apply_layout(fig, height=height, showlegend=True, hovermode="x unified")

    if currency:
        _apply_currency_axis(fig, "y", "$")

    return fig


def donut(
    df,
    names_col: str,
    values_col: str,
    *,
    height: int = STYLE.height_md,
    hole: float = 0.55,
    title: Optional[str] = None,
) -> go.Figure:
    """
    Donut chart (pie with hole).
    """
    if _is_empty_df(df):
        return _empty_fig("No data for donut chart")

    if not _safe_cols(df, [names_col, values_col]):
        return _empty_fig(f"Missing columns: {names_col}, {values_col}")

    fig = px.pie(df, names=names_col, values=values_col, hole=hole)

    fig.update_traces(textposition="inside", textinfo="percent+label")
    fig.update_layout(title=title or None, legend_title_text="")

    _apply_layout(fig, height=height, showlegend=True, hovermode="closest")
    return fig


def bar(
    df,
    x: str,
    y: str,
    *,
    height: int = STYLE.height_md,
    title: Optional[str] = None,
    currency: bool = False,
    sort_desc: bool = True,
    show_values: bool = True,
) -> go.Figure:
    """
    Simple bar chart.
    """
    if _is_empty_df(df):
        return _empty_fig("No data for bar chart")

    if not _safe_cols(df, [x, y]):
        return _empty_fig(f"Missing columns: {x}, {y}")

    d = df
    try:
        d = df.sort_values(by=y, ascending=not sort_desc)
    except Exception:
        pass

    fig = px.bar(d, x=x, y=y, text=y if show_values else None, title=title)

    if show_values:
        fig.update_traces(texttemplate="%{text:,.0f}", textposition="outside")

    fig.update_xaxes(title_text="")
    fig.update_yaxes(title_text="")

    _apply_layout(fig, height=height, showlegend=False, hovermode="closest")

    if currency:
        _apply_currency_axis(fig, "y", "$")

    return fig


def stacked_bar(
    df,
    *,
    x: str,
    y: str,
    color: str,
    height: int = STYLE.height_lg,
    title: Optional[str] = None,
    currency: bool = False,
) -> go.Figure:
    """
    Stacked bar chart. Great for category-by-month breakdowns.
    """
    if _is_empty_df(df):
        return _empty_fig("No data for stacked bar")

    if not _safe_cols(df, [x, y, color]):
        return _empty_fig(f"Missing columns: {x}, {y}, {color}")

    fig = px.bar(df, x=x, y=y, color=color, title=title)
    fig.update_layout(barmode="stack")
    fig.update_xaxes(title_text="")
    fig.update_yaxes(title_text="")

    _apply_layout(fig, height=height, showlegend=True, hovermode="x unified")

    if currency:
        _apply_currency_axis(fig, "y", "$")

    return fig


def waterfall_net(
    df,
    *,
    label_col: str = "label",
    value_col: str = "value",
    height: int = STYLE.height_md,
    title: Optional[str] = None,
    currency: bool = True,
) -> go.Figure:
    """
    Waterfall for contributions (e.g., income sources vs expense sources).
    Expects columns: label, value.
    """
    if _is_empty_df(df):
        return _empty_fig("No data for waterfall")

    if not _safe_cols(df, [label_col, value_col]):
        return _empty_fig(f"Missing columns: {label_col}, {value_col}")

    fig = go.Figure(
        go.Waterfall(
            x=df[label_col],
            y=df[value_col],
            measure=["relative"] * len(df),
            connector={"line": {"width": 1}},
        )
    )
    fig.update_layout(title=title or None)
    fig.update_xaxes(title_text="")
    fig.update_yaxes(title_text="")

    _apply_layout(fig, height=height, showlegend=False, hovermode="x")

    if currency:
        _apply_currency_axis(fig, "y", "$")

    return fig


def heatmap(
    df,
    *,
    x: str,
    y: str,
    z: str,
    height: int = STYLE.height_lg,
    title: Optional[str] = None,
) -> go.Figure:
    """
    Heatmap (e.g., weekday vs hour spend).
    """
    if _is_empty_df(df):
        return _empty_fig("No data for heatmap")

    if not _safe_cols(df, [x, y, z]):
        return _empty_fig(f"Missing columns: {x}, {y}, {z}")

    fig = px.density_heatmap(df, x=x, y=y, z=z, histfunc="sum", title=title)
    fig.update_xaxes(title_text="")
    fig.update_yaxes(title_text="")

    _apply_layout(fig, height=height, showlegend=False, hovermode="closest")
    return fig