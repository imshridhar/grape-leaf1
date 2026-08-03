from tensorflow import keras

model = keras.models.load_model("grape_leaf_model.keras")

print(model.count_params())
model.summary()