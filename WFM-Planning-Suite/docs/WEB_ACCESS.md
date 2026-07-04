# How to Use the Web App (No Technical Skills Needed)

## Your app link (after setup)

Once the project is merged and GitHub Pages is enabled, open:

**https://ahmbaioumy.github.io/ahmbaioumy/**

Bookmark this link — that's your app.

---

## One-time setup (ask GitHub or IT once)

1. **Merge the pull request** on GitHub (the green "Merge" button on PR #5)
2. Go to your repo: https://github.com/ahmbaioumy/ahmbaioumy
3. Click **Settings** → **Pages** (left menu)
4. Under **Build and deployment**, set **Source** to **GitHub Actions**
5. Wait 2–5 minutes for the first deploy to finish
6. Open the link above in Chrome or Edge

---

## How to test the app

1. Open the link in your browser
2. Click **Browse File** on the Upload step
3. Or download the sample file first: click **sample_data.csv** on that screen
4. Click **Next** through all 8 steps:
   - Upload → Profile → Cleanse → Forecast → Size → Schedule → Simulate → Report
5. On the last step, click **Export to Excel** to save your report

**Success =** you uploaded data, clicked through all steps, and downloaded an Excel report.

---

## Important notes

- **No install needed** — it runs in your browser like a website
- **Your data stays private** — files are processed on your computer in the browser, not uploaded to a server
- **Works on phone?** — possible but a computer is easier for CSV files
- **Internet required** — only to open the website the first time; calculations happen locally in the browser

---

## If the link doesn't work yet

The link works only **after**:
1. The pull request is merged to `main`
2. GitHub Pages is set to **GitHub Actions** (step above)
3. The deploy workflow finishes (check **Actions** tab on GitHub — green checkmark)

If you need help, share the **Actions** tab screenshot with whoever helps you on GitHub.
