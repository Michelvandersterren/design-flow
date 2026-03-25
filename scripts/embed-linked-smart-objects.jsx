/**
 * embed-linked-smart-objects.jsx
 *
 * Run this ONCE interactively in Photoshop to embed all linked smart objects
 * in the mockup PSDs. After running this, the generate-mockup.jsx script will
 * work headlessly without "missing linked file" errors.
 *
 * How to run:
 *   Photoshop menu → File → Scripts → Browse → select this file
 *
 * What it does:
 *   For each PSD folder, opens each PSD, embeds all linked smart objects,
 *   saves the PSD, closes it.
 */

#target photoshop

app.displayDialogs = DialogModes.NO;

var PSD_FOLDERS = [
  "/Users/Michel/Desktop/Shopify/New Products/Mockups IB",
  "/Users/Michel/Desktop/Shopify/New Products/Mockups SP",
  "/Users/Michel/Desktop/Shopify/New Products/Mockups MC"
];

var LOG_PATH = "/tmp/embed-linked-log.txt";
var logLines = [];

function log(msg) {
  logLines.push(msg);
  // Also write incrementally so we can tail it
  var f = new File(LOG_PATH);
  f.open("w");
  f.write(logLines.join("\n"));
  f.close();
}

/** Embed all linked smart objects in the document using the PS action. */
function embedAllLinked(doc) {
  // Select all layers first, then embed all linked
  // Use the "placedLayerEmbedAllLinked" action if available
  try {
    var idEmbedAllLinked = stringIDToTypeID("placedLayerEmbedAllLinked");
    executeAction(idEmbedAllLinked, undefined, DialogModes.NO);
    return true;
  } catch (e) {
    return false;
  }
}

/** Recursively embed each linked smart object layer individually as fallback. */
function embedLayersRecursively(layerCollection) {
  var count = 0;
  for (var i = 0; i < layerCollection.length; i++) {
    var L = layerCollection[i];
    try {
      if (L.typename === "ArtLayer" && L.kind == LayerKind.SMARTOBJECT) {
        // Try to embed this specific layer
        var doc = app.activeDocument;
        doc.activeLayer = L;
        try {
          var idEmbed = stringIDToTypeID("placedLayerEmbedLinked");
          executeAction(idEmbed, undefined, DialogModes.NO);
          count++;
        } catch (e2) {
          // May already be embedded or not linked — ignore
        }
      } else if (L.layers) {
        count += embedLayersRecursively(L.layers);
      }
    } catch (e) {}
  }
  return count;
}

var totalOk = 0;
var totalFail = 0;

log("=== embed-linked-smart-objects.jsx ===");
log("Started: " + new Date().toString());
log("");

for (var f = 0; f < PSD_FOLDERS.length; f++) {
  var folder = new Folder(PSD_FOLDERS[f]);
  if (!folder.exists) {
    log("Folder not found: " + PSD_FOLDERS[f]);
    continue;
  }

  var psds = folder.getFiles(/\.psd$/i);
  log("Folder: " + PSD_FOLDERS[f] + " (" + psds.length + " PSDs)");

  for (var p = 0; p < psds.length; p++) {
    var psdFile = psds[p];
    log("  [" + (p+1) + "/" + psds.length + "] " + psdFile.name);

    var doc;
    try {
      doc = app.open(psdFile);

      // Try bulk embed first
      var bulkOk = embedAllLinked(doc);
      if (bulkOk) {
        log("    Embedded all linked (bulk action)");
      } else {
        // Fall back to per-layer embed
        var n = embedLayersRecursively(doc.layers);
        log("    Embedded " + n + " layer(s) individually");
      }

      // Save the PSD with embedded objects
      doc.save();
      doc.close(SaveOptions.SAVECHANGES);
      log("    Saved OK");
      totalOk++;

    } catch (err) {
      log("    ERROR: " + err.toString());
      totalFail++;
      try { if (doc) doc.close(SaveOptions.DONOTSAVECHANGES); } catch(e2) {}
    }
  }
  log("");
}

log("=== Done: " + totalOk + " OK, " + totalFail + " failed ===");
alert("Klaar! " + totalOk + " PSDs verwerkt, " + totalFail + " fouten.\nZie /tmp/embed-linked-log.txt voor details.");
