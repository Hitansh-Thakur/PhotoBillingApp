from fastapi import FastAPI, File, UploadFile
from ultralytics import YOLO
from PIL import Image
import io

app = FastAPI()
model = YOLO("best.pt")   # loaded once at startup


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    img_bytes = await file.read()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    # Resize to 640px max side — YOLO's native resolution, much faster on CPU
    img.thumbnail((640, 640), Image.LANCZOS)

    results = model(img, imgsz=640)

    detections = []
    for r in results:
        for box in r.boxes:
            label = model.names[int(box.cls)]
            conf = float(box.conf)
            if conf >= 0.40:  # confidence threshold
                detections.append({"label": label, "confidence": conf})

    # Deduplicate: keep highest confidence per label
    seen = {}
    for d in detections:
        if d["label"] not in seen or d["confidence"] > seen[d["label"]]:
            seen[d["label"]] = d["confidence"]

    return {
        "detections": [
            {"label": k, "confidence": v} for k, v in seen.items()
        ]
    }
