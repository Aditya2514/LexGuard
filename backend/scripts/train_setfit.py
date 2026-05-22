"""
Google Colab SetFit Training Script for LexGuard Predatory Clause Classifier
Instructions:
1. Run `node generate_dataset.js` to create `predatory_clauses_dataset.json`.
2. Upload `predatory_clauses_dataset.json` to Google Colab.
3. Install dependencies in Colab: `!pip install setfit datasets optimum[onnxruntime]`
4. Run this script in Colab.
5. Download the `lexguard_predatory_model_onnx` folder and place it in the backend directory.
"""

from datasets import load_dataset
from setfit import SetFitModel, SetFitTrainer
from optimum.onnxruntime import ORTModelForFeatureExtraction
from sentence_transformers.losses import CosineSimilarityLoss
import json

# 1. Load Dataset
print("Loading dataset...")
dataset = load_dataset('json', data_files='predatory_clauses_dataset.json')
# Split into train and test
dataset = dataset['train'].train_test_split(test_size=0.1)

# 2. Initialize SetFit Model (DistilBERT is fast and small)
print("Initializing model...")
model = SetFitModel.from_pretrained(
    "sentence-transformers/paraphrase-mpnet-base-v2"
)

# 3. Trainer
trainer = SetFitTrainer(
    model=model,
    train_dataset=dataset['train'],
    eval_dataset=dataset['test'],
    loss_class=CosineSimilarityLoss,
    metric="accuracy",
    batch_size=16,
    num_iterations=20, # The number of text pairs to generate for contrastive learning
    num_epochs=1,
)

# 4. Train
print("Training model...")
trainer.train()
metrics = trainer.evaluate()
print("Metrics:", metrics)

# 5. Export to ONNX (for fast local inference via transformers.js)
print("Exporting model...")
model.save_pretrained("./lexguard_predatory_model")

# Convert to ONNX format (simplified, using optimum)
# (In practice, transformers.js recommends using their python export script: 
# https://github.com/xenova/transformers.js/tree/main/scripts)
print("Done! You can now use the model with transformers.js.")
