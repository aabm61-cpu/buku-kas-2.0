from playwright.sync_api import sync_playwright

BASE = "https://site-accounting-8.preview.emergentagent.com"

def login(page, u, pw):
    page.goto(BASE + "/login", wait_until="networkidle")
    page.fill("[data-testid='login-username-input']", u)
    page.fill("[data-testid='login-password-input']", pw)
    page.click("[data-testid='login-submit-btn']")
    page.wait_for_url("**/dashboard", timeout=15000)
    page.wait_for_timeout(1000)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # --- Owner: Entry Pembayaran ---
    page = browser.new_page(viewport={"width": 1920, "height": 900})
    login(page, "aabm61@gmail.com", "admin123")
    page.goto(BASE + "/team-payments", wait_until="networkidle")
    page.wait_for_timeout(1500)
    page.click("[data-testid='tp-tab-entries']")
    page.wait_for_timeout(1000)
    titles = page.locator("[data-testid^='pe-group-title-']").all_inner_texts()
    print("URUTAN GRUP ENTRY:", titles)
    # open Buat Pembayaran dialog
    btn = page.locator("button:has-text('Buat Pembayaran')")
    print("Tombol Buat Pembayaran:", btn.count())
    if btn.count():
        btn.first.click()
        page.wait_for_timeout(800)
        heads = page.locator("[role='dialog'] th").all_inner_texts()
        print("HEADER DIALOG BUAT PEMBAYARAN:", heads)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
    # open member detail dialog
    det = page.locator("[data-testid^='pe-member-detail-btn-']")
    if det.count():
        det.first.click()
        page.wait_for_timeout(800)
        heads = page.locator("[role='dialog'] th").all_inner_texts()
        print("HEADER DETAIL ANGGOTA:", heads)
        page.screenshot(path="/app/tp_detail.png", quality=30, type="jpeg")
        page.keyboard.press("Escape")
    page.close()

    # --- Tim: Pembayaran Saya ---
    page = browser.new_page(viewport={"width": 1920, "height": 900})
    login(page, "tim.test", "tim12345")
    page.goto(BASE + "/my-payments", wait_until="networkidle")
    page.wait_for_timeout(1500)
    print("URL MyPayments:", page.url)
    rows = page.locator("[data-testid^='mp-entry-row-']")
    print("Jumlah baris pembayaran saya:", rows.count())
    periods = page.locator("[data-testid^='mp-entry-row-'] td:first-child div:first-child").all_inner_texts()
    print("URUTAN PERIODE MY PAYMENTS:", periods)
    d = page.locator("[data-testid^='mp-detail-btn-']")
    if d.count():
        d.first.click()
        page.wait_for_timeout(800)
        heads = page.locator("[role='dialog'] th").all_inner_texts()
        print("HEADER DETAIL MY PAYMENTS:", heads)
    page.close()
    browser.close()
    print("ALL CHECKS DONE")
