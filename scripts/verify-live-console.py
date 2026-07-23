from pathlib import Path
from os import environ
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
password = (root / "secrets/console_analyst_password").read_text().strip()
console_url = environ.get("NOLEN_CONSOLE_URL", "http://127.0.0.1:3000")
with sync_playwright() as playwright:
    browser = playwright.firefox.launch(headless=True)
    page = browser.new_page()
    page.set_default_timeout(15_000)
    page.add_init_script("globalThis.__nolenXss = false")
    page.goto(f"{console_url}/login", wait_until="domcontentloaded")
    page.locator("input").nth(0).fill("analyst")
    page.locator("input").nth(1).fill(password)
    page.get_by_role("button", name="Enter Console").click()
    page.get_by_text("Probable SSH Account Compromise", exact=True).wait_for(timeout=15_000)
    page.get_by_text("Probable SSH Account Compromise", exact=True).click()
    page.get_by_text("Evidence Timeline", exact=True).wait_for(timeout=15_000)
    assert page.locator(".timeline li").count() == 12
    assert not page.evaluate("globalThis.__nolenXss")
    page.screenshot(path="/tmp/nolen-console-live.png", full_page=True)
    browser.close()
print("Live SOC console incident verification passed.")
