// ─────────────────────────────────────────────────────────────────────────────
// Annual Fund ROI Calculator — Google Apps Script
//
// SETUP INSTRUCTIONS:
// 1. Go to https://sheets.google.com and create a new spreadsheet
//    (name it "Annual Fund ROI Calculator Leads" or similar)
// 2. Go to Extensions → Apps Script
// 3. Delete any existing code and paste this entire file
// 4. Click Save (floppy disk icon)
// 5. Click Deploy → New deployment
// 6. Click the gear icon next to "Type" and select "Web app"
// 7. Set:
//      Description: ROI Calculator
//      Execute as: Me
//      Who has access: Anyone
// 8. Click Deploy → copy the Web app URL
// 9. Paste that URL into SHEET_ENDPOINT in src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // Write header row automatically on first submission
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "School Name",
        "Email",
        "Fundraising Platform",
        "CRM",
        "Last Year's Donors",
        "Last Year's Revenue ($)",
        "Solicitable Community",
        "Participation Goal",
        "Revenue Goal ($)",
        "Offers Apple Pay",
        "Offers Google Pay",
        "Offers Venmo",
        "Offers PayPal",
        "Offers ACH",
        "Offers DAF"
      ]);

      // Bold + freeze the header row
      sheet.getRange(1, 1, 1, 16).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    var offered = data.offered || {};

    sheet.appendRow([
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
      data.schoolName          || "",
      data.email               || "",
      data.platform            || "Not specified",
      data.crm                 || "Not specified",
      data.lastYearDonors      ? Number(data.lastYearDonors)      : "",
      data.lastYearRevenue     ? Number(data.lastYearRevenue)     : "",
      data.solicitableCommunity ? Number(data.solicitableCommunity) : "",
      data.participationGoal   ? Number(data.participationGoal)   : "",
      data.revenueGoal         ? Number(data.revenueGoal)         : "",
      offered.apple_pay  ? "Yes" : "No",
      offered.google_pay ? "Yes" : "No",
      offered.venmo      ? "Yes" : "No",
      offered.paypal     ? "Yes" : "No",
      offered.ach        ? "Yes" : "No",
      offered.daf        ? "Yes" : "No"
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test this function manually in the Apps Script editor
function testPost() {
  var mock = {
    postData: {
      contents: JSON.stringify({
        schoolName: "Northfield Academy",
        email: "director@northfield.edu",
        platform: "Raiser's Edge / RE NXT",
        crm: "Raiser's Edge / RE NXT",
        lastYearDonors: "650",
        lastYearRevenue: "500000",
        solicitableCommunity: "5000",
        participationGoal: "750",
        revenueGoal: "600000",
        offered: {
          apple_pay: false,
          google_pay: false,
          venmo: false,
          paypal: false,
          ach: false,
          daf: false
        }
      })
    }
  };
  Logger.log(doPost(mock));
}
