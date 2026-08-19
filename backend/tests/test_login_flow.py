from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 800})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto("https://site-accounting-8.preview.emergentagent.com/login", wait_until="networkidle")
    page.wait_for_timeout(1500)
    page.fill("[data-testid='login-username-input']", "aabm61@gmail.com")
    page.fill("[data-testid='login-password-input']", "admin123")
    print("username value:", page.input_value("[data-testid='login-username-input']"))
    page.click("[data-testid='login-submit-btn']")
    try:
        page.wait_for_url("**/dashboard", timeout=15000)
        page.wait_for_timeout(3000)
        print("FINAL URL:", page.url)
        print("BODY SNIPPET:", page.inner_text("body")[:250].replace("\n", " | "))
        page.screenshot(path="/tmp/dashboard_final.png", quality=30, type="jpeg")
        print("LOGIN FLOW: SUCCESS")
    except Exception as e:
        print("LOGIN FLOW: FAILED ->", e)
        print("URL:", page.url)
        page.screenshot(path="/tmp/fail.png", quality=30, type="jpeg")
    if errors:
        print("CONSOLE ERRORS:", errors[:5])
    browser.close()
