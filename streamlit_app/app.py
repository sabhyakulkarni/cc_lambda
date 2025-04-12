import streamlit as st
import requests

API_URL = "http://localhost:5000"

st.title("☁️ Function Management Dashboard")

# Tabs
tab1, tab2, tab3 = st.tabs(["➕ Submit Function", "📋 Manage Functions", "📈 Monitor"])

# Submit Function
with tab1:
    st.subheader("Submit a New Function")
    title = st.text_input("Title")
    description = st.text_area("Description")
    route = st.text_input("Route", "/my-function")
    language = st.selectbox("Language", ["python", "javascript"])
    timeout = st.number_input("Timeout (in seconds)", 1, 30, 5)
    code = st.text_area("Function Code", height=150)

    if st.button("Submit Function"):
        payload = {
            "title": title,
            "description": description,
            "route": route,
            "language": language,
            "timeout": timeout,
            "code": code
        }
        res = requests.post(f"{API_URL}/submit-function", json=payload)
        if res.status_code == 201:
            st.success("✅ Function submitted!")
        else:
            st.error("❌ Submission failed!")

# Manage Functions
with tab2:
    st.subheader("All Functions")
    res = requests.get(f"{API_URL}/functions")
    if res.ok:
        functions = res.json()
        for f in functions:
            st.markdown(f"**ID {f['id']}** | `{f['language']}` | {f['title']}")
            if st.button(f"Execute {f['id']}", key=f"id_{f['id']}"):
                exec_res = requests.post(f"{API_URL}/execute", json={"functionId": f["id"]})
                st.code(exec_res.json())

# Monitoring Dashboard
with tab3:
    st.subheader("Metrics Summary")
    res = requests.get(f"{API_URL}/metrics-summary")
    if res.ok:
        data = res.json()
        st.table(data)
