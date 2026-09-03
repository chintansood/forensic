import io
import math
import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ExifTags
import cv2
from typing import List, Dict, Any, Optional, Tuple

class ForensicsEngine:
    SUSPICIOUS_SOFTWARE = [
        "photoshop", "gimp", "snapseed", "canva", "pixelmator",
        "paint.net", "illustrator", "affinity", "acrobat", "pdfescape",
        "sejda", "ilovepdf", "pdf2go", "imagemagick", "lightroom"
    ]

    @staticmethod
    def error_level_analysis(
        image_bytes: bytes,
        quality: int = 90,
        scale: float = 15.0
    ) -> Tuple[float, List[Dict[str, int]], bytes]:
        """
        Perform Error Level Analysis (ELA).
        Re-saves the image at specified JPEG quality, measures per-pixel delta,
        amplifies and detects high-error tampered candidate regions.
        """
        orig_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        orig_w, orig_h = orig_img.size

        # Re-save to JPEG buffer at known quality
        resaved_buf = io.BytesIO()
        orig_img.save(resaved_buf, "JPEG", quality=quality)
        resaved_buf.seek(0)
        resaved_img = Image.open(resaved_buf).convert("RGB")

        # Compute difference
        diff = ImageChops.difference(orig_img, resaved_img)

        # Extrema of diff
        extrema = diff.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        if max_diff == 0:
            max_diff = 1

        # Amplify difference
        scale_factor = 255.0 / max_diff if max_diff > 0 else 1.0
        diff_scaled = ImageEnhance.Brightness(diff).enhance(scale_factor)

        # Convert to OpenCV format for contour and bounding box analysis
        diff_np = np.array(diff)
        diff_gray = cv2.cvtColor(diff_np, cv2.COLOR_RGB2GRAY)
        
        # Calculate mean & std dev of error across image
        mean_err, std_err = np.mean(diff_gray), np.std(diff_gray)
        
        # Higher threshold for anomalous error regions: mean + 2.5 * std
        thresh_val = min(250, max(15, mean_err + 2.2 * std_err))
        _, thresh = cv2.threshold(diff_gray, int(thresh_val), 255, cv2.THRESH_BINARY)

        # Morphological opening & dilation to group nearby pixels
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
        dilated = cv2.dilate(thresh, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        bounding_boxes: List[Dict[str, int]] = []
        min_area = (orig_w * orig_h) * 0.0003  # ignore tiny noise speckles
        max_area = (orig_w * orig_h) * 0.40    # ignore whole-page boxes

        # Sort contours by area descending
        sorted_contours = sorted(contours, key=cv2.contourArea, reverse=True)
        for c in sorted_contours[:3]:
            area = cv2.contourArea(c)
            if area > min_area and area < max_area:
                x, y, w, h = cv2.boundingRect(c)
                # Pad slightly
                pad_x = int(w * 0.05)
                pad_y = int(h * 0.05)
                bx = max(0, x - pad_x)
                by = max(0, y - pad_y)
                bw = min(orig_w - bx, w + 2 * pad_x)
                bh = min(orig_h - by, h + 2 * pad_y)
                bounding_boxes.append({
                    "x": int(bx),
                    "y": int(by),
                    "width": int(bw),
                    "height": int(bh)
                })

        # Calculate normalized ELA score (0 - 100)
        high_err_ratio = np.sum(diff_gray > thresh_val) / float(orig_w * orig_h)
        ela_score = min(100.0, float(mean_err * 2.5 + high_err_ratio * 400.0 + len(bounding_boxes) * 15.0))

        # Save ELA visualization
        ela_vis_buf = io.BytesIO()
        diff_scaled.save(ela_vis_buf, format="JPEG")
        ela_vis_bytes = ela_vis_buf.getvalue()

        return ela_score, bounding_boxes, ela_vis_bytes

    @staticmethod
    def extract_metadata_flags(image_bytes: bytes) -> List[str]:
        """
        Inspect EXIF and metadata for editor signatures or timestamp inconsistencies.
        """
        flags: List[str] = []
        try:
            img = Image.open(io.BytesIO(image_bytes))
            info = img.info or {}
            
            # Check info dict (PNG / JPEG headers)
            for k, v in info.items():
                v_str = str(v).lower()
                for sw in ForensicsEngine.SUSPICIOUS_SOFTWARE:
                    if sw in v_str:
                        flags.append(f"Header '{k}' indicates editor: {v}")

            # Check EXIF
            exif_data = img.getexif()
            if exif_data:
                for tag_id, value in exif_data.items():
                    tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                    val_str = str(value).lower()

                    if tag_name.lower() in ["software", "processingsoftware", "history"]:
                        for sw in ForensicsEngine.SUSPICIOUS_SOFTWARE:
                            if sw in val_str:
                                flags.append(f"EXIF tag '{tag_name}' reveals manipulation software: {value}")
                    
                    if tag_name.lower() in ["usercomment", "imagedescription"]:
                        for sw in ForensicsEngine.SUSPICIOUS_SOFTWARE:
                            if sw in val_str:
                                flags.append(f"EXIF metadata '{tag_name}': {value}")
        except Exception as e:
            flags.append(f"Metadata read error: {str(e)}")

        return list(set(flags))

    @staticmethod
    def check_font_and_edge_consistency(
        image_bytes: bytes,
        flagged_regions: List[Dict[str, int]]
    ) -> float:
        """
        Calculates Laplacian edge sharpness & gradient variance in flagged region
        compared against clean baseline areas.
        Returns a consistency score (0.0 = highly inconsistent/tampered, 1.0 = consistent).
        """
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            cv_img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
            if cv_img is None:
                return 0.8

            h, w = cv_img.shape

            # Compute full image laplacian variance
            full_laplacian = cv2.Laplacian(cv_img, cv2.CV_64F)
            full_var = np.var(full_laplacian)

            if not flagged_regions:
                return 0.95

            variances = []
            for r in flagged_regions:
                rx, ry, rw, rh = r["x"], r["y"], r["width"], r["height"]
                # Boundary safety
                rx = max(0, min(w - 1, rx))
                ry = max(0, min(h - 1, ry))
                rw = max(1, min(w - rx, rw))
                rh = max(1, min(h - ry, rh))

                region_crop = cv_img[ry:ry+rh, rx:rx+rw]
                if region_crop.size > 0:
                    reg_laplacian = cv2.Laplacian(region_crop, cv2.CV_64F)
                    variances.append(np.var(reg_laplacian))

            if not variances or full_var <= 0:
                return 0.90

            # Compare ratio of flagged region variance to global variance
            avg_reg_var = np.mean(variances)
            ratio = avg_reg_var / (full_var + 1e-5)
            
            # Significant divergence (either too sharp or too blurry compared to doc) implies tampering
            divergence = abs(math.log(max(0.01, ratio)))
            consistency = max(0.0, min(1.0, 1.0 - (divergence * 0.25)))
            return float(consistency)
        except Exception:
            return 0.75

    @staticmethod
    def compute_fingerprint_embedding(image_bytes: bytes, target_dim: int = 1536) -> List[float]:
        """
        Computes a deterministic perceptual and structural document fingerprint
        normalized to 1536 dimensions for pgvector cosine similarity search.
        Uses multi-scale DCT (Discrete Cosine Transform) and edge histograms.
        """
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
            if img is None:
                # Fallback zero vector with unit norm
                vec = [0.0] * target_dim
                vec[0] = 1.0
                return vec

            # Resize to standard canonical size
            resized = cv2.resize(img, (128, 128)).astype(np.float32)
            
            # 2D DCT
            dct = cv2.dct(resized)
            # Take top 32x32 low-to-mid frequency coefficients (1024 values)
            dct_low = dct[:32, :32].flatten()

            # Compute Sobel gradients in horizontal and vertical directions (512 values)
            grad_x = cv2.Sobel(resized, cv2.CV_32F, 1, 0, ksize=3)
            grad_y = cv2.Sobel(resized, cv2.CV_32F, 0, 1, ksize=3)
            
            grad_x_low = cv2.resize(grad_x, (16, 16)).flatten() # 256
            grad_y_low = cv2.resize(grad_y, (16, 16)).flatten() # 256

            raw_features = np.concatenate([dct_low, grad_x_low, grad_y_low]) # 1024 + 256 + 256 = 1536

            # L2 normalize
            norm = np.linalg.norm(raw_features)
            if norm > 0:
                normalized = raw_features / norm
            else:
                normalized = np.zeros(target_dim)
                normalized[0] = 1.0

            return [float(x) for x in normalized[:target_dim]]
        except Exception as e:
            # Fallback normalized vector
            np.random.seed(42)
            rnd = np.random.randn(target_dim)
            return [float(x) for x in (rnd / np.linalg.norm(rnd))]
