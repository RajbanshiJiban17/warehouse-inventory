https://goodwan-inventory-frontend.onrender.com/
# GoodWan Inventory & Warehouse Management System (INV-GoodWan)

A production-grade, secure, modern Inventory and Warehouse Management System built strictly according to the architecture specification.

---

## 🌟 Key Highlights & PDF Feature Coverage

### 1. Automatic Stock Management (Item In & Item Out)
- **Item In (Stock Receive)**:
  - Entering or scanning barcode instantly pulls item details.
  - Submitting increases total stock automatically.
  - Generates immutable ledger entry (`StockMovement`) recording `balanceAfter` and reference details.
- **Item Out (Stock Issue)**:
  - Scanning or typing item code loads available stock in real time.
  - **Automatic Stock Deduction**: As requested (*"qty ma item in ko qty ghatera aaunu pareu item out ma yeu change automatic hunu pareu"*), issuing stock atomically decreases the item's on-hand quantity.
  - **Negative Stock Prevention**: Row locking and atomic SQL constraints (`WHERE quantity >= :qty` + database `CHECK (quantity >= 0)`) prevent over-issuing and race conditions.
  - Live warning triggers if stock drops below configured `minStockLevel`.

### 2. Comprehensive Reporting (All 7 Reports from PDF)
1. **Current Stock Report**: Item code, name, category, unit, location, quantity, unit price, stock valuation, and stock status badges (In Stock, Low Stock, Out of Stock).
2. **Stock Ledger / Movement History**: Full transactional audit trail showing Type (OPENING, IN, OUT, ADJUSTMENT), reference number, quantity changed, previous balance, and `balanceAfter`.
3. **Low Stock / Reorder Report**: Real-time list of all items at or below reorder threshold.
4. **Location-wise Stock Report**: Inventory broken down across warehouse rooms, racks, shelves, and godowns.
5. **Fast Moving vs Slow Moving Items Report**: Analyzes stock velocity and total issued quantities.
6. **Dead / Dormant Stock Report**: Highlights inactive items with no movement over 30/60/90 days.
7. **User Activity & Audit Trail**: Full tamper-proof log of user transactions, timestamps, and IP addresses.
- **Multi-Format Exports**: All reports can be exported to **PDF** (printable table), **Excel (.xlsx)**, and **CSV**, or printed directly with browser print styling.
- **Mathematical Reconciliation**: Automatic ledger validation badge verifying `Opening Stock + Total In - Total Out == Closing Stock`.

### 3. Enterprise Security & Access Control
- **Argon2id** password hashing.
- **JWT Authentication** with 15-minute access tokens and 7-day secure HTTP-only refresh tokens with family tracking and reuse detection.
- **Role-Based Access Control (RBAC)**:
  - `ADMIN`: Full system control, item management, category/unit/location master, user approval, password reset, and immutable audit logs.
  - `MANAGER`: Stock In, Stock Out, all reports, and dashboards.
  - `STAFF`: Stock In, Stock Out, item lookup, and barcode scanner operations.
- **User Approval Flow**: Self-registered users are placed in `PENDING` status until an Admin reviews and activates them.
- **SlowAPI Rate Limiting**: 5 attempts per 15 minutes on login endpoints with lockout protection.
- **Security Headers**: HSTS, Content-Security-Policy (CSP), X-Frame-Options, CSRF tokens.

### 4. Cross-Platform Desktop & Web Integration
- **Web App**: Built with React 18, TypeScript, Tailwind CSS, and Lucide React icons.
- **Desktop App (Electron)**: Encapsulated with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and configurable backend server endpoint for standalone or LAN deployment.

---

## 🚀 Quick Start Guide (Windows)

### Default Administrator Credentials
- **Username**: `admin`
- **Password**: `Admin@12345`

---

### Method 1: One-Click Startup (Recommended)
Double-click `start_all.bat` in the root folder:
- Automatically starts the FastAPI backend server on `http://127.0.0.1:8000`.
- Launches the Electron Desktop App.

---

### Method 2: Running Individually

#### 1. Backend Server
Double-click `run_backend.bat` or run:
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Base: `http://127.0.0.1:8000`
- Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

#### 2. Web Browser Frontend
Double-click `run_frontend.bat` or run:
```powershell
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

#### 3. Electron Desktop App
Double-click `run_desktop.bat` or run:
```powershell
cd frontend
npm run electron:preview
```

---

## 🧪 Automated Test Suite

Run the full automated test suite (27 unit, integration, concurrency, and reconciliation tests):
```powershell
cd backend
python -m pytest
```
Result: **27 passed** (including simultaneous race-condition test preventing overselling).
