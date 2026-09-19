# Disaster severity ML model

This folder contains the supervised ML baseline used by the Disaster Response Intelligence System.

## Model

**TF-IDF + Logistic Regression**

Inputs:
- disaster type
- report description
- people affected

Output:
- severity: low / medium / high / critical
- confidence: highest class probability
- probability for each severity class
- urgency
- priority score

## 1. Create Python environment

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ai\requirements.txt
```

If PowerShell blocks activation, run the Python commands without activating the environment, or use:

```powershell
.\.venv\Scripts\python.exe -m pip install -r ai\requirements.txt
```

## 2. Train the model

```powershell
python ai\train_model.py
```

This creates:

```
ai/models/severity_model.joblib
```

The generated model file is intentionally ignored by Git.

## 3. Test a prediction

```powershell
'{"type":"flood","description":"Flood water has entered houses and people are trapped","peopleAffected":35}' | python ai\predict.py
```

## 4. Use it from the Node backend

The authority endpoint:

```
POST /api/reports/:id/analyze
```

now calls the trained Python model and returns its prediction.

The authority still makes the final severity decision; the ML result is a recommendation.

## Retraining

When more labelled reports become available, add them to `training_data.csv` and rerun:

```powershell
python ai\train_model.py
```
