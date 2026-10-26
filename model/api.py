import sys
from pathlib import Path

# Ensure model directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from pipeline import evaluate_cr

app = FastAPI(title="IMPART Regulatory Engine V2")


class ChangeRequestInput(BaseModel):
    cr_text: str
    debug: bool = False


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/evaluate")
def evaluate(req: ChangeRequestInput):
    if not req.cr_text.strip():
        raise HTTPException(status_code=400, detail="cr_text is empty")
    try:
        return evaluate_cr(req.cr_text, debug=req.debug)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))