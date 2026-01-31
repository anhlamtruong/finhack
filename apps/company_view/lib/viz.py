import plotly.express as px
import plotly.graph_objects as go

def line_income_spend_net(daily_df):
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=daily_df["day"], y=daily_df["income"], name="Income"))
    fig.add_trace(go.Scatter(x=daily_df["day"], y=daily_df["spend"], name="Spend"))
    fig.add_trace(go.Scatter(x=daily_df["day"], y=daily_df["net"], name="Net"))
    fig.update_layout(
        height=360,
        hovermode="x unified",
        margin=dict(l=10, r=10, t=10, b=10),
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
    )
    return fig

def donut(df, names_col, values_col, height=320):
    fig = px.pie(df, names=names_col, values=values_col, hole=0.55)
    fig.update_layout(
        height=height,
        margin=dict(l=10, r=10, t=10, b=10),
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        legend_title_text="",
    )
    return fig

def bar(df, x, y, height=320):
    fig = px.bar(df, x=x, y=y, text=y)
    fig.update_traces(texttemplate="%{text:,.0f}", textposition="outside")
    fig.update_layout(
        height=height,
        margin=dict(l=10, r=10, t=10, b=10),
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
    )
    return fig