import subprocess
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]


class ConsoleBrowserSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(["node", "scripts/build-console.js"], cwd=ROOT, check=True)
        cls.server = subprocess.Popen(["node", "apps/console/fixtures/browser-server.js"], cwd=ROOT, stdout=subprocess.PIPE, text=True)
        cls.origin = f"http://127.0.0.1:{cls.server.stdout.readline().strip()}"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.firefox.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.terminate()
        cls.server.wait(timeout=5)

    def test_sec007_production_console(self):
        context = self.browser.new_context()
        page = context.new_page()
        page.set_default_timeout(5000)
        page.add_init_script("globalThis.__nolenXss = false")
        response = page.goto(self.origin + "/")
        self.assertEqual(page.url, self.origin + "/login")
        self.assertNotIn("incident-browser-1", page.content())
        self.assertIn('name="username"', page.content(), page.content())

        self.assertEqual(page.locator("input").count(), 2, page.content())
        page.locator("input").nth(0).fill("analyst")
        page.locator("input").nth(1).fill("analyst-password")
        response = page.get_by_role("button", name="Enter Console").click()
        page.wait_for_url(self.origin + "/")
        page.get_by_text("Incident Queue").wait_for()
        page.screenshot(path="/tmp/nolen-console-sec007.png", full_page=True)
        headers = page.request.get(self.origin + "/", headers={"cookie": "; ".join(f"{c['name']}={c['value']}" for c in context.cookies())}).headers
        self.assertIn("script-src 'nonce-", headers["content-security-policy"])
        self.assertIn("no-store", headers["cache-control"])

        page.get_by_text("<img src=x", exact=False).first.click()
        page.get_by_role("dialog").wait_for()
        self.assertEqual(page.locator("img").count(), 0)
        self.assertEqual(page.locator("svg").count(), 0)
        self.assertFalse(page.evaluate("globalThis.__nolenXss"))
        page.get_by_role("button", name="Close").click()

        page.get_by_role("link", name="Event Explorer").click()
        page.get_by_role("button", name="Search").click()
        page.locator("details").first.click()
        self.assertIn("[REDACTED]", page.locator("pre").text_content())
        self.assertFalse(page.evaluate("globalThis.__nolenXss"))

        page.goto(self.origin + "/endpoints")
        page.get_by_text("Endpoint Status").wait_for()
        self.assertEqual(page.locator("img").count(), 0)
        self.assertFalse(page.evaluate("globalThis.__nolenXss"))
        self.assertEqual(page.evaluate("[localStorage.length, sessionStorage.length]"), [0, 0])

        csrf = page.evaluate("fetch('/api/session').then(r => r.json()).then(v => v.csrf)")
        status = page.evaluate("csrf => fetch('/api/incidents/incident-browser-1/status', {method:'POST', headers:{'content-type':'application/json','x-csrf-token':csrf}, body:JSON.stringify({status:'resolved'})}).then(r => r.status)", csrf)
        self.assertEqual(status, 403)

        page.evaluate("csrf => fetch('/logout', {method:'POST', headers:{'x-csrf-token':csrf}})", csrf)
        page.goto(self.origin + "/", wait_until="domcontentloaded")
        self.assertEqual(page.url, self.origin + "/login")
        self.assertNotIn("incident-browser-1", page.content())
        context.close()

        admin = self.browser.new_context()
        admin_page = admin.new_page()
        admin_page.goto(self.origin + "/login")
        admin_page.locator("input").nth(0).fill("admin")
        admin_page.locator("input").nth(1).fill("admin-password")
        admin_page.get_by_role("button", name="Enter Console").click()
        admin_page.get_by_text("Incident Queue").wait_for()
        admin_page.get_by_text("<img src=x", exact=False).first.click()
        admin_page.get_by_label("Update Status").select_option("resolved")
        admin_page.get_by_role("button", name="Save Status").click()
        admin_page.get_by_role("cell", name="resolved").wait_for()
        admin.close()


if __name__ == "__main__":
    unittest.main()
