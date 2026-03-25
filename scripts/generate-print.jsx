#target illustrator

// ============================================================
// generate-print.jsx
//
// Headless Illustrator script for generating IB print PDFs.
// Called by the design-flow app via osascript.
//
// Reads job config from:   /tmp/print-job.json
// Writes result to:        /tmp/print-job-result.json
//
// Config format:
//   {
//     "psdPath":    "/path/to/520-350.psd",   // only used to read dimensions from filename
//     "designPath": "/path/to/design.jpg",    // design image to place
//     "outPath":    "/path/to/output.pdf",    // output PDF path (full path incl. filename)
//     "widthMM":    520,                      // product width in mm
//     "heightMM":   350                       // product height in mm
//   }
//
// The script:
//   1. Creates a new CMYK Illustrator document
//      artboard = (widthMM + 30mm) × (heightMM + 30mm)  [15mm bleed each side]
//   2. Places the design image on a "Design" layer, scales to cover artboard, embeds
//   3. Draws a vector rounded rectangle on a "CutContour" layer
//      - 15mm inset from artboard edges (= product edge)
//      - 5mm corner radius
//      - Stroke: "CutContour" spot color (0C 100M 0Y 0K), 0.25pt, overprint ON
//      - Fill: none
//   4. Exports PDF using "Grootformaat op 100% 05-2019" preset (or PDF/X-4 fallback)
//   5. Closes document without saving
//   6. Writes result JSON
//
// IMPORTANT: Do not change the CutContour spec, bleed, or PDF export settings.
// All settings in this script are production-critical.
// ============================================================

(function () {

    // ---- Constants — do not change ----
    var MM              = 2.834645669;   // points per mm
    var BLEED_MM        = 15;
    var CORNER_MM       = 5;
    var CONTOUR_STROKE  = 0.25;          // pt — standard hairline for cut contour
    var CUSTOM_PRESET   = "Grootformaat op 100% 05-2019";
    var FALLBACK_PRESET = "[PDF/X-4:2008]";
    var CONFIG_PATH     = "/tmp/print-job.json";
    var RESULT_PATH     = "/tmp/print-job-result.json";

    // ---- Read config ----
    var configFile = new File(CONFIG_PATH);
    if (!configFile.exists) {
        writeResult({ success: false, error: "Config file not found: " + CONFIG_PATH });
        return;
    }

    configFile.open("r");
    var configRaw = configFile.read();
    configFile.close();

    var config;
    try {
        config = eval("(" + configRaw + ")");
    } catch (parseErr) {
        writeResult({ success: false, error: "Could not parse config JSON: " + parseErr.message });
        return;
    }

    if (!config.designPath || !config.outPath || !config.widthMM || !config.heightMM) {
        writeResult({ success: false, error: "Config missing required fields (designPath, outPath, widthMM, heightMM)" });
        return;
    }

    var imgFile = new File(config.designPath);
    if (!imgFile.exists) {
        writeResult({ success: false, error: "Design image not found: " + config.designPath });
        return;
    }

    var outFile     = new File(config.outPath);
    var productW_mm = config.widthMM;
    var productH_mm = config.heightMM;

    // ---- Process ----
    var warnings = [];
    try {
        processOne(productW_mm, productH_mm, imgFile, outFile, warnings);
    } catch (e) {
        writeResult({ success: false, error: e.message + " (line " + e.line + ")" });
        return;
    }

    if (warnings.length > 0) {
        writeResult({ success: true, warnings: warnings });
    } else {
        writeResult({ success: true });
    }


    // ==============================================================
    // processOne — creates one AI document, places image,
    //              adds CutContour, exports PDF, closes.
    // ==============================================================
    function processOne(productW_mm, productH_mm, imgFile, outFile, warnings) {

        // Artboard = product + bleed on every side
        var artW_pt = (productW_mm + 2 * BLEED_MM) * MM;
        var artH_pt = (productH_mm + 2 * BLEED_MM) * MM;

        // ---- 1. Create document ----
        var preset           = new DocumentPreset();
        preset.width         = artW_pt;
        preset.height        = artH_pt;
        preset.units         = RulerUnits.Millimeters;
        preset.colorMode     = DocumentColorSpace.CMYK;
        preset.numArtboards  = 1;
        preset.title         = outFile.name;

        var doc = app.documents.addDocument("Print", preset);

        // Use document coordinate system (bottom-left origin, Y upward).
        app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

        try {
            // ---- 2. Create layers (bottom → top) ----
            // layers.add() inserts at front (top).
            // Create CutContour first so it ends up on top after we add Design.
            var cutLayer     = doc.layers.add();
            cutLayer.name    = "CutContour";

            var designLayer  = doc.layers.add();
            designLayer.name = "Design";
            designLayer.move(doc, ElementPlacement.PLACEATEND);

            // ---- 3. Place design image on Design layer ----
            doc.activeLayer = designLayer;

            var placed;
            try {
                placed = designLayer.placedItems.add();
                placed.file = imgFile;
            } catch (placeErr) {
                warnings.push("Could not place " + imgFile.name + ": " + placeErr.message);
                doc.close(SaveOptions.DONOTSAVECHANGES);
                return;
            }

            // Scale to COVER artboard proportionally
            var natW = placed.width;
            var natH = placed.height;
            if (natW <= 0) natW = 1;
            if (natH <= 0) natH = 1;

            var scaleX   = (artW_pt / natW) * 100;
            var scaleY   = (artH_pt / natH) * 100;
            var scalePct = Math.max(scaleX, scaleY);
            placed.resize(scalePct, scalePct);

            // Embed BEFORE reading final bounds
            try {
                placed.embed();
            } catch (embedErr) {
                warnings.push("Could not embed image (left as linked): " + embedErr.message);
            }

            // Center on artboard (document coords: origin bottom-left, Y upward)
            // geometricBounds = [top, left, bottom, right]
            var gb    = placed.geometricBounds;
            var itemW = gb[3] - gb[1];
            var itemH = gb[0] - gb[2];
            placed.position = [
                (artW_pt - itemW) / 2,
                (artH_pt + itemH) / 2
            ];

            // ---- 4. Create CutContour spot color ----
            var spot = getOrCreateSpot(doc, "CutContour", 0, 100, 0, 0);

            var spotColor      = new SpotColor();
            spotColor.spot     = spot;
            spotColor.tint     = 100;

            // ---- 5. Draw rounded rectangle on CutContour layer ----
            doc.activeLayer = cutLayer;

            var inset_pt  = BLEED_MM  * MM;
            var radius_pt = CORNER_MM * MM;

            // artboardRect = [left, top, right, bottom] in document coords
            var abRect  = doc.artboards[0].artboardRect;
            var abLeft  = abRect[0];
            var abTop   = abRect[1];
            var abRight = abRect[2];
            var abBot   = abRect[3];

            var rectTop    = abTop - inset_pt;
            var rectLeft   = abLeft + inset_pt;
            var rectWidth  = (abRight - abLeft) - 2 * inset_pt;
            var rectHeight = (abTop   - abBot)  - 2 * inset_pt;

            var cutPath = cutLayer.pathItems.roundedRectangle(
                rectTop, rectLeft, rectWidth, rectHeight,
                radius_pt, radius_pt
            );

            cutPath.filled          = false;
            cutPath.stroked         = true;
            cutPath.strokeColor     = spotColor;
            cutPath.strokeWidth     = CONTOUR_STROKE;
            cutPath.strokeOverprint = true;   // CRITICAL: do not knock out artwork below

            // ---- 6. Export as PDF ----
            savePDF(doc, outFile, warnings);

        } finally {
            try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
        }
    }


    // ==============================================================
    // savePDF — tries custom preset, falls back to PDF/X-4,
    //           then hardcoded Probo-compliant settings.
    // IMPORTANT: Do not change these settings — they are production-critical.
    // ==============================================================
    function savePDF(doc, destFile, warnings) {
        var opts             = new PDFSaveOptions();
        opts.viewAfterSaving     = false;
        opts.preserveEditability = false;   // no embedded .ai data — clean production file

        // Primary: Probo "Grootformaat op 100% 05-2019" preset
        opts.pDFPreset = CUSTOM_PRESET;
        try {
            doc.saveAs(destFile, opts);
            return;
        } catch (e) {
            // Preset not installed on this machine — fall back
        }

        // Fallback: PDF/X-4
        opts = new PDFSaveOptions();
        opts.viewAfterSaving     = false;
        opts.preserveEditability = false;

        var usedFallback = false;
        try {
            opts.pDFPreset = FALLBACK_PRESET;
            doc.saveAs(destFile, opts);
            usedFallback = true;
            warnings.push("Used fallback preset: " + FALLBACK_PRESET);
        } catch (e2) {}

        if (!usedFallback) {
            // Last resort: hardcoded Probo-compliant settings
            opts = buildSafePDFOptions();
            try {
                doc.saveAs(destFile, opts);
                warnings.push("Used hardcoded fallback PDF settings (Probo-compliant)");
            } catch (e3) {
                warnings.push("PDF save failed: " + e3.message);
            }
        }
    }


    // ==============================================================
    // buildSafePDFOptions — hardcoded fallback matching Probo
    //                       "Grootformaat op 100% 05-2019" spec.
    // IMPORTANT: Do not change — matches Probo grootformaat specification.
    // ==============================================================
    function buildSafePDFOptions() {
        var opts = new PDFSaveOptions();
        opts.compatibility                       = PDFCompatibility.ACROBAT7;
        opts.colorConversionID                   = ColorConversion.None;
        opts.colorDestinationID                  = ColorDestination.None;
        opts.colorProfileID                      = ColorProfile.EmbedProfile;
        opts.colorDownsamplingMethod             = DownsampleMethod.BICUBIC;
        opts.colorDownsampling                   = 150;
        opts.colorDownsamplingImageThreshold     = 225;
        opts.grayscaleDownsamplingMethod         = DownsampleMethod.BICUBIC;
        opts.grayscaleDownsampling               = 150;
        opts.grayscaleDownsamplingImageThreshold = 225;
        opts.monochromeDownsamplingMethod        = DownsampleMethod.BICUBIC;
        opts.monochromeDownsampling              = 150;
        opts.monochromeDownsamplingImageThreshold = 225;
        opts.compressArt                         = true;
        opts.generateThumbnails                  = false;
        opts.preserveEditability                 = false;
        opts.viewAfterSaving                     = false;
        return opts;
    }


    // ==============================================================
    // getOrCreateSpot — returns a Spot, creating it if needed
    // ==============================================================
    function getOrCreateSpot(doc, name, c, m, y, k) {
        for (var i = 0; i < doc.spots.length; i++) {
            if (doc.spots[i].name === name) return doc.spots[i];
        }
        var cmyk      = new CMYKColor();
        cmyk.cyan     = c;
        cmyk.magenta  = m;
        cmyk.yellow   = y;
        cmyk.black    = k;

        var spot       = doc.spots.add();
        spot.name      = name;
        spot.colorType = ColorModel.SPOT;
        spot.color     = cmyk;
        return spot;
    }


    // ==============================================================
    // writeResult — writes result JSON to /tmp/print-job-result.json
    // ==============================================================
    function writeResult(obj) {
        var f = new File(RESULT_PATH);
        f.open("w");
        f.write(JSON.stringify(obj));
        f.close();
    }

})();
