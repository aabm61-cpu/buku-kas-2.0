from playwright.sync_api import sync_playwright

PAGES = ["/users", "/clients", "/projects", "/locations", "/tagihan", "/cashbook", "/team-payments", "/history-bukukas", "/history", "/activities"]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 800})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    base = "https://site-accounting-8.preview.emergentagent.com"
    page.goto(base + "/login", wait_until="networkidle")
    page.fill("[data-testid='login-username-input']", "aabm61@gmail.com")
    page.fill("[data-testid='login-password-input']", "admin123")
    page.click("[data-testid='login-submit-btn']")
    page.wait_for_url("**/dashboard", timeout=15000)
    page.wait_for_timeout(1500)
    # discover actual routes from sidebar links
    hrefs = page.eval_on_selector_all("aside a, nav a", "els => els.map(e => e.getAttribute('href'))")
    print("SIDEBAR ROUTES:", hrefs)
    for route in [h for h in hrefs if h and h.startswith("/")]:
        page.goto(base + route, wait_until="networkidle")
        page.wait_for_timeout(1200)
        body = page.inner_text("body")
        status = "OK" if len(body.strip()) > 50 else "SUSPICIOUS(short body)"
        print(f"{route}: {status} len={len(body)}")
    print("PAGE ERRORS:", errors if errors else "none")
    browser.close()
