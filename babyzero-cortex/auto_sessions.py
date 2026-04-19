"""
BabyZero Auto-Session Runner
=============================
Runs N free_play sessions in a loop, captures a vascular.html screenshot
after each one, and saves grammar snapshots.

Usage:
  python auto_sessions.py [num_sessions]   (default: 8)

Output:
  docs/sessions/session_NNN.png          — vascular screenshot
  docs/sessions/session_NNN_grammar.json — grammar snapshot
  docs/sessions/run_log.txt              — console log of all runs
"""

import subprocess
import shutil
import os
import sys
import time
import json
import datetime

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
EXE           = os.path.join(BASE_DIR, "target", "release", "babyzero-cortex.exe")
GRAMMAR_JSON  = os.path.join(BASE_DIR, "babyzero_grammar.json")
HARNESS_DIR   = os.path.join(BASE_DIR, "harness")
DOCS_DIR      = os.path.join(BASE_DIR, "docs", "sessions")
LOG_FILE      = os.path.join(DOCS_DIR, "run_log.txt")
VASCULAR_URL  = "http://localhost:8770/vascular.html"

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Users\Sean\AppData\Local\Google\Chrome\Application\chrome.exe",
]

# ── Helpers ──────────────────────────────────────────────────────────────────

def find_chrome():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    return None

def read_session_count():
    """Read current session count from grammar JSON."""
    if not os.path.exists(GRAMMAR_JSON):
        return 0
    try:
        with open(GRAMMAR_JSON) as f:
            data = json.load(f)
        return data.get("total_sessions", 0)
    except Exception:
        return 0

def read_rule_count():
    """Read current rule count from grammar JSON."""
    if not os.path.exists(GRAMMAR_JSON):
        return 0
    try:
        with open(GRAMMAR_JSON) as f:
            data = json.load(f)
        return len(data.get("entries", []))
    except Exception:
        return 0

def log(msg, log_fh=None):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    # Safe print for Windows console (cp1252 can't handle emoji)
    print(line.encode(sys.stdout.encoding or "utf-8", errors="replace").decode(sys.stdout.encoding or "utf-8", errors="replace"))
    if log_fh:
        log_fh.write(line + "\n")
        log_fh.flush()

def run_free_play(log_fh):
    """Run one free_play session. Returns (exit_code, stdout_tail)."""
    result = subprocess.run(
        [EXE],
        cwd=BASE_DIR,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    # Copy grammar to harness dir for vascular.html
    if os.path.exists(GRAMMAR_JSON):
        shutil.copy2(GRAMMAR_JSON, os.path.join(HARNESS_DIR, "babyzero_grammar.json"))
    # Grab last few lines of output for log
    lines = (result.stdout + result.stderr).strip().splitlines()
    tail = "\n".join(lines[-8:]) if lines else "(no output)"
    return result.returncode, tail

def screenshot_vascular(session_num, log_fh):
    """
    Open vascular.html in Chrome (new tab), wait for p5.js to render,
    then capture the full screen with PIL.ImageGrab.
    """
    from PIL import ImageGrab
    out_path = os.path.join(DOCS_DIR, f"session_{session_num:03d}.png")
    cache_bust = int(time.time())
    url = f"{VASCULAR_URL}?t={cache_bust}"

    chrome = find_chrome()
    if chrome:
        # Open a new Chrome tab to the vascular URL (cache-busted so JSON reloads)
        subprocess.Popen([chrome, f"--new-tab", url])
    else:
        log("  WARNING: Chrome not found, skipping screenshot", log_fh)
        return None

    # Give p5.js time to fetch grammar JSON and render (~3s is enough)
    time.sleep(4)

    # Full-screen capture — captures whatever Chrome is showing
    img = ImageGrab.grab()
    img.save(out_path)

    size = os.path.getsize(out_path)
    log(f"  Screenshot saved: session_{session_num:03d}.png ({size//1024}KB)", log_fh)
    return out_path

def snapshot_grammar(session_num, log_fh):
    """Save a timestamped copy of the grammar JSON."""
    if not os.path.exists(GRAMMAR_JSON):
        log("  ⚠️  No grammar JSON found to snapshot", log_fh)
        return
    dest = os.path.join(DOCS_DIR, f"session_{session_num:03d}_grammar.json")
    shutil.copy2(GRAMMAR_JSON, dest)
    rules = read_rule_count()
    log(f"  💾 Grammar snapshot → {os.path.basename(dest)} ({rules} rules)", log_fh)

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    num_sessions = int(sys.argv[1]) if len(sys.argv) > 1 else 8

    os.makedirs(DOCS_DIR, exist_ok=True)

    chrome = find_chrome()

    with open(LOG_FILE, "a", encoding="utf-8") as log_fh:
        start_session = read_session_count()
        log(f"=== Auto-session run: {num_sessions} sessions starting from session {start_session} ===", log_fh)
        log(f"    EXE: {EXE}", log_fh)
        log(f"    Chrome: {chrome or 'NOT FOUND'}", log_fh)

        for i in range(num_sessions):
            session_before = read_session_count()
            log(f"\n▶  Run {i+1}/{num_sessions}  (grammar sessions so far: {session_before})", log_fh)

            # 1. Run free_play
            exit_code, tail = run_free_play(log_fh)
            session_after = read_session_count()
            rules_after   = read_rule_count()

            log(f"  ✅ exit={exit_code}  sessions={session_after}  rules={rules_after}", log_fh)
            log(f"  — tail —\n{tail}", log_fh)

            # 2. Screenshot (wait a beat for JSON to settle, Chrome opens fresh tab)
            screenshot_vascular(session_after, log_fh)

            # 3. Grammar snapshot
            snapshot_grammar(session_after, log_fh)

        final_sessions = read_session_count()
        final_rules    = read_rule_count()
        log(f"\nDone. Grammar: {final_rules} rules across {final_sessions} sessions.", log_fh)
        log(f"   Screenshots + snapshots in: {DOCS_DIR}", log_fh)

if __name__ == "__main__":
    main()
