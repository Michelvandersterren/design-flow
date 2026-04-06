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
 *   "outPath":    "/tmp/mockup-out/filename.jpg",
 *   "language":   "nl" | "de" | "en" | "fr"        // optional — for infographic text swap
 * }
 *
 * Result schema:
 * { "success": true,  "outPath": "..." }
 * { "success": false, "error": "..." }
 *
 * Output is resized to 2000x2000 px, converted to sRGB, saved as JPEG quality 5
 * (same as the original scripts).
 *
 * --- Infographic text swap (render-time) ---
 *
 * Four PSD templates contain Dutch infographic text:
 *   - IB mockup-4.psd: "Duurzaam  vinyl" + "Beschermt tegen  krassen & vuil" + "Oprolbaar & compact" (rasterized, top-level)
 *   - IB mockup-5.psd: "Antislip-laag" (rasterized, inside group "Antislip-laag")
 *   - IB mockup-6.psd: "Oprolbaar & compact copy" + "Extra  werkruimte copy" (rasterized, top-level)
 *   - SP Mockup-5.psd: "Gemakkelijk schoon te maken" + "Warmte-, spat- en krasbestendig" (TEXT layers, inside group "text")
 *
 * When cfg.language is set and the PSD is one of these three, the script:
 *   1. Hides the original Dutch text layer(s)
 *   2. Creates temporary TEXT layer(s) with the translated text
 *   3. Exports the JPG
 *   4. Removes the temporary layers and re-shows the originals
 *   5. Closes WITHOUT saving — PSD remains untouched
 *
 * For "nl" or when language is not set, the original layers are left as-is.
 */

app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;
app.preferences.exportClipboard = false;

var CONFIG_PATH = "/tmp/mockup-job.json";
var RESULT_PATH = "/tmp/mockup-job-result.json";


// =============================================================================
// INFOGRAPHIC TEXT CONFIGURATION
// =============================================================================

/**
 * Translation map for all infographic labels.
 * \r is the line-break character in ExtendScript textItem.contents.
 */
var INFOGRAPHIC_MAP = {
  "mockup-5.psd": {
    labels: [
      {
        oldLayerName: "Antislip-laag",
        searchIn: "group",
        groupName: "Antislip-laag",
        color: "black",
        textPosition: "bottom",        // text at bottom of rasterized area
        textAreaFraction: 0.35,        // bottom 35% = text area
        textWidthMultiplier: 1.4,      // allow text 40% wider than layer bounds
        erasePadX: 30,
        erasePadY: 10,
        translations: {
          nl: "Antislip-laag",
          de: "Anti-Rutsch-Schicht",
          en: "Anti-slip layer",
          fr: "Couche antid\u00E9rapante"
        }
      }
    ]
  },
  "mockup-6.psd": {
    labels: [
      {
        oldLayerName: "Oprolbaar & compact copy",
        searchIn: "root",
        color: "white",
        textPosition: "top",           // text at top, dot+line at bottom
        textAreaFraction: 0.55,
        erasePadX: 30,
        erasePadY: 10,
        translations: {
          nl: "Oprolbaar &\rcompact",
          de: "Aufrollbar &\rkompakt",
          en: "Rollable &\rcompact",
          fr: "Enroulable &\rcompact"
        }
      },
      {
        oldLayerName: "Extra  werkruimte copy",
        searchIn: "root",
        color: "white",
        textPosition: "bottom",        // text at bottom, dot+line at top
        textAreaFraction: 0.55,
        erasePadX: 30,
        erasePadY: 10,
        translations: {
          nl: "Extra\rwerkruimte",
          de: "Zus\u00E4tzliche\rArbeitsfl\u00E4che",
          en: "Extra\rworkspace",
          fr: "Plan de travail\rsuppl\u00E9mentaire"
        }
      }
    ]
  },
  "mockup-4.psd": {
    labels: [
      {
        oldLayerName: "Duurzaam  vinyl",
        searchIn: "root",
        color: "black",
        textPosition: "bottom",        // icon at top, text at bottom
        textAreaFraction: 0.50,        // bottom 50% = text area
        textWidthMultiplier: 1.4,
        erasePadX: 30,
        erasePadY: 10,
        translations: {
          nl: "Duurzaam\rvinyl",
          de: "Strapazierf\u00E4higes\rVinyl",
          en: "Durable\rvinyl",
          fr: "Vinyle\rdurable"
        }
      },
      {
        oldLayerName: "Beschermt tegen  krassen & vuil",
        searchIn: "root",
        color: "black",
        textPosition: "bottom",
        textAreaFraction: 0.50,
        textWidthMultiplier: 1.4,
        erasePadX: 30,
        erasePadY: 10,
        clampToCanvas: true,
        clampMargin: 20,
        translations: {
          nl: "Beschermt tegen\rkrassen & vuil",
          de: "Sch\u00FCtzt vor\rKratzern & Schmutz",
          en: "Protects against\rscratches & dirt",
          fr: "Prot\u00E8ge contre les\rrayures & saletés"
        }
      },
      {
        oldLayerName: "Oprolbaar & compact",
        searchIn: "root",
        color: "black",
        textPosition: "bottom",
        textAreaFraction: 0.50,
        textWidthMultiplier: 1.4,
        erasePadX: 30,
        erasePadY: 10,
        translations: {
          nl: "Oprolbaar &\rcompact",
          de: "Aufrollbar &\rkompakt",
          en: "Rollable &\rcompact",
          fr: "Enroulable &\rcompact"
        }
      }
    ]
  },
  "Mockup-5.psd": {
    labels: [
      {
        oldLayerName: "Gemakkelijk schoon te maken",
        searchIn: "group",
        groupName: "text",
        isTextLayer: true,
        translations: {
          nl: "Gemakkelijk schoon\rte maken",
          de: "Leicht zu\rreinigen",
          en: "Easy to\rclean",
          fr: "Facile \u00E0\rnettoyer"
        }
      },
      {
        oldLayerName: "Warmte-, spat- en krasbestendig",
        searchIn: "group",
        groupName: "text",
        isTextLayer: true,
        clampToCanvas: true,
        clampMargin: 50,
        translations: {
          nl: "Warmte-, spat- en\rkrasbestendig",
          de: "Hitze-, spritz- und\rkratzbest\u00E4ndig",
          en: "Heat, splash and\rscratch resistant",
          fr: "R\u00E9sistant \u00E0 la chaleur,\raux \u00E9claboussures et rayures"
        }
      }
    ]
  }
};


// =============================================================================
// HELPERS
// =============================================================================

function writeResult(obj) {
  var f = new File(RESULT_PATH);
  f.open("w");
  f.encoding = "UTF-8";
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

/** Find an ArtLayer by name, recursively. */
function findArtLayerByName(container, name) {
  for (var i = 0; i < container.layers.length; i++) {
    var L = container.layers[i];
    if (L.typename === "ArtLayer" && L.name === name) return L;
    if (L.typename === "LayerSet") {
      var found = findArtLayerByName(L, name);
      if (found) return found;
    }
  }
  return null;
}

/** Find a LayerSet (group) by name at any depth. */
function findGroupByName(container, name) {
  for (var i = 0; i < container.layers.length; i++) {
    var L = container.layers[i];
    if (L.typename === "LayerSet" && L.name === name) return L;
    if (L.typename === "LayerSet") {
      var found = findGroupByName(L, name);
      if (found) return found;
    }
  }
  return null;
}

/** Get bounds as {left, top, right, bottom, width, height, cx, cy}. */
function getBounds(layer) {
  var b = layer.bounds;
  var left   = b[0].as("px");
  var top    = b[1].as("px");
  var right  = b[2].as("px");
  var bottom = b[3].as("px");
  return {
    left: left, top: top, right: right, bottom: bottom,
    width: right - left, height: bottom - top,
    cx: (left + right) / 2, cy: (top + bottom) / 2
  };
}

/**
 * Erase a rectangular area from a raster layer by selecting and deleting pixels.
 */
function eraseRect(doc, layer, x1, y1, x2, y2) {
  doc.activeLayer = layer;
  var selRegion = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  doc.selection.select(selRegion);
  doc.selection.clear();
  doc.selection.deselect();
}

/**
 * Fit text to a target width by reducing font size.
 * Returns the final font size used.
 */
function fitTextToWidth(textLayer, targetWidth, startSize, minSize) {
  var ti = textLayer.textItem;
  var currentSize = startSize;
  while (currentSize > minSize) {
    ti.size = UnitValue(currentSize, "pt");
    if (ti.contents.indexOf("\r") >= 0) {
      ti.leading = UnitValue(currentSize * 1.15, "pt");
    }
    var rendered = getBounds(textLayer);
    if (rendered.width <= targetWidth * 1.05) return currentSize;
    currentSize -= 2;
  }
  ti.size = UnitValue(minSize, "pt");
  if (ti.contents.indexOf("\r") >= 0) {
    ti.leading = UnitValue(minSize * 1.15, "pt");
  }
  return minSize;
}

/**
 * Open smart object, paste design image (scaled to cover + centered), save & close.
 */
function fillSmartObject(mainDoc, soLayer, designFilePath) {
  mainDoc.activeLayer = soLayer;
  executeAction(stringIDToTypeID("placedLayerEditContents"), undefined, DialogModes.NO);
  var soDoc = app.activeDocument;

  var imgDoc = app.open(new File(designFilePath));
  imgDoc.selection.selectAll();
  imgDoc.selection.copy();
  imgDoc.close(SaveOptions.DONOTSAVECHANGES);

  app.activeDocument = soDoc;
  soDoc.paste();
  var pasted = soDoc.activeLayer;

  var docW = soDoc.width.as("px");
  var docH = soDoc.height.as("px");
  var b = pasted.bounds;
  var lw = b[2].as("px") - b[0].as("px"); if (lw === 0) lw = 1;
  var lh = b[3].as("px") - b[1].as("px"); if (lh === 0) lh = 1;
  var scalePct = Math.max(docW / lw, docH / lh) * 100;
  pasted.resize(scalePct, scalePct, AnchorPosition.MIDDLECENTER);

  var b2 = pasted.bounds;
  var lw2 = b2[2].as("px") - b2[0].as("px");
  var lh2 = b2[3].as("px") - b2[1].as("px");
  var dx = (docW - lw2) / 2 - b2[0].as("px");
  var dy = (docH - lh2) / 2 - b2[1].as("px");
  pasted.translate(dx, dy);

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
  opts.quality = 5;
  opts.includeProfile = false;
  opts.interlaced = false;
  opts.optimized = true;

  doc.saveAs(new File(outPath), opts, true /* asCopy */, Extension.LOWERCASE);
}

/** Extract the filename from a full path. */
function getFilename(fullPath) {
  var parts = fullPath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1];
}


// =============================================================================
// INFOGRAPHIC TEXT SWAP — RENDER-TIME
// =============================================================================

/**
 * Apply infographic text swap for a non-NL language.
 *
 * For TEXT layers (SP Mockup-5): swaps contents, auto-fits width, shrinks for
 * height overflow, and clamps position to canvas bounds.
 *
 * For RASTERIZED layers (IB mockup-5/6): duplicates the layer, erases the text
 * area from the copy (keeping dot + leader line), hides the original, and
 * overlays a new text layer sized with fitTextToWidth.
 *
 * Returns an undo-state object so we can revert after export.
 */
function applyInfographicSwap(doc, psdFilename, language) {
  var mapEntry = INFOGRAPHIC_MAP[psdFilename];
  if (!mapEntry) return null;

  var undoState = {
    textLayerRestores: [],   // {layer, originalContents, originalSize, originalPosition}
    hiddenLayers: [],        // layers we hid (to re-show)
    createdLayers: []        // layers we created (to delete)
  };

  for (var i = 0; i < mapEntry.labels.length; i++) {
    var labelDef = mapEntry.labels[i];
    var translatedText = labelDef.translations[language];
    if (!translatedText) continue;

    var oldLayer = findArtLayerByName(doc, labelDef.oldLayerName);
    if (!oldLayer) continue;

    // ----- SP Mockup-5: real TEXT layers -----
    if (labelDef.isTextLayer) {
      var origContents = oldLayer.textItem.contents;
      var origSize;
      try { origSize = oldLayer.textItem.size.as("pt"); } catch (e) { origSize = 135; }
      var origPos;
      try {
        var pp = oldLayer.textItem.position;
        origPos = [pp[0].as("px"), pp[1].as("px")];
      } catch (e) { origPos = null; }

      undoState.textLayerRestores.push({
        layer: oldLayer,
        originalContents: origContents,
        originalSize: origSize,
        originalPosition: origPos
      });

      oldLayer.textItem.contents = translatedText;

      // Auto-fit width
      var renderedBounds = getBounds(oldLayer);
      var maxWidth = doc.width.as("px") * 0.40;
      if (renderedBounds.width > maxWidth) {
        fitTextToWidth(oldLayer, maxWidth, origSize, 60);
      }

      // Clamp to canvas
      if (labelDef.clampToCanvas) {
        var canvasW = doc.width.as("px");
        var canvasH = doc.height.as("px");
        var margin = labelDef.clampMargin || 20;

        // Height-based font shrink: if text extends past canvas bottom
        var clampBounds = getBounds(oldLayer);
        var availableHeight = canvasH - margin - clampBounds.top;
        if (clampBounds.height > availableHeight && availableHeight > 0) {
          var curSize;
          try { curSize = oldLayer.textItem.size.as("pt"); } catch (e) { curSize = 135; }
          var shrunkSize = curSize;
          while (shrunkSize > 60) {
            shrunkSize -= 2;
            oldLayer.textItem.size = UnitValue(shrunkSize, "pt");
            if (oldLayer.textItem.contents.indexOf("\r") >= 0) {
              oldLayer.textItem.leading = UnitValue(shrunkSize * 1.15, "pt");
            }
            var shrunkBounds = getBounds(oldLayer);
            if (shrunkBounds.height <= canvasH - margin - shrunkBounds.top) break;
          }
        }

        // Positional clamp as fallback
        clampBounds = getBounds(oldLayer);
        var clampDx = 0;
        var clampDy = 0;
        if (clampBounds.left < margin) clampDx = margin - clampBounds.left;
        if (clampBounds.bottom > canvasH - margin) clampDy = (canvasH - margin) - clampBounds.bottom;
        if (clampBounds.right > canvasW - margin) clampDx = (canvasW - margin) - clampBounds.right;
        if (clampBounds.top < margin) clampDy = margin - clampBounds.top;
        if (clampDx !== 0 || clampDy !== 0) oldLayer.translate(clampDx, clampDy);
      }

      continue;
    }

    // ----- IB mockup-5/6: RASTERIZED layers -----
    // Duplicate layer, erase text area from copy (keeps dot + leader line),
    // hide original, overlay new text layer.

    var oldBounds = getBounds(oldLayer);

    // Determine text area within the rasterized bounds
    var textAreaTop, textAreaBottom;
    if (labelDef.textPosition === "bottom") {
      textAreaTop = oldBounds.top + oldBounds.height * (1 - labelDef.textAreaFraction);
      textAreaBottom = oldBounds.bottom;
    } else {
      textAreaTop = oldBounds.top;
      textAreaBottom = oldBounds.top + oldBounds.height * labelDef.textAreaFraction;
    }
    var textAreaCX = oldBounds.cx;
    var textAreaWidth = oldBounds.width * (labelDef.textWidthMultiplier || 1.0);
    var textAreaHeight = textAreaBottom - textAreaTop;

    // 1. Duplicate the original layer
    var dupLayer = oldLayer.duplicate();
    dupLayer.name = "__infographic_dup_" + i;

    // 2. Erase the text area from the duplicate
    var epx = labelDef.erasePadX || 30;
    var epy = labelDef.erasePadY || 10;
    eraseRect(doc, dupLayer,
      oldBounds.left - epx, textAreaTop - epy,
      oldBounds.right + epx, textAreaBottom + epy
    );

    // 3. Hide the original
    oldLayer.visible = false;
    undoState.hiddenLayers.push(oldLayer);
    undoState.createdLayers.push(dupLayer);

    // 4. Create new text layer
    var textColor = new SolidColor();
    if (labelDef.color === "white") {
      textColor.rgb.red = 255; textColor.rgb.green = 255; textColor.rgb.blue = 255;
    } else {
      textColor.rgb.red = 0; textColor.rgb.green = 0; textColor.rgb.blue = 0;
    }

    var newLayer = doc.artLayers.add();
    newLayer.kind = LayerKind.TEXT;
    newLayer.name = "__infographic_txt_" + i;

    var ti = newLayer.textItem;
    ti.kind = TextType.POINTTEXT;
    ti.contents = translatedText;
    ti.justification = Justification.CENTER;
    ti.color = textColor;
    ti.antiAliasMethod = AntiAlias.SMOOTH;
    try { ti.font = "Arial-BoldMT"; } catch (e) {
      try { ti.font = "ArialMT"; } catch (e2) {}
    }

    // Position text initially at center of text area
    ti.position = [UnitValue(textAreaCX, "px"), UnitValue(textAreaTop, "px")];

    // Fit the text to the available width
    var startFontSize = (psdFilename === "mockup-5.psd") ? 100
                     : (psdFilename === "mockup-4.psd") ? 120
                     : 180;
    fitTextToWidth(newLayer, textAreaWidth, startFontSize, 30);

    // Re-center after fitting
    var finalBounds = getBounds(newLayer);
    var targetCX = textAreaCX;
    var targetCY = textAreaTop + textAreaHeight / 2;
    var dx = targetCX - finalBounds.cx;
    var dy = targetCY - finalBounds.cy;
    newLayer.translate(dx, dy);

    // Clamp rasterized text to canvas if configured
    if (labelDef.clampToCanvas) {
      var canvasW = doc.width.as("px");
      var canvasH = doc.height.as("px");
      var margin = labelDef.clampMargin || 20;
      var clampB = getBounds(newLayer);
      var clampDx = 0;
      var clampDy = 0;
      if (clampB.left < margin) clampDx = margin - clampB.left;
      if (clampB.right > canvasW - margin) clampDx = (canvasW - margin) - clampB.right;
      if (clampB.top < margin) clampDy = margin - clampB.top;
      if (clampB.bottom > canvasH - margin) clampDy = (canvasH - margin) - clampB.bottom;
      if (clampDx !== 0 || clampDy !== 0) newLayer.translate(clampDx, clampDy);
    }

    // Move to top of layer stack
    try { newLayer.move(doc.layers[0], ElementPlacement.PLACEBEFORE); } catch (e) {}

    undoState.createdLayers.push(newLayer);
  }

  return undoState;
}

/**
 * Revert all infographic changes — restore original state.
 */
function revertInfographicSwap(undoState) {
  if (!undoState) return;

  // Delete temporary layers
  for (var i = 0; i < undoState.createdLayers.length; i++) {
    try { undoState.createdLayers[i].remove(); } catch (e) {}
  }

  // Re-show hidden layers
  for (var j = 0; j < undoState.hiddenLayers.length; j++) {
    try { undoState.hiddenLayers[j].visible = true; } catch (e) {}
  }

  // Restore original text contents, size, and position
  for (var k = 0; k < undoState.textLayerRestores.length; k++) {
    var restore = undoState.textLayerRestores[k];
    try {
      restore.layer.textItem.contents = restore.originalContents;
      if (restore.originalSize) {
        restore.layer.textItem.size = UnitValue(restore.originalSize, "pt");
      }
      if (restore.originalPosition) {
        restore.layer.textItem.position = [
          UnitValue(restore.originalPosition[0], "px"),
          UnitValue(restore.originalPosition[1], "px")
        ];
      }
    } catch (e) {}
  }
}


// =============================================================================
// MAIN
// =============================================================================

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
          var filled = 0;
          var skipped = 0;
          for (var s = 0; s < smartLayers.length; s++) {
            try {
              fillSmartObject(doc, smartLayers[s], cfg.designPath);
              filled++;
            } catch (soErr) {
              skipped++;
              app.activeDocument = doc;
            }
          }

          if (filled === 0) {
            doc.close(SaveOptions.DONOTSAVECHANGES);
            writeResult({ success: false, error: "Could not fill any smart object in: " + cfg.psdPath });
          } else {
            // --- INFOGRAPHIC TEXT SWAP ---
            // Apply text swap AFTER smart objects are filled but BEFORE saving JPG.
            // For NL or no language: skip (use original Dutch text as-is).
            var infographicUndo = null;
            var psdFilename = getFilename(cfg.psdPath);
            var lang = cfg.language || "nl";

            if (lang !== "nl" && INFOGRAPHIC_MAP[psdFilename]) {
              infographicUndo = applyInfographicSwap(doc, psdFilename, lang);
            }

            // Ensure output dir exists
            var outFile = new File(cfg.outPath);
            if (!outFile.parent.exists) outFile.parent.create();

            saveJPG(doc, cfg.outPath);

            // --- REVERT infographic swap ---
            if (infographicUndo) {
              revertInfographicSwap(infographicUndo);
            }

            // Clean up smart objects
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
