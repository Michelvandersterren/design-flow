/**
 * generate-mockup.jsx
 *
 * Photoshop JSX — non-interactive version of the existing mockup scripts.
 * Reads job config from /tmp/mockup-job.json, generates one mockup, writes
 * result to /tmp/mockup-job-result.json.
 *
 * Config schema:
 * {
 *   "psdPath":    "/absolute/path/to/template.psd",
 *   "designPath": "/absolute/path/to/design.jpg",  // temp file written by Node
 *   "outPath":    "/tmp/mockup-out/filename.jpg"
 * }
 *
 * Result schema:
 * { "success": true,  "outPath": "..." }
 * { "success": false, "error": "..." }
 *
 * Output is resized to 2000x2000 px, converted to sRGB, saved as JPEG quality 5
 * (same as the original scripts).
 */

app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;
app.preferences.exportClipboard = false;

var CONFIG_PATH = "/tmp/mockup-job.json";
var RESULT_PATH = "/tmp/mockup-job-result.json";

// --- Helpers -----------------------------------------------------------------

function writeResult(obj) {
  var f = new File(RESULT_PATH);
  f.open("w");
  f.encoding = "UTF-8";
  // Manual JSON serialise -- ExtendScript has no JSON.stringify
  var pairs = [];
  for (var k in obj) {
    var v = obj[k];
    var val = (typeof v === "boolean") ? String(v)
            : ('"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"');
    pairs.push('"' + k + '": ' + val);
  }
  f.write("{" + pairs.join(", ") + "}");
  f.close();
}

/** Collect all SMARTOBJECT ArtLayers recursively. */
function collectSmartLayers(layerCollection, outArray) {
  for (var i = 0; i < layerCollection.length; i++) {
    var L = layerCollection[i];
    try {
      if (L.typename === "ArtLayer") {
        if (L.kind == LayerKind.SMARTOBJECT) outArray.push(L);
      } else {
        collectSmartLayers(L.layers, outArray);
      }
    } catch (e) { /* ignore locked/odd layers */ }
  }
}

/**
 * Open smart object, paste design image (scaled to cover + centered), save & close.
 * This preserves the SO's warp/perspective transform on the main canvas.
 * Requires the linked PSB source file to be present next to the PSD.
 */
function fillSmartObject(mainDoc, soLayer, designFilePath) {
  mainDoc.activeLayer = soLayer;

  // Enter the smart object — opens the linked PSB as a separate document
  executeAction(stringIDToTypeID("placedLayerEditContents"), undefined, DialogModes.NO);
  var soDoc = app.activeDocument;

  // Open the design image, copy it
  var imgDoc = app.open(new File(designFilePath));
  imgDoc.selection.selectAll();
  imgDoc.selection.copy();
  imgDoc.close(SaveOptions.DONOTSAVECHANGES);

  // Paste into smart object canvas
  app.activeDocument = soDoc;
  soDoc.paste();
  var pasted = soDoc.activeLayer;

  // Scale to cover the smart object canvas
  var docW = soDoc.width.as("px");
  var docH = soDoc.height.as("px");
  var b = pasted.bounds;
  var lw = b[2].as("px") - b[0].as("px"); if (lw === 0) lw = 1;
  var lh = b[3].as("px") - b[1].as("px"); if (lh === 0) lh = 1;
  var scalePct = Math.max(docW / lw, docH / lh) * 100;
  pasted.resize(scalePct, scalePct, AnchorPosition.MIDDLECENTER);

  // Center on canvas
  var b2 = pasted.bounds;
  var lw2 = b2[2].as("px") - b2[0].as("px");
  var lh2 = b2[3].as("px") - b2[1].as("px");
  var dx = (docW - lw2) / 2 - b2[0].as("px");
  var dy = (docH - lh2) / 2 - b2[1].as("px");
  pasted.translate(dx, dy);

  // Flatten and save the PSB — changes propagate to the main PSD
  try { soDoc.flatten(); } catch (e) {}
  soDoc.close(SaveOptions.SAVECHANGES);

  app.activeDocument = mainDoc;
}

/** Save a copy of doc as JPEG at 2000x2000 sRGB. */
function saveJPG(doc, outPath) {
  doc.resizeImage(UnitValue(2000, "px"), UnitValue(2000, "px"), 72, ResampleMethod.BICUBIC);
  try {
    doc.convertProfile("sRGB IEC61966-2.1", Intent.RELATIVECOLORIMETRIC, true, false);
  } catch (e) {}

  var opts = new JPEGSaveOptions();
  opts.quality = 5;          // matches original scripts (Photoshop 0-12 scale)
  opts.includeProfile = false;
  opts.interlaced = false;
  opts.optimized = true;

  doc.saveAs(new File(outPath), opts, true /* asCopy */, Extension.LOWERCASE);
}

// --- Main --------------------------------------------------------------------

var cfgFile = new File(CONFIG_PATH);
if (!cfgFile.exists) {
  writeResult({ success: false, error: "Config not found: " + CONFIG_PATH });
} else {
  cfgFile.open("r");
  cfgFile.encoding = "UTF-8";
  var cfgStr = cfgFile.read();
  cfgFile.close();

  var cfg;
  try { cfg = eval("(" + cfgStr + ")"); }
  catch (e) { writeResult({ success: false, error: "Config parse error: " + e }); cfg = null; }

  if (cfg) {
    var doc;
    try {
      var psdFile = new File(cfg.psdPath);
      if (!psdFile.exists) {
        writeResult({ success: false, error: "PSD not found: " + cfg.psdPath });
      } else {
        doc = app.open(psdFile);

        var smartLayers = [];
        collectSmartLayers(doc.layers, smartLayers);

        if (smartLayers.length === 0) {
          doc.close(SaveOptions.DONOTSAVECHANGES);
          writeResult({ success: false, error: "No smart object layers found in: " + cfg.psdPath });
        } else {
          // Fill every smart object that can be entered.
          // SOs that fail to open (e.g. broken placeholders named 'remove') are skipped silently.
          var filled = 0;
          var skipped = 0;
          for (var s = 0; s < smartLayers.length; s++) {
            try {
              fillSmartObject(doc, smartLayers[s], cfg.designPath);
              filled++;
            } catch (soErr) {
              skipped++;
              app.activeDocument = doc; // ensure we're back on main doc after a failed enter
            }
          }

          if (filled === 0) {
            doc.close(SaveOptions.DONOTSAVECHANGES);
            writeResult({ success: false, error: "Could not fill any smart object in: " + cfg.psdPath });
          } else {
            // Ensure output dir exists
            var outFile = new File(cfg.outPath);
            if (!outFile.parent.exists) outFile.parent.create();

            saveJPG(doc, cfg.outPath);

            // Clean up: remove pasted layers from each SO so the PSB resets for the next run.
            for (var s2 = 0; s2 < smartLayers.length; s2++) {
              doc.activeLayer = smartLayers[s2];
              try {
                executeAction(stringIDToTypeID("placedLayerEditContents"), undefined, DialogModes.NO);
                var cleanDoc = app.activeDocument;
                try {
                  while (cleanDoc.layers.length > 1) {
                    cleanDoc.layers[0].remove();
                  }
                } catch (e3) {
                  cleanDoc.selection.selectAll();
                  cleanDoc.selection.clear();
                  cleanDoc.selection.deselect();
                }
                cleanDoc.save();
                cleanDoc.close(SaveOptions.SAVECHANGES);
              } catch (e4) { /* ignore cleanup errors for unenterable SOs */ }
              app.activeDocument = doc;
            }

            doc.close(SaveOptions.DONOTSAVECHANGES);
            writeResult({ success: true, outPath: cfg.outPath });
          }
        }
      }
    } catch (err) {
      try { if (doc) doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
      writeResult({ success: false, error: err.toString() });
    }
  }
}
