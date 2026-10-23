# -*- coding: utf-8 -*-
"""Real unpacked MV3 extension, isolated temp profile, synthetic pages, offline API.

Requires Python Playwright and its Chromium (or LINGOLENS_CHROMIUM executable).
No user profile, real site, API credentials, or translation service is used.
"""
import json
import os
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"
FIXTURE = (ROOT / "tests/fixtures/work.html").read_text(encoding="utf-8")
checks = []


def check(name, condition):
    assert condition, name
    checks.append(name)
    print("PASS " + name, flush=True)


with sync_playwright() as p, tempfile.TemporaryDirectory(prefix="lingolens-test-") as profile:
    executable = os.environ.get("LINGOLENS_CHROMIUM", p.chromium.executable_path)
    ctx = p.chromium.launch_persistent_context(
        profile, executable_path=executable, headless=True, timeout=30000,
        ignore_default_args=["--disable-extensions"],
        args=[f"--disable-extensions-except={ROOT}", f"--load-extension={ROOT}",
              "--no-first-run", "--disable-background-networking"])
    try:
        def route_offline(route):
            if route.request.url.startswith("http://lingolens.test/"):
                route.fulfill(content_type="text/html", body=FIXTURE)
            elif route.request.url.startswith("chrome-extension://"):
                route.continue_()
            else:
                route.abort()
        ctx.route("**/*", route_offline)
        worker = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker")
        worker.evaluate("""async () => {
          globalThis.calls = [];
          chrome.runtime.onMessage.addListener((message, sender) => { if (sender.tab) globalThis.fixtureTabId = sender.tab.id; });
          globalThis.fetch = async (url, opts = {}) => {
            const body = JSON.parse(opts.body || '{}');
            calls.push({url: String(url), body});
            return new Response(JSON.stringify({choices: [{message: {content: JSON.stringify({translation: `Synthetic result ${calls.length}`})}}]}), {status:200});
          };
          await chrome.storage.local.set({settings: {provider:'openai', openaiApiKey:'synthetic-test-key', openaiModel:'synthetic-a', sendContext:true, autoTranslate:true, saveAutomatically:true}});
        }""")
        ext = ctx.new_page()
        ext.goto(worker.url.replace("background.js", "options.html"))
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto("http://lingolens.test/work")
        page.wait_for_timeout(300)

        def count():
            return worker.evaluate("calls.length")

        def reset_cache():
            worker.evaluate("chrome.storage.local.set({translationCache:{}})")

        def settings(**values):
            worker.evaluate("""async values => { const {settings} = await chrome.storage.local.get('settings'); await chrome.storage.local.set({settings:{...settings,...values}}); }""", values)
            page.wait_for_timeout(100)

        def cleanup():
            page.evaluate("document.querySelector('lingolens-card')?.remove()")
            page.mouse.move(1100, 5)

        def select(id, target=None, wait=350):
            cleanup()
            page.evaluate("""({id,target}) => {
              const el=document.getElementById(id); const r=document.createRange(); r.selectNodeContents(el);
              getSelection().removeAllRanges(); getSelection().addRange(r);
              (document.getElementById(target)||el).dispatchEvent(new MouseEvent('mouseup',{bubbles:true,composed:true}));
            }""", {"id": id, "target": target or id})
            page.wait_for_timeout(wait)

        def expect_selection(id, allowed, label=None, target=None):
            reset_cache()
            before = count()
            select(id, target)
            check(label or f"selection {id}", count() - before == int(allowed))
            check(f"card visibility {id}", page.locator("lingolens-card").count() == int(allowed))

        for lang in ["zh-CN", "en", ""]:
            page.evaluate("lang => document.documentElement.lang=lang", lang)
            for id in ["chinese", "mixed", "mixed-short", "number", "punctuation", "blank", "url", "email", "identifier", "inline-code", "pre", "code"]:
                expect_selection(id, False, f"{lang or 'missing lang'} ignores {id}")
            for id in ["english", "word", "abbreviation", "nested-word", "isolated-ai"]:
                expect_selection(id, True, f"{lang or 'missing lang'} allows {id}")
        for id in ["empty-editor", "true-editor", "plain-editor", "false-island", "aria-editor", "prose-editor", "monaco-editor", "slate-editor"]:
            expect_selection(id, False)
        expect_selection("true-editor", False, "mouseup outside editor still protected", target="english")

        for id in ["input", "textarea"]:
            cleanup()
            before = count()
            page.locator("#" + id).focus()
            page.evaluate("id=>{const el=document.getElementById(id);el.select();el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));}", id)
            page.wait_for_timeout(350)
            check(f"{id} does not automatically translate", count() == before)

        cleanup()
        page.evaluate("getSelection().removeAllRanges()")
        before = count()
        page.locator("#rename-trigger").click()
        page.wait_for_timeout(350)
        check("clicking rename never translates its programmatic editor selection", count() == before)
        check("rename click never opens a translation card", page.locator("lingolens-card").count() == 0)

        page.locator("#rename-editor").evaluate("el=>{el.hidden=true;el.blur();getSelection().removeAllRanges()}")
        reset_cache()
        before = count()
        select("english")
        check("selection opens one translation before dismissal", count() == before + 1 and page.locator("lingolens-card").count() == 1)
        page.locator("lingolens-card [data-close]").click()
        page.wait_for_timeout(350)
        check("closing translation card does not reopen for the unchanged selection", count() == before + 1 and page.locator("lingolens-card").count() == 0)

        page.locator("#textarea").evaluate("el=>el.blur()")
        page.evaluate("document.designMode='on'")
        expect_selection("english", False, "document design mode is protected")
        page.evaluate("document.designMode='off'")

        before = count()
        page.evaluate("""() => {const r=document.createRange();r.setStart(document.getElementById('cross-start').firstChild,0);r.setEnd(document.getElementById('cross-end').firstChild,14);getSelection().removeAllRanges();getSelection().addRange(r);document.getElementById('cross').dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));}""")
        page.wait_for_timeout(350)
        check("range crossing an editable island is protected", count() == before)

        page.evaluate("""() => {document.getElementById('dynamic').innerHTML='<p><span id="dynamic-word">Dynamic English sentence</span></p><div contenteditable=""><span id="dynamic-editor">Dynamic editor draft</span></div>'; }""")
        expect_selection("dynamic-word", True)
        expect_selection("dynamic-editor", False)
        expect_selection("safe-word", True)
        check("context excludes editable neighbours", "Confidential draft marker" not in worker.evaluate("calls.at(-1).body.messages[1].content"))
        expect_selection("isolated-ai", True)
        check("Chinese surrounding paragraph stays out of context", worker.evaluate("calls.at(-1).body.messages[1].content.endsWith('附近语境：AI')"))

        expect_selection("visibility-word", True)
        hidden_markers = ["ATTRHIDDENPHRASE", "DISPLAYHIDDENPHRASE", "NESTEDHIDDENPHRASE", "VISIBILITYHIDDENPHRASE", "VISIBLEOVERRIDEPHRASE", "COLLAPSEDHIDDENPHRASE", "OPACITYHIDDENPHRASE", "CONTENTHIDDENPHRASE", "ARIAHIDDENPHRASE", "OVERRIDEHIDDENPHRASE", "CLOSEDDETAILSPHRASE"]
        prompt = worker.evaluate("calls.at(-1).body.messages[1].content")
        saved = worker.evaluate("chrome.storage.local.get('records')")["records"][0]
        for marker in hidden_markers:
            check(f"hidden text never enters request or record: {marker}", marker not in prompt and marker not in saved["context"])
        check("visible display contents text remains in context", "Visible context words." in prompt)

        # Exercise the same policy in the synthetic page world for ancestor and
        # bounded-work invariants; translation checks above use the real extension.
        page.add_script_tag(path=str(ROOT / "trigger-policy.js"))
        check("hidden ancestor outside reading block rejects context", page.evaluate("LingoLensPolicy.readingText(document.getElementById('hidden-ancestor'))===null"))
        for css in ["display:none", "visibility:hidden", "opacity:0", "content-visibility:hidden"]:
            blocked = page.evaluate("""css => {const parent=document.createElement('div');parent.style.cssText=css;const child=document.createElement('p');child.style.visibility='visible';child.textContent='Confidential ancestor draft';parent.append(child);document.body.append(parent);const result=LingoLensPolicy.readingText(child);parent.remove();return result===null;}""", css)
            check(f"ancestor style protects a nested reading block: {css}", blocked)
        bounded = page.evaluate("""() => {
          const container=document.createElement('div');container.innerHTML='<span style="display:none">Confidential hidden draft</span>'.repeat(5000);document.body.append(container);
          const original=window.getComputedStyle;let reads=0;window.getComputedStyle=(...args)=>{reads++;return original(...args);};
          try{return {text:LingoLensPolicy.readingText(container),reads};}finally{window.getComputedStyle=original;container.remove();}
        }""")
        check("large hidden container yields no draft text", bounded["text"] == "")
        check("context style reads stay within node budget", bounded["reads"] <= 500)
        check("context character budget is enforced", page.evaluate("""() => {const p=document.createElement('p');p.textContent='Visible English words '.repeat(1000);document.body.append(p);const size=LingoLensPolicy.readingText(p).length;p.remove();return size<=1500;}"""))

        settings(autoTranslate=False)
        before = count()
        select("mixed")
        check("selection button also rejects Chinese dominant text", count() == before and page.locator("lingolens-card").count() == 0)
        reset_cache()
        select("english")
        check("selection button waits for explicit click", count() == before and page.locator(".ll-trigger").count() == 1)
        page.locator(".ll-trigger").click()
        page.wait_for_timeout(350)
        check("selection button translates its captured valid selection", count() == before + 1)

        settings(autoTranslate=True)
        reset_cache()
        cleanup()
        before = count()
        page.hover("#hover")
        page.wait_for_timeout(700)
        check("hover makes no early prefetch request", count() == before)
        page.wait_for_timeout(2600)
        check("English hover translates after 3 seconds", count() == before + 1)
        OUT.mkdir(exist_ok=True)
        page.screenshot(path=str(OUT / "hover-acceptance.png"), full_page=True)
        for id in ["hover-mixed", "editor-hover", "aria-hover"]:
            cleanup()
            reset_cache()
            before = count()
            page.hover("#" + id)
            page.wait_for_timeout(3300)
            check(f"hover protected: {id}", count() == before)

        for id in ["hover-editor-descendant", "hover-code-descendant", "hover-aria-descendant"]:
            cleanup()
            reset_cache()
            before = count()
            page.locator("#" + id).hover(position={"x": 5, "y": 5})
            page.wait_for_timeout(3300)
            check(f"outer padding never sends excluded descendant label: {id}", count() == before)

        cleanup()
        before = count()
        page.hover("#dynamic-hover")
        page.wait_for_timeout(300)
        page.locator("#dynamic-hover").evaluate("el=>el.setAttribute('contenteditable','')")
        page.wait_for_timeout(3000)
        check("hover rechecks dynamically editable target", count() == before)

        cleanup()
        page.evaluate("""() => {const host=document.getElementById('shadow-host');host.setAttribute('contenteditable','');host.attachShadow({mode:'open'}).innerHTML='<button>Shadow editor label</button>'; }""")
        before = count()
        page.hover("#shadow-host button")
        page.wait_for_timeout(3300)
        check("composed hover path protects shadow editor descendants", count() == before)

        settings(triggerMode="manual")
        expect_selection("english", False, "manual-only suppresses automatic selection")
        cleanup()
        before = count()
        page.hover("#manual-hover")
        page.wait_for_timeout(3300)
        check("manual-only suppresses all hover requests", count() == before)
        page.locator("#manual-editor").focus()
        select("manual-word")

        def manual(text=None, editable=False):
            ext.evaluate("""async ({tabId,text,editable}) => {
              await chrome.tabs.sendMessage(tabId,{type:'TRANSLATE_SELECTED',text,editable});
            }""", {"tabId": worker.evaluate("fixtureTabId"), "text": text, "editable": editable})
            page.wait_for_timeout(350)

        reset_cache()
        before = count()
        manual("approval", True)
        check("explicit menu message can translate an editor selection", count() == before + 1)
        check("manual editor selection sends no neighbours", worker.evaluate("calls.at(-1).body.messages[1].content.endsWith('附近语境：未提供')"))
        cleanup()
        page.locator("#input").focus()
        page.evaluate("document.getElementById('input').setSelectionRange(0,5)")
        before = count()
        manual()
        check("shortcut message reads only selected input text", count() == before + 1 and worker.evaluate("calls.at(-1).body.messages[1].content.includes('选中内容：input\\n')"))
        check("input manual translation excludes other draft text", "Confidential draft marker" not in worker.evaluate("calls.at(-1).body.messages[1].content"))
        page.locator("#password").focus()
        page.locator("#password").evaluate("el=>el.select()")
        before = count()
        manual()
        check("manual shortcut never reads a password input", count() == before)
        page.locator("#password").evaluate("el=>el.blur()")
        page.locator("#input").evaluate("el=>el.blur()")
        page.evaluate("getSelection().removeAllRanges()")
        before = count()
        manual()
        check("shortcut with no selection never reuses stale text", count() == before)

        settings(triggerMode="smart", autoTranslate=True)
        reset_cache()
        before = count()
        select("english", wait=50)
        page.locator("#english").evaluate("el=>el.setAttribute('contenteditable','')")
        page.wait_for_timeout(350)
        check("selection rechecks newly editable DOM before request", count() == before)
        page.locator("#english").evaluate("el=>el.removeAttribute('contenteditable')")

        async_translate = """async context => chrome.runtime.sendMessage({type:'TRANSLATE',payload:{text:'bank',context,save:true}})"""
        worker.evaluate("chrome.storage.local.set({records:[{id:'legacy',text:'bank',context:'river bank',translation:'old',favorite:true,mastered:true,seenCount:3,firstSeenAt:'2026-01-01'}],translationCache:{}})")
        a = ext.evaluate(async_translate, "river bank")
        b = ext.evaluate(async_translate, "money bank")
        settings(openaiModel="synthetic-b")
        c = ext.evaluate(async_translate, "money bank")
        check("actual worker isolates context and model cache", len({a['result']['translation'], b['result']['translation'], c['result']['translation']}) == 3)
        records = worker.evaluate("chrome.storage.local.get('records')")["records"]
        old = next(r for r in records if r["id"] == "legacy")
        check("different contexts survive alongside legacy review state", len(records) == 2 and old["favorite"] and old["mastered"] and old["firstSeenAt"] == "2026-01-01")
        side = ctx.new_page()
        side.on("pageerror", lambda error: errors.append(str(error)))
        side.goto(worker.url.replace("background.js", "sidepanel.html"))
        side.locator(".record").first.wait_for()
        check("side panel renders both context records", side.locator(".record").count() == 2)
        check("side panel exposes context for each sense", side.locator(".note").filter(has_text="语境：").count() == 2)
        side.screenshot(path=str(OUT / "records-acceptance.png"), full_page=True)
        side.reload()
        side.locator(".record").first.wait_for()
        check("records persist across side panel reload", side.locator(".record").count() == 2)
        ext.reload()
        check("options page loads new trigger setting", ext.locator("#trigger-mode").input_value() == "smart")
        ext.screenshot(path=str(OUT / "options-acceptance.png"), full_page=True)
        check("synthetic pages raise no uncaught errors", not errors)
        browser_version = ctx.browser.version
        ctx.close()
        ctx = p.chromium.launch_persistent_context(
            profile, executable_path=executable, headless=True, timeout=30000,
            ignore_default_args=["--disable-extensions"],
            args=[f"--disable-extensions-except={ROOT}", f"--load-extension={ROOT}", "--disable-background-networking"])
        ctx.route("**/*", route_offline)
        restarted = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker")
        persisted = restarted.evaluate("chrome.storage.local.get(['records','settings'])")
        check("isolated browser restart preserves record ids and review states", persisted["records"] == records)
        check("isolated browser restart preserves settings", persisted["settings"]["openaiModel"] == "synthetic-b")
        report = {"browser": browser_version, "mode": "isolated headless unpacked extension; offline mocked API", "passed": len(checks), "checks": checks, "page_errors": errors}
        (OUT / "browser-acceptance.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"PASS {len(checks)} browser assertions", flush=True)
    finally:
        ctx.close()
