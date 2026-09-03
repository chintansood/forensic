import io
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from engine import ForensicsEngine

def test_engine():
    # 1. Create a clean base invoice image
    img = Image.new('RGB', (800, 600), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((50, 50), "ACME INDUSTRIAL SUPPLY", fill=(0, 0, 0))
    d.text((50, 80), "Invoice #INV-2026-001", fill=(0, 0, 0))
    d.text((50, 150), "Item: Widgets (10x) - $1,000.00", fill=(0, 0, 0))
    d.text((50, 200), "TOTAL: $1,000.00", fill=(0, 0, 0))

    clean_buf = io.BytesIO()
    img.save(clean_buf, format="JPEG", quality=90)
    clean_bytes = clean_buf.getvalue()

    # Test clean
    ela_clean, boxes_clean, _ = ForensicsEngine.error_level_analysis(clean_bytes)
    fp_clean = ForensicsEngine.compute_fingerprint_embedding(clean_bytes)
    print(f"Clean ELA Score: {ela_clean}, Boxes: {len(boxes_clean)}, Fingerprint len: {len(fp_clean)}")

    # 2. Create a tampered version (paste modified total with different compression)
    tampered_img = Image.open(io.BytesIO(clean_bytes)).copy()
    patch = Image.new('RGB', (200, 40), color=(255, 255, 255))
    pd = ImageDraw.Draw(patch)
    pd.text((5, 10), "TOTAL: $95,000.00", fill=(0, 0, 0))
    
    # Save patch as low quality JPEG and paste back
    patch_buf = io.BytesIO()
    patch.save(patch_buf, "JPEG", quality=40)
    patch_loaded = Image.open(patch_buf)
    tampered_img.paste(patch_loaded, (50, 195))

    tampered_buf = io.BytesIO()
    tampered_img.save(tampered_buf, format="JPEG", quality=95)
    tampered_bytes = tampered_buf.getvalue()

    ela_tampered, boxes_tampered, _ = ForensicsEngine.error_level_analysis(tampered_bytes)
    print(f"Tampered ELA Score: {ela_tampered}, Boxes: {len(boxes_tampered)}, Regions: {boxes_tampered}")
    assert len(fp_clean) == 1536
    print("Forensics Engine Test PASSED!")

if __name__ == "__main__":
    test_engine()
