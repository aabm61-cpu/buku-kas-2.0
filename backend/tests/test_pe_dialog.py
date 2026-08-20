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
    page.goto(BASE + "/team-payments", wait_until="networkidle")
    page.wait_for_timeout(1500)
    page.click("[data-testid='tp-tab-entries']")
    page.wait_for_timeout(800)
    page.locator("button:has-text('Buat Pembayaran')").first.click()
    page.wait_for_timeout(600)
    page.click("[data-testid='pe-month-select']")
    page.wait_for_timeout(400)
    opts = page.locator("[data-testid^='pe-month-opt-']")
    print("Opsi bulan:", opts.count())
    if opts.count():
        opts.first.click()
        page.wait_for_timeout(400)
        page.click("[data-testid='pe-period-select']")
        page.wait_for_timeout(400)
        page.click("[data-testid='pe-period-opt-1-15']")
        page.wait_for_timeout(800)
        heads = page.locator("[role='dialog'] th").all_inner_texts()
        print("HEADER TABEL PROYEK DITEMUKAN:", heads)
        rows = page.locator("[data-testid^='pe-proj-row-']")
        if rows.count():
            print("ISI SEL PROYEK BARIS 1:", rows.first.locator("td").first.inner_text().replace("\n", " | "))
        page.screenshot(path="/app/pe_dialog.png", quality=30, type="jpeg")
    else:
        print("Tidak ada bulan tersedia (tidak ada proyek Siap Dibayar) — cek header tetap dilakukan jika tabel muncul")
    browser.close()
