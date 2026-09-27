import os

from flask import Flask, jsonify, request, send_from_directory, abort
from dotenv import load_dotenv
from google.genai import errors
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

load_dotenv() # loads env variables (before ai.py reads GEMINI_API_KEY / GEMINI_MODEL)

import ai
from i18n import clean_language
from menu import Menu, normalize_allergens, overview_speech

DIST_DIR = os.path.join(os.path.dirname(__file__), "..", "client", "dist")
app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024  # a few full-size phone photos

MAX_PHOTOS = 4
MAX_HISTORY_TURNS = 4

# The server keeps no state between requests: /api/parse returns the menu, the
# phone saves it (recent scans), and sends it back with every /api/ask.
# That way a server restart, Render's free tier sleeping, or running several
# gunicorn workers can never "lose" a menu.

# API routes
@app.get("/api/health")
def health():
    return jsonify(status="ok", mock=ai.mock_mode())

@app.post("/api/parse")
def parse():
    photos = [f.read() for f in request.files.getlist("images")][:MAX_PHOTOS]
    if not photos:
        return jsonify(error="No photo received. Take a picture of the menu and try again."), 400

    # the reader's language (sent as a form field next to the photos)
    language = clean_language(request.form.get("language"))

    menu = ai.parse_menu(photos, language)
    return jsonify(
        overview_speech=overview_speech(menu, language),
        menu=menu.model_dump(),
        pages=len(photos),
        mock=ai.mock_mode(),
    )

@app.post("/api/ask")
def ask():
    body = request.get_json(silent=True) or {}

    # the menu comes from the client, so validate it like any other user input
    try:
        menu = Menu.model_validate(body.get("menu") or {})
    except ValidationError:
        return jsonify(error="That menu couldn't be read. Please scan it again."), 400
    if not menu.items:
        return jsonify(error="That menu has no dishes. Please scan it again."), 400

    question = str(body.get("question", "")).strip()[:500]
    if not question:
        return jsonify(error="I didn't hear a question. Tap and try again."), 400

    allergies = set(normalize_allergens(body.get("allergies", [])))

    # earlier turns so follow-ups like "anything cheaper?" work; keep only
    # well-formed turns and cap them so the prompt can't grow forever
    history = [
        {"question": str(t["question"])[:500], "speech": str(t["speech"])[:1000]}
        for t in body.get("history", [])
        if isinstance(t, dict) and "question" in t and "speech" in t
    ][-MAX_HISTORY_TURNS:]

    # which dish card the question came from (Describe / Ask), if any
    dish = str(body.get("dish") or "").strip()[:200] or None

    language = clean_language(body.get("language"))

    speech, items = ai.answer(menu, allergies, question, history, dish, language)
    return jsonify(speech=speech, items=items)

@app.errorhandler(Exception)
def handle_error(e):
    if isinstance(e, HTTPException):
        return jsonify(error=e.description), e.code
    if isinstance(e, ai.BadPhoto):
        return jsonify(error=str(e)), 400
    if isinstance(e, errors.APIError) and e.code in ai.RETRY_CODES:
        # Gemini still busy after call_gemini's retries: the user hears this
        # message, so say what happened and what to do (not a raw error dump)
        app.logger.warning("Gemini busy after retries: %s", e.code)
        return jsonify(error="The menu reader is busy right now. Wait a few seconds and try again."), 503
    app.logger.exception(e)  # keep the traceback in the terminal; the handler would hide it otherwise
    return jsonify(error=f"Something went wrong on our side: {e}"), 500

#  serve react build in production
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    if path.startswith("api/"):
        abort(404)

    file_path = os.path.join(DIST_DIR, path)
    if path and os.path.exists(file_path):
        return send_from_directory(DIST_DIR, path)

    return send_from_directory(DIST_DIR, "index.html")

if __name__ == "__main__":
    app.run(port=5001, debug=True)
