import argparse
import os
from datetime import datetime
from pathlib import Path

from ml_model import (
    ALLOWED_EXTENSIONS,
    DEFAULT_MODEL_METADATA_PATH,
    DEFAULT_MODEL_PATH,
    DISEASE_CLASSES,
    IMAGE_SIZE,
    save_metadata,
)


def require_tensorflow():
    try:
        import tensorflow as tf
        from tensorflow import keras
        from tensorflow.keras import layers
    except Exception as exc:
        raise SystemExit(
            "TensorFlow/Keras is required to create a .keras model. "
            "Install dependencies with: pip install -r requirements.txt"
        ) from exc
    return tf, keras, layers


def discover_images(dataset_dir):
    dataset_path = Path(dataset_dir)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")

    records = []
    for label in DISEASE_CLASSES:
        class_dir = dataset_path / label
        if not class_dir.exists():
            continue
        for path in class_dir.rglob("*"):
            if path.is_file() and path.suffix.lower().lstrip(".") in ALLOWED_EXTENSIONS:
                records.append((label, path))
    return records


def class_counts(records):
    counts = {label: 0 for label in DISEASE_CLASSES}
    for label, _ in records:
        counts[label] += 1
    return counts


def build_model(tf, keras, layers, learning_rate, model_type="mobilenetv2"):
    data_augmentation = keras.Sequential(
        [
            layers.RandomFlip("horizontal_and_vertical"),
            layers.RandomRotation(0.15),
            layers.RandomZoom(0.15),
            layers.RandomContrast(0.15),
            layers.RandomTranslation(0.1, 0.1),
        ],
        name="leaf_augmentation",
    )

    inputs = keras.Input(shape=(IMAGE_SIZE, IMAGE_SIZE, 3), name="leaf_image")
    x = data_augmentation(inputs)

    if model_type == "mobilenetv2":
        try:
            # Preprocess inputs from [0, 1] to [-1, 1] expected by MobileNetV2 using native Keras Rescaling
            prep_x = layers.Rescaling(scale=2.0, offset=-1.0)(x)
            base_model = tf.keras.applications.MobileNetV2(
                input_shape=(IMAGE_SIZE, IMAGE_SIZE, 3),
                include_top=False,
                weights="imagenet",
            )
            base_model.trainable = False
            feat = base_model(prep_x, training=False)
            x_pool = layers.GlobalAveragePooling2D()(feat)
            x_bn = layers.BatchNormalization()(x_pool)
            x_dense = layers.Dense(256, activation="relu")(x_bn)
            x_drop = layers.Dropout(0.35)(x_dense)
            outputs = layers.Dense(len(DISEASE_CLASSES), activation="softmax", name="disease")(x_drop)
            model = keras.Model(inputs, outputs, name="grape_leaf_mobilenetv2")
            model.compile(
                optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
                loss="sparse_categorical_crossentropy",
                metrics=["accuracy"],
            )
            return model, base_model
        except Exception as err:
            print(f"Notice: Could not load pre-trained ImageNet weights ({err}). Falling back to custom deep CNN.")

    # Fallback / Custom CNN architecture
    x = layers.Conv2D(32, 3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)
    x = layers.Conv2D(64, 3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)
    x = layers.Conv2D(128, 3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)
    x = layers.Conv2D(256, 3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.4)(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(0.25)(x)
    outputs = layers.Dense(len(DISEASE_CLASSES), activation="softmax", name="disease")(x)

    model = keras.Model(inputs, outputs, name="grape_leaf_disease_cnn")
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model, None


def load_datasets(tf, dataset_dir, batch_size, validation_split, seed):
    common = {
        "directory": dataset_dir,
        "labels": "inferred",
        "label_mode": "int",
        "class_names": DISEASE_CLASSES,
        "color_mode": "rgb",
        "batch_size": batch_size,
        "image_size": (IMAGE_SIZE, IMAGE_SIZE),
        "seed": seed,
    }

    if validation_split > 0:
        train_ds = tf.keras.utils.image_dataset_from_directory(
            **common,
            validation_split=validation_split,
            subset="training",
        )
        val_ds = tf.keras.utils.image_dataset_from_directory(
            **common,
            validation_split=validation_split,
            subset="validation",
        )
    else:
        train_ds = tf.keras.utils.image_dataset_from_directory(**common)
        val_ds = None

    def normalize(images, labels):
        return tf.cast(images, tf.float32) / 255.0, labels

    autotune = tf.data.AUTOTUNE
    train_ds = train_ds.map(normalize, num_parallel_calls=autotune).prefetch(autotune)
    if val_ds is not None:
        val_ds = val_ds.map(normalize, num_parallel_calls=autotune).prefetch(autotune)
    return train_ds, val_ds


def write_metadata(path, records, history=None, init_only=False, model_type="mobilenetv2_transfer_learning"):
    counts = class_counts(records)
    validation_accuracy = None
    validation_samples = 0
    if history and "val_accuracy" in history.history:
        validation_accuracy = round(float(max(history.history["val_accuracy"])), 4)
        validation_samples = int(round(sum(counts.values()) * 0.2))

    metadata = {
        "model_type": model_type,
        "version": "2.0",
        "classes": DISEASE_CLASSES,
        "class_counts": counts,
        "total_samples": sum(counts.values()),
        "trained_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "validation_accuracy": validation_accuracy,
        "validation_samples": validation_samples,
        "model_path": path,
        "message": "Initialized architecture only; train with a real dataset before using for decisions."
        if init_only
        else f"High-accuracy {model_type} trained on grape leaf dataset.",
    }
    save_metadata(metadata, DEFAULT_MODEL_METADATA_PATH)


def main():
    parser = argparse.ArgumentParser(description="Create or train the GrapeGuard .keras image model.")
    parser.add_argument(
        "--dataset",
        default=None,
        help="Dataset folder containing black_rot, esca, healthy, and leaf_blight subfolders.",
    )
    parser.add_argument("--output", default=DEFAULT_MODEL_PATH, help="Where to save the .keras model.")
    parser.add_argument("--epochs", type=int, default=18, help="Total training epochs across stages.")
    parser.add_argument("--batch-size", type=int, default=32, help="Training batch size.")
    parser.add_argument("--validation-split", type=float, default=0.2, help="Validation fraction.")
    parser.add_argument("--learning-rate", type=float, default=0.001, help="Adam initial learning rate.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    parser.add_argument(
        "--init-only",
        action="store_true",
        help="Create an untrained .keras architecture file without reading a dataset.",
    )
    args = parser.parse_args()

    tf, keras, layers = require_tensorflow()
    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    # Determine dataset directory
    dataset_dir = args.dataset
    if not dataset_dir:
        candidates = [
            os.path.join(os.path.dirname(__file__), "Dataset"),
            "Dataset",
            os.path.join("data", "grape_leaf_dataset"),
        ]
        for cand in candidates:
            if os.path.exists(cand):
                dataset_dir = cand
                break
        if not dataset_dir:
            dataset_dir = os.path.join("data", "grape_leaf_dataset")

    model, base_model = build_model(tf, keras, layers, args.learning_rate)

    if args.init_only:
        model.save(args.output)
        write_metadata(args.output, [], init_only=True)
        print(f"Initialized Keras model saved to: {args.output}")
        return

    records = discover_images(dataset_dir)
    counts = class_counts(records)
    print(f"Discovered {sum(counts.values())} images in '{dataset_dir}':")
    for label in DISEASE_CLASSES:
        print(f"  {label}: {counts[label]}")

    missing = [label for label, count in counts.items() if count == 0]
    if missing:
        raise SystemExit("Missing dataset folders/images for: " + ", ".join(missing))

    train_ds, val_ds = load_datasets(tf, dataset_dir, args.batch_size, args.validation_split, args.seed)
    monitor = "val_accuracy" if val_ds is not None else "accuracy"

    callbacks = [
        keras.callbacks.ModelCheckpoint(
            args.output,
            monitor=monitor,
            save_best_only=True,
            mode="max",
            verbose=1,
        ),
        keras.callbacks.EarlyStopping(
            monitor=monitor,
            patience=6,
            mode="max",
            restore_best_weights=True,
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor=monitor,
            factor=0.5,
            patience=2,
            min_lr=1e-6,
            verbose=1,
        ),
    ]

    history = None
    if base_model is not None:
        # Stage 1: Warmup classifier head with frozen base
        warmup_epochs = max(4, min(6, args.epochs // 3))
        print(f"\n--- Stage 1: Classifier Warmup ({warmup_epochs} epochs) ---")
        history_stage1 = model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=warmup_epochs,
            callbacks=callbacks,
        )

        # Stage 2: Fine-tuning - unfreeze base_model top layers
        print("\n--- Stage 2: Fine-Tuning Backbone ---")
        base_model.trainable = True
        # Fine-tune from layer 100 onwards for stability
        for layer in base_model.layers[:100]:
            layer.trainable = False

        fine_tune_lr = args.learning_rate / 10.0
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=fine_tune_lr),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )

        fine_tune_epochs = args.epochs - warmup_epochs
        history_stage2 = model.fit(
            train_ds,
            validation_data=val_ds,
            initial_epoch=warmup_epochs,
            epochs=args.epochs,
            callbacks=callbacks,
        )

        # Combine histories for metadata
        history = history_stage2
        for k, v in history_stage1.history.items():
            if k in history.history:
                history.history[k] = v + history.history[k]
    else:
        # Single-stage fit for custom CNN
        history = model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=args.epochs,
            callbacks=callbacks,
        )

    model.save(args.output)
    model_type = "mobilenetv2_transfer_learning" if base_model is not None else "custom_deep_cnn"
    write_metadata(args.output, records, history=history, init_only=False, model_type=model_type)

    print()
    print(f"Keras model saved to: {args.output}")
    print(f"Metadata saved to: {DEFAULT_MODEL_METADATA_PATH}")
    if val_ds is not None and "val_accuracy" in history.history:
        best_val_acc = max(history.history["val_accuracy"]) * 100.0
        print(f"Best validation accuracy: {best_val_acc:.2f}%")


if __name__ == "__main__":
    main()
