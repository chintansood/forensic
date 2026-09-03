import os
import io
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
GENUINE_DIR = os.path.join(OUTPUT_DIR, "genuine")
TAMPERED_DIR = os.path.join(OUTPUT_DIR, "tampered")
RING_DIR = os.path.join(OUTPUT_DIR, "ring_fraud")

for d in [GENUINE_DIR, TAMPERED_DIR, RING_DIR]:
    os.makedirs(d, exist_ok=True)

def create_base_invoice(vendor, inv_num, date, items, total, font_scale=1.0):
    img = Image.new('RGB', (850, 1100), color=(250, 250, 252))
    draw = ImageDraw.Draw(img)

    # Header Bar
    draw.rectangle([(0, 0), (850, 12)], fill=(41, 46, 52))
    
    # Vendor Title
    draw.text((60, 50), vendor.upper(), fill=(20, 24, 30))
    draw.text((60, 75), "Commercial Solutions & Enterprise Services", fill=(100, 110, 120))

    # Invoice Meta
    draw.text((580, 50), "INVOICE", fill=(40, 45, 55))
    draw.text((580, 75), f"Invoice #: {inv_num}", fill=(50, 55, 65))
    draw.text((580, 95), f"Date: {date}", fill=(80, 90, 100))
    draw.text((580, 115), "Payment Terms: Net 30", fill=(80, 90, 100))

    # Dividing Line
    draw.line([(60, 150), (790, 150)], fill=(210, 215, 220), width=2)

    # Bill To
    draw.text((60, 170), "BILL TO:", fill=(110, 120, 130))
    draw.text((60, 190), "Global Enterprises Inc.", fill=(25, 30, 35))
    draw.text((60, 210), "100 Corporate Blvd, Suite 400", fill=(70, 75, 85))

    # Table Header
    draw.rectangle([(60, 260), (790, 295)], fill=(235, 240, 245))
    draw.text((75, 272), "DESCRIPTION", fill=(50, 55, 65))
    draw.text((560, 272), "QTY", fill=(50, 55, 65))
    draw.text((680, 272), "AMOUNT", fill=(50, 55, 65))

    # Items
    y = 315
    for desc, qty, amt in items:
        draw.text((75, y), desc, fill=(35, 40, 45))
        draw.text((570, y), str(qty), fill=(50, 55, 65))
        draw.text((680, y), f"${amt:,.2f}", fill=(20, 25, 30))
        draw.line([(60, y + 25), (790, y + 25)], fill=(240, 242, 245), width=1)
        y += 40

    # Summary Box
    draw.line([(500, y + 20), (790, y + 20)], fill=(180, 185, 190), width=2)
    subtotal = sum(amt for _, _, amt in items)
    tax = round(subtotal * 0.08, 2)
    
    draw.text((520, y + 35), "Subtotal:", fill=(80, 90, 100))
    draw.text((680, y + 35), f"${subtotal:,.2f}", fill=(30, 35, 40))

    draw.text((520, y + 60), "Tax (8%):", fill=(80, 90, 100))
    draw.text((680, y + 60), f"${tax:,.2f}", fill=(30, 35, 40))

    draw.rectangle([(500, y + 90), (790, y + 130)], fill=(240, 245, 250))
    draw.text((520, y + 102), "TOTAL DUE:", fill=(15, 20, 25))
    draw.text((670, y + 102), f"${total:,.2f}", fill=(10, 15, 20))

    # Footer
    draw.text((60, 1020), "Thank you for your business. Remit payment to account ending in •••• 4421.", fill=(120, 130, 140))
    draw.text((60, 1040), "DocForensic Verified Document Registry #8849-DF", fill=(140, 150, 160))

    return img, (670, y + 102, 120, 28)

def generate_all():
    print("Generating comprehensive test dataset...")

    genuine_configs = [
        ("Acme Industrial Supply", "INV-2026-041", "2026-08-10", [("Industrial Fasteners Grade 8", 200, 1200.0), ("Bulk Steel Washers", 500, 450.0), ("Freight & Handling", 1, 150.0)], 1944.0),
        ("Northstar Logistics", "LOG-9921", "2026-08-12", [("Regional Dedicated Freight (Truckload)", 2, 4800.0), ("Fuel Surcharge Index Q3", 1, 620.0)], 5853.6),
        ("Meridian Office Group", "MOG-849", "2026-08-14", [("Ergonomic Mesh Task Chairs", 10, 2500.0), ("Dual Monitor Mounting Arms", 10, 850.0)], 3618.0),
        ("Harbor & Co.", "HBR-302", "2026-08-15", [("Safety Equipment Restock", 1, 480.0), ("First Aid Compliance Kits", 4, 320.0)], 864.0),
        ("Apex Cloud Systems", "APX-1092", "2026-08-16", [("Cloud Database Hosting (Monthly)", 1, 3200.0), ("Dedicated Bandwidth Allocation", 1, 750.0)], 4266.0),
        ("Vanguard Security Solutions", "VSS-441", "2026-08-17", [("CCTV Hardware Maintenance", 1, 1850.0), ("Access Card Provisioning", 50, 400.0)], 2430.0),
        ("Summit Facility Services", "SFS-771", "2026-08-18", [("HVAC Quarterly Inspection & Filter Change", 1, 2100.0), ("Emergency Plumbing Repair", 1, 650.0)], 2970.0),
        ("Pinnacle Legal Associates", "PLA-550", "2026-08-19", [("Contract Review & Compliance Advisory", 8, 3600.0), ("Filing Fees & Retainers", 1, 400.0)], 4320.0),
    ]

    # 1. Generate Genuine Invoices
    for idx, (vendor, num, dt, items, tot) in enumerate(genuine_configs):
        img, _ = create_base_invoice(vendor, num, dt, items, tot)
        filepath = os.path.join(GENUINE_DIR, f"genuine_invoice_{idx+1:02d}.jpg")
        img.save(filepath, "JPEG", quality=92)
        print(f"  ✓ Saved genuine: {os.path.basename(filepath)}")

    # 2. Generate Tampered Variants (with genuine base modified by pasting spliced total and low JPEG compression)
    for idx, (vendor, num, dt, items, tot) in enumerate(genuine_configs):
        img, (tx, ty, tw, th) = create_base_invoice(vendor, num, dt, items, tot)
        
        # Tamper total amount: multiply by 4 or 8
        tampered_tot = tot * 4.5
        patch = Image.new('RGB', (160, 35), color=(240, 245, 250))
        pdraw = ImageDraw.Draw(patch)
        pdraw.text((10, 8), f"${tampered_tot:,.2f}", fill=(10, 15, 20))
        
        # Save patch at low quality to introduce compression artifact
        buf = io.BytesIO()
        patch.save(buf, "JPEG", quality=35)
        buf.seek(0)
        patch_loaded = Image.open(buf)

        img.paste(patch_loaded, (tx - 10, ty - 5))

        # Add EXIF editor tag indicating Photoshop
        exif = img.getexif()
        exif[0x0131] = "Adobe Photoshop 2026 (Macintosh)"
        exif[0x0132] = "2026:08:20 18:42:10"

        filepath = os.path.join(TAMPERED_DIR, f"tampered_invoice_{idx+1:02d}.jpg")
        img.save(filepath, "JPEG", quality=92, exif=exif)
        print(f"  ✓ Saved tampered: {os.path.basename(filepath)}")

    # 3. Generate Ring Fraud Cluster (identical template structure reused across 3 different fake vendor names)
    ring_vendors = [
        ("Frontline Global Logistics", "INV-8820-A", "2026-08-20", [("Bulk Freight Surcharge Handling", 5, 14200.0)], 76680.0),
        ("Nexus Supply Partners", "INV-8820-B", "2026-08-20", [("Industrial Fastener Consignment", 12, 14200.0)], 76680.0),
        ("Sterling Fleet Distribution", "INV-8820-C", "2026-08-20", [("Fleet Routing Optimization", 3, 14200.0)], 76680.0),
    ]

    for idx, (vendor, num, dt, items, tot) in enumerate(ring_vendors):
        img, _ = create_base_invoice(vendor, num, dt, items, tot)
        filepath = os.path.join(RING_DIR, f"ring_fraud_{idx+1:02d}_{vendor.lower().replace(' ', '_')}.jpg")
        img.save(filepath, "JPEG", quality=90)
        print(f"  ✓ Saved ring fraud cluster doc: {os.path.basename(filepath)}")

    print("\nDataset generation complete.")

if __name__ == "__main__":
    generate_all()
