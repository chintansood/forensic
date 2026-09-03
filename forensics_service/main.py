from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import io
from engine import ForensicsEngine

app = FastAPI(title="DocForensic AI - Forensics & CV Microservice", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FlaggedRegion(BaseModel):
    x: int
    y: int
    width: int
    height: int

class ForensicsAnalysisResponse(BaseModel):
    elaScore: float
    metadataFlags: List[str]
    fontConsistencyScore: float
    suspiciousRegions: List[FlaggedRegion]
    severity: str # HIGH | REVIEW | CLEAR
    compositeScore: float
    fingerprintEmbedding: List[float]

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "forensics-fastapi"}

@app.post("/forensics", response_model=ForensicsAnalysisResponse)
@app.post("/forensics/analyze", response_model=ForensicsAnalysisResponse)
async def analyze_document(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        # 1. Error Level Analysis & Bounding Boxes
        ela_score, bounding_boxes, _ = ForensicsEngine.error_level_analysis(image_bytes)

        # 2. Metadata Inspection
        metadata_flags = ForensicsEngine.extract_metadata_flags(image_bytes)

        # 3. Font and Edge Consistency
        font_score = ForensicsEngine.check_font_and_edge_consistency(image_bytes, bounding_boxes)

        # 4. Perceptual Fingerprint (1536 dims)
        fingerprint = ForensicsEngine.compute_fingerprint_embedding(image_bytes, target_dim=1536)

        # 5. Composite Score Calculation
        # Weights: ELA (0.5), Metadata flags (0.3), Inconsistency (0.2)
        meta_penalty = min(50.0, len(metadata_flags) * 25.0)
        font_inconsistency_penalty = (1.0 - font_score) * 60.0
        composite = min(100.0, (ela_score * 0.45) + meta_penalty + font_inconsistency_penalty)

        if composite > 65.0 or len(metadata_flags) > 0:
            severity = "HIGH"
        elif composite >= 35.0 or len(bounding_boxes) > 0:
            severity = "REVIEW"
        else:
            severity = "CLEAR"

        regions = [
            FlaggedRegion(
                x=b["x"],
                y=b["y"],
                width=b["width"],
                height=b["height"]
            )
            for b in bounding_boxes
        ]

        return ForensicsAnalysisResponse(
            elaScore=round(ela_score, 2),
            metadataFlags=metadata_flags,
            fontConsistencyScore=round(font_score, 3),
            suspiciousRegions=regions,
            severity=severity,
            compositeScore=round(composite, 2),
            fingerprintEmbedding=fingerprint
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forensics analysis error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
