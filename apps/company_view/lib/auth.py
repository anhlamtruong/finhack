import streamlit as st

def require_login(username: str, password: str) -> None:
    if st.session_state.get("authed") is True:
        return

    st.title("Chuchube Company View (✿ ◠‿◠)")
    st.caption("Admin monitoring dashboard")

    with st.form("login", clear_on_submit=False):
        u = st.text_input("Username", value="", placeholder="admin")
        p = st.text_input("Password", value="", type="password", placeholder="••••••••")
        ok = st.form_submit_button("Sign in")

    if ok:
        if (u == username) and (p == password):
            st.session_state["authed"] = True
            st.success("Signed in.")
            st.rerun()
        else:
            st.error("iiiinvalid credentials!!")
    st.stop()

def logout_button():
    import streamlit as st
    if st.sidebar.button("Logout (ᵔᴥᵔ)"):
        st.session_state["authed"] = False
        st.rerun()