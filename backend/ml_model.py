import io
import json
import math
import os
from datetime import datetime

import numpy as np
from PIL import Image, ImageOps


DISEASE_CLASSES = ["black_rot", "esca", "healthy", "leaf_blight"]
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "bmp", "webp"}
IMAGE_SIZE = 224
DEFAULT_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "grape_leaf_model.keras")
DEFAULT_MODEL_METADATA_PATH = os.path.join(os.path.dirname(__file__), "models", "grape_leaf_model_metadata.json")

FEATURE_NAMES = [
    "red_mean",
    "green_mean",
    "blue_mean",
    "red_std",
    "green_std",
    "blue_std",
    "red_p10",
    "green_p10",
    "blue_p10",
    "red_p90",
    "green_p90",
    "blue_p90",
    "green_dominance",
    "red_dominance",
    "brightness_mean",
    "brightness_std",
    "brightness_p10",
    "brightness_p90",
    "saturation_mean",
    "saturation_std",
    "hue_green_ratio",
    "hue_yellow_ratio",
    "hue_red_brown_ratio",
    "green_pixel_ratio",
    "yellow_pixel_ratio",
    "brown_pixel_ratio",
    "dark_spot_ratio",
    "pale_pixel_ratio",
    "lesion_like_ratio",
    "edge_mean",
    "edge_std",
    "edge_p90",
    "entropy",
]


class ModelError(Exception):
    pass


_KERAS_CACHE = {"path": None, "mtime": None, "model": None}


def load_rgb_image(image_data, size=IMAGE_SIZE):
    try:
        with Image.open(io.BytesIO(image_data)) as image:
            image = ImageOps.exif_transpose(image).convert("RGB")
            original_size = image.size
            image = image.resize((size, size), Image.Resampling.LANCZOS)
    except Exception as exc:
        raise ValueError("Invalid or unreadable image file") from exc

    arr = np.asarray(image, dtype=np.float32) / 255.0
    return arr, original_size


def _rgb_to_hsv(rgb):
    r = rgb[:, :, 0]
    g = rgb[:, :, 1]
    b = rgb[:, :, 2]
    maxc = np.max(rgb, axis=2)
    minc = np.min(rgb, axis=2)
    delta = maxc - minc

    hue = np.zeros_like(maxc)
    nonzero = delta > 1e-6

    mask = nonzero & (maxc == r)
    hue[mask] = ((g[mask] - b[mask]) / delta[mask]) % 6
    mask = nonzero & (maxc == g)
    hue[mask] = ((b[mask] - r[mask]) / delta[mask]) + 2
    mask = nonzero & (maxc == b)
    hue[mask] = ((r[mask] - g[mask]) / delta[mask]) + 4
    hue = hue / 6.0

    saturation = np.zeros_like(maxc)
    saturation[maxc > 1e-6] = delta[maxc > 1e-6] / maxc[maxc > 1e-6]
    value = maxc
    return hue, saturation, value


def _entropy(gray):
    hist, _ = np.histogram(gray, bins=32, range=(0.0, 1.0), density=False)
    probs = hist.astype(np.float32) / max(1, int(np.sum(hist)))
    probs = probs[probs > 0]
    return float(-np.sum(probs * np.log2(probs)) / 5.0)


def extract_features(image_data):
    arr, original_size = load_rgb_image(image_data)
    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]
    gray = (0.299 * r) + (0.587 * g) + (0.114 * b)
    hue, saturation, _ = _rgb_to_hsv(arr)

    dx = np.abs(np.diff(gray, axis=1))
    dy = np.abs(np.diff(gray, axis=0))
    edges = np.concatenate([dx.reshape(-1), dy.reshape(-1)])

    green_pixel = (g > r * 1.05) & (g > b * 1.05) & (g > 0.18)
    yellow_pixel = (r > 0.35) & (g > 0.32) & (b < 0.35) & (np.abs(r - g) < 0.22)
    brown_pixel = (r > 0.20) & (g > 0.10) & (g < 0.48) & (b < 0.32) & (r > g * 1.03)
    dark_spot = gray < 0.22
    pale_pixel = (gray > 0.72) & (saturation < 0.40)
    lesion_like = dark_spot | brown_pixel | yellow_pixel

    values = [
        float(np.mean(r)),
        float(np.mean(g)),
        float(np.mean(b)),
        float(np.std(r)),
        float(np.std(g)),
        float(np.std(b)),
        float(np.percentile(r, 10)),
        float(np.percentile(g, 10)),
        float(np.percentile(b, 10)),
        float(np.percentile(r, 90)),
        float(np.percentile(g, 90)),
        float(np.percentile(b, 90)),
        float(np.mean(g - np.maximum(r, b))),
        float(np.mean(r - np.maximum(g, b))),
        float(np.mean(gray)),
        float(np.std(gray)),
        float(np.percentile(gray, 10)),
        float(np.percentile(gray, 90)),
        float(np.mean(saturation)),
        float(np.std(saturation)),
        float(np.mean((hue >= 0.18) & (hue <= 0.46))),
        float(np.mean((hue >= 0.08) & (hue < 0.18))),
        float(np.mean((hue < 0.08) | (hue > 0.90))),
        float(np.mean(green_pixel)),
        float(np.mean(yellow_pixel)),
        float(np.mean(brown_pixel)),
        float(np.mean(dark_spot)),
        float(np.mean(pale_pixel)),
        float(np.mean(lesion_like)),
        float(np.mean(edges)),
        float(np.std(edges)),
        float(np.percentile(edges, 90)),
        _entropy(gray),
    ]

    features = np.asarray(values, dtype=np.float32)
    quality = describe_image_quality(original_size, features)
    return features, quality


def describe_image_quality(original_size, features):
    by_name = dict(zip(FEATURE_NAMES, [float(v) for v in features]))
    width, height = original_size
    warnings = []

    if min(width, height) < 300:
        warnings.append("Image resolution is low; use at least 300px on the shortest side.")
    if by_name["brightness_mean"] < 0.18:
        warnings.append("Image is very dark; retake it in brighter light.")
    if by_name["brightness_mean"] > 0.86:
        warnings.append("Image is very bright; avoid glare or direct flash.")
    if by_name["brightness_std"] < 0.06:
        warnings.append("Image has low contrast; keep the leaf clearly separated from the background.")
    if by_name["edge_mean"] < 0.018:
        warnings.append("Image may be blurry; hold the camera steady and focus on the leaf.")
    if by_name["green_pixel_ratio"] + by_name["yellow_pixel_ratio"] + by_name["brown_pixel_ratio"] < 0.10:
        warnings.append("The leaf area is hard to detect; place one grape leaf prominently in the frame.")

    return {
        "width": int(width),
        "height": int(height),
        "brightness": round(by_name["brightness_mean"] * 100, 1),
        "contrast": round(by_name["brightness_std"] * 100, 1),
        "sharpness": round(by_name["edge_mean"] * 100, 2),
        "leaf_color_ratio": round(
            (by_name["green_pixel_ratio"] + by_name["yellow_pixel_ratio"] + by_name["brown_pixel_ratio"]) * 100,
            1,
        ),
        "warnings": warnings,
    }


def _softmax(scores):
    values = np.asarray(scores, dtype=np.float64)
    values = values - np.max(values)
    exp_values = np.exp(values)
    probs = exp_values / np.sum(exp_values)
    return probs.astype(np.float32)


def heuristic_predict(features):
    f = dict(zip(FEATURE_NAMES, [float(v) for v in features]))
    lesion = f["lesion_like_ratio"]
    texture = f["edge_mean"] + f["edge_std"]

    raw = {
        "healthy": (
            0.80
            + 2.20 * f["green_pixel_ratio"]
            + 1.40 * max(0.0, f["green_dominance"])
            - 1.60 * lesion
            - 0.40 * f["dark_spot_ratio"]
        ),
        "black_rot": (
            0.35
            + 2.40 * f["dark_spot_ratio"]
            + 1.80 * f["brown_pixel_ratio"]
            + 0.90 * f["hue_red_brown_ratio"]
            + 0.45 * texture
        ),
        "esca": (
            0.35
            + 1.70 * f["yellow_pixel_ratio"]
            + 1.20 * f["brown_pixel_ratio"]
            + 0.85 * f["brightness_std"]
            + 0.55 * f["saturation_std"]
        ),
        "leaf_blight": (
            0.35
            + 2.05 * f["brown_pixel_ratio"]
            + 0.95 * f["yellow_pixel_ratio"]
            + 0.65 * f["edge_p90"]
            + 0.50 * f["lesion_like_ratio"]
        ),
    }

    probs = _softmax([raw[label] for label in DISEASE_CLASSES])
    scores = {label: float(prob) for label, prob in zip(DISEASE_CLASSES, probs)}
    predicted = max(scores, key=scores.get)
    return predicted, scores[predicted], scores


def train_centroid_model(samples, validation=None):
    if len(samples) < 2:
        raise ModelError("Training requires at least two labeled images.")

    labels = sorted({label for label, _ in samples})
    if len(labels) < 2:
        raise ModelError("Training requires images from at least two classes.")

    matrix = np.vstack([features for _, features in samples]).astype(np.float32)
    mean = np.mean(matrix, axis=0)
    std = np.std(matrix, axis=0)
    std[std < 1e-6] = 1.0
    normalized = (matrix - mean) / std

    centroids = {}
    class_counts = {}
    for label in labels:
        indexes = [idx for idx, (sample_label, _) in enumerate(samples) if sample_label == label]
        class_counts[label] = len(indexes)
        centroids[label] = np.mean(normalized[indexes], axis=0).tolist()

    model = {
        "model_type": "nearest_centroid_feature_classifier",
        "version": "1.0",
        "classes": labels,
        "all_supported_classes": DISEASE_CLASSES,
        "feature_names": FEATURE_NAMES,
        "feature_mean": mean.tolist(),
        "feature_std": std.tolist(),
        "centroids": centroids,
        "class_counts": class_counts,
        "total_samples": len(samples),
        "trained_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }

    if validation:
        correct = 0
        predictions = []
        for actual, features in validation:
            predicted, confidence, _ = predict_with_model(features, model)
            correct += int(predicted == actual)
            predictions.append({"actual": actual, "predicted": predicted, "confidence": round(float(confidence), 4)})
        model["validation"] = {
            "samples": len(validation),
            "accuracy": round(correct / len(validation), 4),
            "predictions": predictions[:100],
        }

    return model


def predict_with_model(features, model):
    feature_names = model.get("feature_names", [])
    if feature_names != FEATURE_NAMES:
        raise ModelError("Saved model feature schema does not match this application version.")

    mean = np.asarray(model["feature_mean"], dtype=np.float32)
    std = np.asarray(model["feature_std"], dtype=np.float32)
    normalized = (features.astype(np.float32) - mean) / std

    labels = model["classes"]
    distances = []
    for label in labels:
        centroid = np.asarray(model["centroids"][label], dtype=np.float32)
        distances.append(float(np.linalg.norm(normalized - centroid)))

    if not distances or any(math.isnan(distance) for distance in distances):
        raise ModelError("Saved model produced invalid distances.")

    scale = max(1e-6, float(np.median(distances)))
    probs = _softmax([-distance / scale for distance in distances])
    scores = {label: float(prob) for label, prob in zip(labels, probs)}
    for label in DISEASE_CLASSES:
        scores.setdefault(label, 0.0)
    predicted = max(scores, key=scores.get)
    return predicted, scores[predicted], scores


def save_model(model, path=DEFAULT_MODEL_PATH):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(model, fh, indent=2, sort_keys=True)


def load_model(path=DEFAULT_MODEL_PATH):
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def load_metadata(path=DEFAULT_MODEL_METADATA_PATH):
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def save_metadata(metadata, path=DEFAULT_MODEL_METADATA_PATH):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2, sort_keys=True)


def tensorflow_available():
    try:
        import tensorflow  # noqa: F401
    except Exception:
        return False
    return True


def load_keras_model(path=DEFAULT_MODEL_PATH):
    if not os.path.exists(path):
        raise ModelError("Keras model file was not found.")

    try:
        from tensorflow import keras
    except Exception as exc:
        raise ModelError("TensorFlow/Keras is not installed.") from exc

    mtime = os.path.getmtime(path)
    if _KERAS_CACHE["path"] == path and _KERAS_CACHE["mtime"] == mtime and _KERAS_CACHE["model"] is not None:
        return _KERAS_CACHE["model"]

    try:
        model = keras.models.load_model(path, safe_mode=False)
    except TypeError:
        model = keras.models.load_model(path)
    _KERAS_CACHE.update({"path": path, "mtime": mtime, "model": model})
    return model


def predict_with_keras(image_data, path=DEFAULT_MODEL_PATH):
    arr, _ = load_rgb_image(image_data)
    model = load_keras_model(path)
    output = model.predict(np.expand_dims(arr, axis=0), verbose=0)
    probs = np.asarray(output[0], dtype=np.float32).reshape(-1)

    if probs.shape[0] != len(DISEASE_CLASSES):
        raise ModelError(
            f"Keras model must output {len(DISEASE_CLASSES)} class scores, got {probs.shape[0]}."
        )

    total = float(np.sum(probs))
    if total <= 0 or any(math.isnan(float(value)) for value in probs):
        raise ModelError("Keras model returned invalid probabilities.")
    probs = probs / total

    scores = {label: float(prob) for label, prob in zip(DISEASE_CLASSES, probs)}
    predicted = max(scores, key=scores.get)
    return predicted, scores[predicted], scores


def get_model_status(path=DEFAULT_MODEL_PATH):
    exists = os.path.exists(path)
    metadata = load_metadata()
    dependency_available = tensorflow_available()
    model_dir = os.path.dirname(path)

    if not exists:
        message = "No .keras model file is available yet. The app is using the built-in feature heuristic."
        next_steps = [
            "Create or train a model with train_model.py when you are ready.",
            "Place the generated .keras file in backend/models/grape_leaf_model.keras.",
        ]
        if not dependency_available:
            message = (
                "No .keras model file is available and TensorFlow is not installed. "
                "The app is using the built-in feature heuristic."
            )
            next_steps.insert(
                0,
                "Install a TensorFlow-compatible Python environment before training or loading a .keras model.",
            )

        return {
            "trained": False,
            "model_file_exists": False,
            "models_dir_exists": os.path.exists(model_dir),
            "ready_for_inference": False,
            "model_path": path,
            "model_type": "keras_cnn",
            "dependency_available": dependency_available,
            "message": message,
            "next_steps": next_steps,
        }

    return {
        "trained": True,
        "model_file_exists": True,
        "models_dir_exists": True,
        "ready_for_inference": dependency_available,
        "model_path": path,
        "model_type": metadata.get("model_type", "keras_cnn"),
        "version": metadata.get("version", "1.0"),
        "classes": metadata.get("classes", DISEASE_CLASSES),
        "class_counts": metadata.get("class_counts", {}),
        "total_samples": metadata.get("total_samples", 0),
        "trained_at": metadata.get("trained_at"),
        "validation_accuracy": metadata.get("validation_accuracy"),
        "validation_samples": metadata.get("validation_samples", 0),
        "dependency_available": dependency_available,
        "message": metadata.get(
            "message",
            "Keras model file is present and ready."
            if dependency_available
            else "A .keras model file exists, but TensorFlow is not installed in this environment.",
        ),
        "next_steps": []
        if dependency_available
        else [
            "Install TensorFlow in the Python environment running the backend.",
            "Restart the backend after TensorFlow is available so the .keras model can be loaded.",
        ],
    }


GRAPE_LEAF_MEAN = np.array([
    0.478164, 0.502384, 0.401342, 0.203319, 0.168679, 0.227167, 0.198076, 0.264331, 0.100302,
    0.726347, 0.705997, 0.694175, 0.022501, -0.026806, 0.483624, 0.181941, 0.229312, 0.708555,
    0.305529, 0.253461, 0.434335, 0.110865, 0.398918, 0.406933, 0.130770, 0.039806, 0.109615,
    0.099954, 0.260414, 0.048814, 0.051409, 0.111835, 0.862123
], dtype=np.float32)

GRAPE_LEAF_STD = np.array([
    0.051814, 0.049958, 0.052942, 0.036692, 0.031778, 0.027644, 0.074414, 0.083534, 0.049312,
    0.059866, 0.057697, 0.060352, 0.023695, 0.024804, 0.047825, 0.031800, 0.071811, 0.058618,
    0.067748, 0.041630, 0.109866, 0.113304, 0.115491, 0.104154, 0.127522, 0.035679, 0.065300,
    0.090149, 0.119683, 0.011756, 0.011449, 0.027068, 0.047375
], dtype=np.float32)


def validate_grape_leaf_image(features, quality, confidence, scores=None):
    by_name = dict(zip(FEATURE_NAMES, [float(v) for v in features]))
    leaf_color_ratio = quality.get("leaf_color_ratio", 0.0)

    # 1. Out-of-Distribution Feature Distance to Grape Leaf Dataset (Mean vector of 4062 grape leaf images)
    norm_diff = (features.astype(np.float32) - GRAPE_LEAF_MEAN) / GRAPE_LEAF_STD
    ood_distance = float(np.linalg.norm(norm_diff))

    # 2. Foliage Hue Spectrum Coverage
    foliage_hue_ratio = by_name["hue_green_ratio"] + by_name["hue_yellow_ratio"] + by_name["hue_red_brown_ratio"]

    # 3. Softmax Confidence Margin
    sorted_scores = sorted(scores.values(), reverse=True) if scores and isinstance(scores, dict) else [float(confidence), 0.0]
    margin = sorted_scores[0] - sorted_scores[1] if len(sorted_scores) > 1 else sorted_scores[0]

    # STAGE 1: Feature Distance Check (Max dataset dist = 14.8, non-grape >= 23.0)
    if ood_distance > 15.0:
        raise ValueError(
            "Invalid Image: The uploaded image does not appear to be a grape leaf. "
            "Please upload a clear, focused photo of a grape leaf."
        )

    # STAGE 2: Foliage Color & Hue Ratio Check
    if foliage_hue_ratio < 0.20 or leaf_color_ratio < 15.0:
        raise ValueError(
            "Invalid Image: The image lacks characteristic grape leaf foliage patterns. "
            "Please upload a clear photo of a grape leaf."
        )

    # STAGE 3: Texture Check (Grape leaves have vein and edge texture)
    if by_name["edge_mean"] < 0.012 or by_name["edge_mean"] > 0.15:
        raise ValueError(
            "Invalid Image: The image texture does not match grape leaf structures. "
            "Please focus clearly on one grape leaf."
        )

    # STAGE 4: Model Confidence Check
    if float(confidence) < 0.60 or margin < 0.30:
        raise ValueError(
            "Uncertain Analysis: The model cannot confidently verify this as a grape leaf. "
            "Please upload a clear photo of a grape leaf against a simple background."
        )


def predict_leaf_image(image_data, model_path=DEFAULT_MODEL_PATH):
    features, quality = extract_features(image_data)

    if os.path.exists(model_path):
        try:
            predicted, confidence, scores = predict_with_keras(image_data, model_path)
            source = "keras_model"
            version = load_metadata().get("version", "1.0")
        except ModelError:
            predicted, confidence, scores = heuristic_predict(features)
            source = "heuristic_fallback"
            version = "keras-unavailable"
    else:
        predicted, confidence, scores = heuristic_predict(features)
        source = "heuristic_fallback"
        version = "built-in"

    # Validate that the image is actually a grape leaf
    validate_grape_leaf_image(features, quality, confidence, scores)

    return {
        "predicted_class": predicted,
        "confidence": float(confidence),
        "all_scores": {label: float(scores.get(label, 0.0)) for label in DISEASE_CLASSES},
        "model_source": source,
        "model_version": version,
        "image_quality": quality,
    }
