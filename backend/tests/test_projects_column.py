from playwright.sync_api import sync_playwright

BASE = "https://site-accounting-8.preview.emergentagent.com"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 900})
    page.goto(BASE + "/login", wait_until="networkidle")
    page.fill("[data-testid='login-username-input']", "aabm61@gmail.com")
    page.fill("[data-testid='login-password-input']", "admin123")
    page.click("[data-testid='login-submit-btn']")
    page.wait_for_url("**/dashboard", timeout=15000)
    page.goto(BASE + "/projects", wait_until="networkidle")
    page.wait_for_timeout(1500)
    heads = page.locator("table th").all_inner_texts()
    print("HEADER TAB BERJALAN:", heads)
    row = page.locator("[data-testid^='proj-row-']").first
    print("SEL PROYEK BARIS 1:", row.locator("td").first.inner_text().replace("\n", " | "))
    page.screenshot(path="/app/projects_tab.png", quality=30, type="jpeg")
    page.click("[data-testid='tab-selesai']")
    page.wait_for_timeout(800)
    heads2 = [h for h in page.locator("table th").all_inner_texts() if h]
    print("HEADER TAB SELESAI:", heads2)
    rowS = page.locator("[data-testid^='proj-row-']").first
    if rowS.count():
        print("SEL PROYEK SELESAI BARIS 1:", rowS.locator("td").first.inner_text().replace("\n", " | "))
    browser.close()
    print("DONE")
