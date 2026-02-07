# Project: LexiSite 360 - Standalone Web Application

## Project Overview
LexiSite 360 is a standalone web-based platform where legal professionals can paste AI-generated content to verify the accuracy and "currency" (Shepardizing) of legal citations. The goal is to eliminate legal research hallucinations and ensure cited cases are still good law.

## Core Mission
- **Verify Accuracy:** Cross-reference citations against the CourtListener API.
- **Shepardizing/Currency:** Identify if a citation is the "most recent" or has negative treatment (overruled, questioned, reversed).
- **Transparency:** Provide a 100% AI-free verification layer.

## Tech Stack
- **Backend:** Python 3.x (Flask or FastAPI).
- **Frontend:** HTML/CSS/JavaScript (or React/Vue).
- **Legal Data API:** CourtListener (Free Law Project).
- **Text Processing:** Python `re` module (Regex) for citation extraction.

## Functional Scope
1. **Input Area:** A large text area for users to paste content.
2. **Detection Engine (Python):** A backend service that scans text for legal citation patterns.
3. **Verification Logic:**
    - Call CourtListener `/citation-lookup/` to verify existence.
    - Check the "Cited By" or "Subsequent History" via CourtListener to determine if the case is the most recent/valid version.
4. **Results Display:** An interactive display where found citations are color-coded:
    - **Green:** Valid and Good Law.
    - **Yellow:** Valid but has Cautionary Treatment (Questioned).
    - **Red:** Hallucination (Doesn't exist) or Overruled (Bad Law).

## Implementation Instructions for Copilot
- **Regex Extraction:** Create a robust Python regex that extracts citations (e.g., *123 F.3d 456*) from raw text strings.
- **Shepard's Logic:** Implement logic that interprets CourtListener's response to check for "negative treatment." If a newer case reverses the current one, flag it as Red.
- **Async Handling:** Use asynchronous requests (e.g., `httpx` or `aiohttp` in Python) to handle multiple citation lookups quickly.
- **Clean UI:** Ensure the frontend displays the "100% AI-Free" branding and 100% accuracy promise clearly.
