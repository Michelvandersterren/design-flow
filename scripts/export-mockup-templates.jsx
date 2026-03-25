/**
 * export-mockup-templates.jsx
 *
 * Photoshop JSX script — run via:
 *   osascript -e 'tell application "Adobe Photoshop 2026" to do javascript file "/path/to/export-mockup-templates.jsx"'
 *
 * For each PSD:
 *   1. Open the file
 *   2. Hide the design layer(s) (by name, recursively)
 *   3. Export as PNG to public/mockup-templates/{IB|SP|MC}/
 *   4. Close without saving
 *
 * Output log written to /tmp/export-mockup-log.txt
 */

// ─── Configuration ────────────────────────────────────────────────────────────

var BASE_PSD = "/Users/Michel/Desktop/Shopify/New Products/";
var BASE_OUT = "/Users/Michel/Desktop/Shopify/design-flow/public/mockup-templates/";
var LOG_FILE = "/tmp/export-mockup-log.txt";

// Suppress all dialogs (font warnings etc.)
app.displayDialogs = DialogModes.NO;

// ─── PSD export list ──────────────────────────────────────────────────────────
// Each entry: { psd, out, hide[] }
//   psd  – path relative to BASE_PSD
//   out  – output path relative to BASE_OUT
//   hide – array of layer NAMES to hide (searched recursively, all matches hidden)

var EXPORTS = [

  // ── IB ──────────────────────────────────────────────────────────────────────
  {
    psd: "Mockups IB/mockup-3.psd",
    out: "IB/mockup-3.png",
    hide: ["induction protector smart object"]
  },
  {
    psd: "Mockups IB/mockup-4.psd",
    out: "IB/mockup-4.png",
    hide: ["induction protector smart object copy"]
  },
  {
    psd: "Mockups IB/mockup-5.psd",
    out: "IB/mockup-5.png",
    hide: ["induction protector smart object"]
  },
  {
    psd: "Mockups IB/mockup-6.psd",
    out: "IB/mockup-6.png",
    hide: ["induction protector smart object"]
  },
  {
    psd: "Mockups IB/mockup-02.psd",
    out: "IB/mockup-02.png",
    hide: ["design"]
  },
  // mockup-1 size-specific series
  {
    psd: "Mockups IB/mockup-1 50x35.psd",
    out: "IB/mockup-1-50x35.png",
    hide: ["52x35"]
  },
  {
    psd: "Mockups IB/mockup-1 52x35.psd",
    out: "IB/mockup-1-52x35.png",
    hide: ["52x35"]
  },
  {
    psd: "Mockups IB/mockup-1 59x50.psd",
    out: "IB/mockup-1-59x50.png",
    hide: ["59x50"]
  },
  {
    psd: "Mockups IB/mockup-1 70x52.psd",
    out: "IB/mockup-1-70x52.png",
    hide: ["70x52"]
  },
  {
    psd: "Mockups IB/mockup-1 75x52.psd",
    out: "IB/mockup-1-75x52.png",
    hide: ["75x52"]
  },
  {
    psd: "Mockups IB/mockup-1 80x52.psd",
    out: "IB/mockup-1-80x52.png",
    hide: ["80x52"]
  },
  {
    psd: "Mockups IB/mockup-1 86x52.psd",
    out: "IB/mockup-1-86x52.png",
    hide: ["86x52"]
  },
  {
    psd: "Mockups IB/mockup-1 90x52.psd",
    out: "IB/mockup-1-90x52.png",
    hide: ["90x52"]
  },

  // ── SP ──────────────────────────────────────────────────────────────────────
  {
    psd: "Mockups SP/Mockup-1.psd",
    out: "SP/mockup-1.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-2.psd",
    out: "SP/mockup-2.png",
    hide: ["kitchen splash new smart object", "design"]
  },
  {
    psd: "Mockups SP/Mockup-3.psd",
    out: "SP/mockup-3.png",
    hide: ["kitchen splash new smart object", "design smaller"]
  },
  {
    psd: "Mockups SP/Mockup-5.psd",
    out: "SP/mockup-5.png",
    hide: ["kitchen splash new smart object", "design"]
  },
  {
    psd: "Mockups SP/Mockup-6-spat-merged.psd",
    out: "SP/mockup-6.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-7-spat-retouched 2.psd",
    out: "SP/mockup-7.png",
    hide: ["panel"]
  },
  // Mockup-4 size-specific — design layers are nested inside mockups > {size} group
  {
    psd: "Mockups SP/Mockup-4 60x30.psd",
    out: "SP/mockup-4-60x30.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 60x40.psd",
    out: "SP/mockup-4-60x40.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 70x30.psd",
    out: "SP/mockup-4-70x30.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 70x50.psd",
    out: "SP/mockup-4-70x50.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 80x40.psd",
    out: "SP/mockup-4-80x40.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 80x55.psd",
    out: "SP/mockup-4-80x55.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 90x45.psd",
    out: "SP/mockup-4-90x45.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 90x60.psd",
    out: "SP/mockup-4-90x60.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 100x50.psd",
    out: "SP/mockup-4-100x50.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 100x65.psd",
    out: "SP/mockup-4-100x65.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 120x60.psd",
    out: "SP/mockup-4-120x60.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },
  {
    psd: "Mockups SP/Mockup-4 120x80.psd",
    out: "SP/mockup-4-120x80.png",
    hide: ["kitchen splash new smart object", "kitchen splash new smart object copy"]
  },

  // ── MC ──────────────────────────────────────────────────────────────────────
  {
    psd: "Mockups MC/Dinning_room_circle_art.psd",
    out: "MC/lifestyle.png",
    hide: ["circle art smart object"]
  },
  {
    psd: "Mockups MC/circleart.psd",
    out: "MC/circleart.png",
    hide: ["circle art smart object"]
  },
  {
    psd: "Mockups MC/Dinning_room_circle_art_40cm.psd",
    out: "MC/40cm.png",
    hide: ["40cm"]
  },
  {
    psd: "Mockups MC/Dinning_room_circle_art_60cm.psd",
    out: "MC/60cm.png",
    hide: ["60cm"]
  },
  {
    psd: "Mockups MC/Dinning_room_circle_art_80cm.psd",
    out: "MC/80cm.png",
    hide: ["80cm"]
  },
  {
    psd: "Mockups MC/Dinning_room_circle_art_100cm.psd",
    out: "MC/100cm.png",
    hide: ["100cm"]
  },
  {
    psd: "Mockups MC/Mockup-3_100cm.psd",
    out: "MC/mockup-3-100cm.png",
    hide: ["edits"]
  },
  {
    psd: "Mockups MC/Mockup-5_100cm.psd",
    out: "MC/mockup-5-100cm.png",
    hide: ["edits"]
  },
  {
    psd: "Mockups MC/Mockup-6_100cm.psd",
    out: "MC/mockup-6-100cm.png",
    hide: ["edits"]
  },
  {
    psd: "Mockups MC/Mockup-7_100cm.psd",
    out: "MC/mockup-7-100cm.png",
    hide: ["edits copy"]
  },
  {
    psd: "Mockups MC/Mockup-8_100cm.psd",
    out: "MC/mockup-8-100cm.png",
    hide: ["edits copy"]
  },
  {
    psd: "Mockups MC/Mockup-10_80cm.psd",
    out: "MC/mockup-10-80cm.png",
    hide: ["edits copy"]
  }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

var logLines = [];

function log(msg) {
  logLines.push(msg);
}

function writeLog() {
  var f = new File(LOG_FILE);
  f.open("w");
  f.write(logLines.join("\n"));
  f.close();
}

/**
 * Recursively search all layers (including inside layer sets/groups) and
 * hide any layer whose name matches one of the names in hideNames[].
 * Returns the count of layers hidden.
 */
function hideLayers(layerCollection, hideNames) {
  var count = 0;
  for (var i = 0; i < layerCollection.length; i++) {
    var layer = layerCollection[i];
    // Check name match (case-sensitive, exact)
    for (var n = 0; n < hideNames.length; n++) {
      if (layer.name === hideNames[n]) {
        layer.visible = false;
        count++;
        log("  Hidden: '" + layer.name + "'");
      }
    }
    // Recurse into layer sets (groups)
    try {
      if (layer.layers && layer.layers.length > 0) {
        count += hideLayers(layer.layers, hideNames);
      }
    } catch (e) {
      // layer.layers throws on non-group layers — ignore
    }
  }
  return count;
}

/**
 * Export the active document as PNG to outPath.
 * Uses legacy exportDocument with ExportType.SAVEFORWEB for reliable PNG export.
 */
function exportAsPng(doc, outPath) {
  var exportOptions = new ExportOptionsSaveForWeb();
  exportOptions.format = SaveDocumentType.PNG;
  exportOptions.PNG8 = false;   // PNG-24 (full colour + alpha)
  exportOptions.transparency = true;
  exportOptions.interlaced = false;
  exportOptions.quality = 100;

  var outFile = new File(outPath);
  doc.exportDocument(outFile, ExportType.SAVEFORWEB, exportOptions);
}

// ─── Main loop ────────────────────────────────────────────────────────────────

log("=== export-mockup-templates.jsx ===");
log("Started: " + new Date().toString());
log("Total PSDs: " + EXPORTS.length);
log("");

var ok = 0;
var fail = 0;

for (var i = 0; i < EXPORTS.length; i++) {
  var entry = EXPORTS[i];
  var psdPath = BASE_PSD + entry.psd;
  var outPath = BASE_OUT + entry.out;

  log("[" + (i + 1) + "/" + EXPORTS.length + "] " + entry.psd);

  try {
    // Open the PSD
    var psdFile = new File(psdPath);
    if (!psdFile.exists) {
      log("  ERROR: File not found: " + psdPath);
      fail++;
      continue;
    }

    var doc = app.open(psdFile);

    // Hide design layers recursively
    var hidden = hideLayers(doc.layers, entry.hide);
    if (hidden === 0) {
      log("  WARNING: No layers hidden (check layer names). Continuing anyway.");
    } else {
      log("  Hidden " + hidden + " layer(s).");
    }

    // Flatten to merge visible layers — but keep as layered for export
    // (we just export with current visibility, no flatten needed)

    // Export PNG
    exportAsPng(doc, outPath);
    log("  Exported to: " + outPath);

    // Close without saving
    doc.close(SaveOptions.DONOTSAVECHANGES);
    ok++;

  } catch (e) {
    log("  ERROR: " + e.toString());
    fail++;
    // Try to close if doc was opened
    try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch(e2) {}
  }

  // Write log after each file so we can tail it during the run
  writeLog();
}

log("");
log("=== Done: " + ok + " OK, " + fail + " failed ===");
writeLog();
