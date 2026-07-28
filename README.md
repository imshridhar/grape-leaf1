# 🍇 GrapeGuard: AI-Powered Grape Leaf Disease Detection & Vineyard Yield Forecasting

**GrapeGuard** is an advanced full-stack artificial intelligence application engineered for precision viticulture. The system integrates Deep Learning (CNNs), Computer Vision Out-of-Distribution (OOD) validation, multi-factor Agronomic Yield Modeling, **Multi-Language Localization (Kannada, Hindi, English)**, and a **Mobile-Responsive Glassmorphism Design System** to help grape farmers detect foliar diseases early, forecast vineyard yields, assess quality grades, and calculate financial profits accurately across desktop and mobile devices.

---

## 🛠️ Tech Stack & Architecture

### **Frontend**
- **Framework**: React 18, Vite 7
- **Multi-Language (i18n)**: Custom React `LanguageContext` provider with `translations.js` localization dictionary (**Kannada** default, **Hindi**, **English**), persistent browser `localStorage` saving, and fallback chain.
- **Responsive Styling**: Mobile-First Vanilla CSS Design System with HSL Tailored Colors, Dark Mode Accents, Glassmorphism (`backdrop-filter`), CSS Grid/Flexbox reflow, Mobile Drawer Navigation, and Touch-optimized media queries (`@media (max-width: 640px)`).
- **Speech API**: Web Speech Recognition API (`window.webkitSpeechRecognition`) for hands-free voice input dictation.
- **State & Routing**: Custom reactive browser state management with `useMemo` live computation engine.

### **Backend**
- **Framework**: Flask (Python 3.10+)
- **REST APIs**: Modular endpoints for authentication, disease detection, variety presets, yield forecasting, and history management.
- **Security**: Werkzeug/Bcrypt PBKDF2 password hashing with SHA-256 salts, HTTP session management, and strict payload validation.
- **CORS**: `Flask-CORS` cross-origin resource sharing.

### **Machine Learning & Computer Vision**
- **Deep Learning Framework**: TensorFlow 2.x / Keras
- **Neural Network Architecture**: **MobileNetV2 Transfer Learning Backbone** (`mobilenetv2_1.00_224`) fine-tuned for grape leaf disease identification (`healthy`, `black_rot`, `esca`, `leaf_blight`).
- **Computer Vision**: OpenCV (`cv2`) for HSV foliage segmentation, Canny edge density distribution, and OOD validation.
- **Numerical Processing**: NumPy for matrix transformations and logit distance computation.

### **Database**
- **Database Engine**: MongoDB (via `pymongo`)
- **Database Name**: `grapeleaf_db2`
- **Collections**:
  - `users`: User authentication accounts and hashed credentials
  - `predictions`: Unified scan history (disease detections and yield prediction reports)
  - `grapes_yield_predictions`: Dedicated grape yield analytics records

---

## 🧮 Comprehensive Algorithms Reference List

The application utilizes 16 distinct algorithms across Deep Learning, Computer Vision, Agronomic Science, Financial Economics, Internationalization (i18n), Responsive Mobile UI Design, and Web Security:

### 1. MobileNetV2 Deep Transfer Learning Architecture Algorithm
- **Purpose**: MobileNetV2 backbone trained on ImageNet and fine-tuned for grape leaf disease classification to extract spatial features (vein patterns, lesions, spots, chlorosis) with high speed and low memory footprint.
- **Layers & Structure**:
  - **Input Layer**: `leaf_image` $(224 \times 224 \times 3)$ RGB tensor.
  - **Data Augmentation Block**: Sequential random flip, rotation, and zoom layers.
  - **Rescaling Layer**: Normalizes pixel intensities to $[-1, 1]$ or $[0, 1]$.
  - **MobileNetV2 Backbone**: Depthwise Separable Convolutions & Inverted Residual Blocks (1,280 feature maps output).
  - **Global Average Pooling 2D (`GlobalAveragePooling2D`)**: Collapses spatial dimensions $(7 \times 7 \times 1280 \rightarrow 1280)$.
  - **Batch Normalization (`BatchNormalization`)**: Stabilizes gradient flow and internal covariate shift.
  - **Dense Feature Layer**: Dense layer (256 units, ReLU activation).
  - **Dropout Regularization**: Dropout ($p = 0.40$) to prevent overfitting.
  - **Softmax Output Dense Layer**: Dense layer (4 output classes, Softmax activation).

---

### 2. Softmax Multi-Class Classification Algorithm
- **Purpose**: Converts unnormalized neural network logit outputs into normalized class probabilities across 4 agronomic categories (`healthy`, `black_rot`, `esca`, `leaf_blight`).
- **Equation**:
  $$P(y = c \mid \mathbf{x}) = \frac{e^{z_c}}{\sum_{k=1}^K e^{z_k}}$$
  where $z_c$ is the logit output for class $c \in \{1, 2, 3, 4\}$.

---

### 3. Categorical Cross-Entropy Optimization Algorithm
- **Purpose**: Evaluates loss during model inference/training by calculating the divergence between predicted probability distribution and true class labels:
- **Equation**:
  $$\mathcal{L}_{\text{CE}} = -\sum_{c=1}^K y_c \log(\hat{y}_c)$$

---

### 4. RGB to HSV Color Space Transformation Algorithm
- **Purpose**: Converts pixel color representations from RGB (Red-Green-Blue) to HSV (Hue-Saturation-Value) to decouple color shade (Hue) from lighting intensity and shadows (Value/Brightness).
- **Transformation Equations**:
  $$V = \max(R, G, B), \quad S = \begin{cases} 0 & \text{if } V = 0 \\ \frac{V - \min(R,G,B)}{V} & \text{otherwise} \end{cases}$$
  $$H = \begin{cases} 60^\circ \times \frac{G - B}{V - \min(R,G,B)} & \text{if } V = R \\ 60^\circ \times \left(2 + \frac{B - R}{V - \min(R,G,B)}\right) & \text{if } V = G \\ 60^\circ \times \left(4 + \frac{R - G}{V - \min(R,G,B)}\right) & \text{if } V = B \end{cases}$$

---

### 5. Foliage Binary Threshold Masking Algorithm (OOD Stage 1)
- **Purpose**: Detects green leaf presence by creating a binary mask of pixels falling within natural foliage hue bounds.
- **Threshold Range**:
  $$\text{Hue } \theta_H \in [25^\circ, 95^\circ], \quad \text{Saturation } S \ge 25, \quad \text{Value } V \ge 25$$
- **Foliage Ratio Calculation**:
  $$R_{\text{foliage}} = \frac{N_{\text{foliage\_pixels}}}{N_{\text{total\_pixels}}}$$
- **Rejection Rule**: If $R_{\text{foliage}} < 0.20$ (20%), the input image is rejected with `HTTP 400 Bad Request` ("Invalid input: Please upload a clear photo of a grape leaf").

---

### 6. Canny Edge Texture Distribution Algorithm (OOD Stage 2)
- **Purpose**: Analyzes high-frequency spatial gradients to differentiate natural biological leaf textures (veins, margins) from smooth artificial objects (phones, walls, cars).
- **Steps**:
  1. Gaussian Blur smoothing ($5 \times 5$ kernel).
  2. Sobel operator gradient magnitude & direction calculation: $G = \sqrt{G_x^2 + G_y^2}$.
  3. Non-Maximum Suppression to thin candidate edges.
  4. Hysteresis thresholding with upper/lower bounds ($T_{\text{high}} = 150, T_{\text{low}} = 50$).

---

### 7. Logit Feature Vector Distance Algorithm (OOD Stage 3)
- **Purpose**: Computes Euclidean feature distance $D_{\text{OOD}}$ of the input image's dense feature vector relative to in-distribution grape leaf class centroids:
- **Equation**:
  $$D_{\text{OOD}} = \|\mathbf{f}(\mathbf{x}) - \boldsymbol{\mu}_{\text{grape}}\| = \sqrt{\sum_{j=1}^D (f_j - \mu_j)^2}$$
- **Rejection Rule**: If $D_{\text{OOD}} > 15.0$, the input image is classified as Out-Of-Distribution.

---

### 8. Top Confidence Margin Gate Algorithm (OOD Stage 4)
- **Purpose**: Filters out ambiguous non-leaf images where the network produces flat, low-confidence probability distributions.
- **Equation**:
  $$\Delta P = P_{\text{top1}} - P_{\text{top2}}$$
- **Rejection Rule**: Rejects image if $\Delta P < 0.30$ (30% confidence gap required).

---

### 9. Spatial Vine Density Computation Algorithm
- **Purpose**: Calculates physical vine population per farm area using grid geometry dimensions.
- **Equation**:
  $$\text{Vines/Acre} = \frac{43,560}{\text{Row Spacing (ft)} \times \text{Vine Spacing (ft)}}$$
  $$\text{Total Vines} = \text{Farm Area (Acres)} \times \text{Vines/Acre}$$

---

### 10. Dual-Formula Agronomic Grape Yield Engine Algorithm
- **Primary Formula (Cluster Weight Method)**:
  $$\text{Gross Yield (kg)} = \text{Total Vines} \times \frac{\text{Clusters per Vine} \times \text{Cluster Weight (g)}}{1,000}$$
- **Secondary Formula (Berry Compound Method)**:
  $$\text{Cluster Weight (g)} = \text{Berries per Cluster} \times \text{Average Berry Weight (g)}$$
- **Net Yield Conversion**:
  $$\text{Total Yield (Tons)} = \frac{\text{Gross Yield (kg)} \times (1 - \frac{\text{Fruit Drop \%}}{100})}{1,000}$$

---

### 11. Multi-Factor Pathogen & Environmental Stress Loss Matrix Algorithm
- **Purpose**: Adjusts gross crop yield based on multi-disease and abiotic weather severity inputs.
- **Compound Multiplier Equation**:
  $$M_{\text{risk}} = \prod_{i=1}^n (1 - L_i)$$
- **Loss Coefficients ($L_i$) Table**:
  - Powdery Mildew: None ($0\%$), Mild ($5\%$), Moderate ($15\%$), Severe ($30\%$)
  - Downy Mildew: None ($0\%$), Mild ($8\%$), Moderate ($20\%$), Severe ($38\%$)
  - Botrytis Bunch Rot: None ($0\%$), Mild ($6\%$), Moderate ($18\%$), Severe ($35\%$)
  - Heat Wave Stress: None ($0\%$), Mild ($3\%$), Moderate ($8\%$), Severe ($16\%$)
  - Hail / Heavy Rain: None ($0\%$), Mild ($5\%$), Moderate ($12\%$), Severe ($25\%$)
  - Soil Salinity (EC): $\text{EC} > 2.5 \text{ dS/m} \rightarrow L_{\text{salinity}} = 10\%$
  - pH Imbalance: $| \text{pH} - 7.0 | \times 4.5\%$

---

### 12. Brix Sugar Quality Grading & Dynamic Market Pricing Algorithm
- **Purpose**: Classifies expected harvest quality grade and applies market price adjustments based on sugar accumulation ($^\circ\text{Brix}$) and canopy health.
- **Classification Rules**:
  - **Export Grade (A+ Premium)**: Brix $\ge 18.0^\circ$, Color $\ge 85\%$, Disease = Low $\rightarrow \text{Price Multiplier} = 1.25$
  - **Local Market Grade (A)**: Brix $\ge 16.5^\circ$, Color $\ge 75\% \rightarrow \text{Price Multiplier} = 1.00$
  - **Processing / Juice Grade (B)**: Brix $\ge 14.5^\circ \rightarrow \text{Price Multiplier} = 0.75$
  - **Distillery / Low Grade (C)**: Brix $< 14.5^\circ \rightarrow \text{Price Multiplier} = 0.50$

---

### 13. Financial Revenue & Net Profit Forecasting Algorithm
- **Gross Revenue**:
  $$\text{Revenue (₹)} = \text{Net Harvest (kg)} \times (\text{Base Market Price} \times \text{Quality Multiplier})$$
- **Cultivation Costs**:
  $$\text{Costs (₹)} = \text{Total Vines} \times \text{Standard Cultivation Cost per Vine (₹125)}$$
- **Net Estimated Profit**:
  $$\text{Net Profit (₹)} = \text{Revenue} - \text{Costs}$$

---

### 14. Multi-Lingual Dynamic i18n Translation & Fallback Resolution Algorithm
- **Purpose**: Dynamically renders UI strings across **Kannada (`kn`)**, **Hindi (`hi`)**, and **English (`en`)** with automatic fallback traversal and `localStorage` state persistence.
- **Algorithm Execution Steps**:
  1. Retrieve user's selected language code $L \in \{\text{'kn'}, \text{'hi'}, \text{'en'}\}$ from `localStorage.getItem('grapeguard_language')` (defaults to **Kannada `kn`**).
  2. Parse dot-notation translation keys $P = k_1.k_2\dots k_n$ via `t(path)`.
  3. Traverse nested structure: `TRANSLATIONS[L][k_1][k_2]...[k_n]`.
  4. If key is missing, automatically fallback to Kannada dictionary (`TRANSLATIONS.kn`).
  5. If still missing, fallback to English dictionary (`TRANSLATIONS.en`).
  6. Return translated string or target fallback label.

---

### 15. Responsive Viewport Adaptivity & Mobile Drawer Navigation Algorithm
- **Purpose**: Ensures 100% responsive usability across smartphone screens ($< 640\text{px}$), tablets ($< 1024\text{px}$), and wide monitors through reactive CSS grid breakpoint reflow and touch-optimized navigation controls.
- **Key Adaptations**:
  - **Collapsible Mobile Top Bar**: Automatically renders a top header (`.mobile-top-bar`) with brand logo and animated toggle hamburger button on mobile viewports ($<768\text{px}$).
  - **Backdrop Overlay Drawer**: Displays a full-height sliding navigation drawer (`.sidebar.mobile-open`) with dark backdrop overlay (`.mobile-drawer-overlay`).
  - **Horizontal Touch Navigation Bar**: Wraps yield prediction sub-navigation tabs in `-webkit-overflow-scrolling: touch` containers with hidden scrollbars for single-swipe touch scrolling.
  - **Responsive Grid Reflow**: Automatically transforms 4-column metric grids into $2 \times 2$ or 1-column responsive stacked cards on mobile devices.

---

### 16. Web Speech Recognition & Regex Token Parsing Algorithm
- **Purpose**: Captures audio input via standard Web Speech API (`webkitSpeechRecognition`), converts speech to string text, and executes Regular Expression matching to extract numerical inputs for vineyard fields:
- **Regex Expression**:
  $$\text{Pattern} = \texttt{/\textbackslash d+(\textbackslash .\textbackslash d+)?/}$$

---

## ✨ Key Features Summary

1. **🌐 Multi-Language Support (Kannada, Hindi, English)**:
   - Native support for **Kannada (ಕನ್ನಡ - Default)**, **Hindi (हिंदी)**, and **English (ENG)**.
   - Persistent language selection stored in browser storage.
   - Comprehensive translation coverage across authentication, nav drawer, disease scanner, yield sliders, variety presets, quality grades, risk factors, 7-day action plans, and scan history.
   - Interactive `LanguageSelector` segmented bar component available on auth screen & sidebar.

2. **📱 Mobile Responsive & Mobile-First Touch UX**:
   - Fully optimized for smartphones, tablets, laptops, and desktop displays.
   - Top header bar with hamburger menu toggle and sliding backdrop drawer on mobile devices.
   - Touch-optimized slider controls, horizontal swipeable tab bar, auto-fitting cards, and responsive glassmorphism containers.

3. **🌾 Grapes Yield Prediction Module (`/grapes-yield`)**:
   - Preset variety selector (Thomson Seedless, Dilkhush, Flame Seedless, Cabernet Sauvignon, Bangalore Blue).
   - 8 input categories, live interactive sliders, voice dictation, 3-tier scenario range (Worst/Expected/Best), financial profit calculator, and 7-day agronomic action plan.

4. **🔬 Grape Leaf Disease Detection (`/detect`)**:
   - Image uploader with camera capture & drag-and-drop.
   - 4-class MobileNetV2 CNN disease classification (`healthy`, `black_rot`, `esca`, `leaf_blight`).
   - Strict 4-stage Out-of-Distribution (OOD) leaf verification pipeline.

5. **📜 Unified Scan History (`/history`)**:
   - MongoDB persistence for disease detection scans and yield forecast reports.
   - Search filter, pagination, detailed report view (`/history/:id`), and 1-click PDF/print export.

6. **🎤 Hands-Free Voice Input Dictation**:
   - Voice typing via microphone icon (`🎤`) with automatic speech-to-digit parsing for field values.

---

## 📁 Repository File Map

```
Major project/
├── backend/
│   ├── app.py                   # REST API server & database handlers
│   ├── ml_model.py              # CNN model & 4-stage OOD validation pipeline
│   ├── grapes_yield.py          # Agronomic yield calculation engine
│   ├── model.h5                 # Trained CNN model weights
│   └── requirements.txt         # Dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main App wrapper & routing
│   │   ├── LanguageContext.jsx  # Multi-Language (i18n) Provider & Selector
│   │   ├── translations.js      # Exhaustive Kannada, Hindi & English Dictionaries
│   │   ├── styles.css           # Responsive Glassmorphism Design System & Media Queries
│   │   └── components/
│   │       └── GrapesYieldPrediction.jsx  # Yield Calculator Component
└── README.md                    # Exhaustive Algorithms & Architecture Document
```

---

## 🚀 Running the Project

### 1. Backend Server
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 2. Frontend Development Client
```bash
cd frontend
npm install
npm run dev
```
