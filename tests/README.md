# FinTra - Exploratory Testing with PinchTab

This directory contains automated exploratory testing scripts for FinTra, utilizing **PinchTab** to control the browser and write results directly to Google Sheets.

## Architecture
- **UI Assertion**: Uses PinchTab API (`/snapshot`, `/text`, `/action`).
- **API Assertion**: Uses `axios` to directly call the backend.
- **DB Assertion**: Uses `mysql2` to check data integrity directly.
- **Reporting**: Uses `googleapis` to log results to an online Google Sheets file.

## Installation

1. Open a terminal at the root directory of the project and install the dependencies for the test folder:
```bash
cd tests
npm install
```

2. Install the PinchTab server globally:
```bash
npm install -g pinchtab
```

3. Configure Google Sheets (Optional):
- Place the `service-account.json` file downloaded from Google Cloud into the `tests/pinchtab/` directory.
- Fill in your `SPREADSHEET_ID` in the `config.js` file.

## How to run tests

1. **Start Frontend & Backend**: Ensure ports `5173` and `9999` are running.
2. **Start PinchTab**:
```bash
pinchtab server
```
3. **Run the test runner**:
```bash
cd tests/pinchtab
node run-all.js
```
