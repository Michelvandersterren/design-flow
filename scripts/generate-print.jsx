#target illustrator

// ============================================================
// generate-print.jsx  (batch mode)
//
// Reads:   /tmp/print-batch-job.json
//   { jobs: [ { sizeKey, designPath, outPath, widthMM, heightMM }, ... ] }
//
// Processes each job in sequence (one Illustrator session).
// Writes per-job PDF to job.outPath.
// Writes /tmp/print-batch-result.json only on fatal error.
//
// Per job:
//   1. New CMYK document, artboard = (W+30) × (H+30) mm  (15mm bleed)
//   2. Design layer: image placed, scaled to cover, embedded
//   3. CutContour layer: rounded rect, 15mm inset, 5mm radius,
//      spot color "CutContour" (0C 100M 0Y 0K), 0.25pt stroke, overprint ON
//   4. PDF export via "Grootformaat op 100% 05-2019" preset
//      → fallback [PDF/X-4:2008] → hardcoded Probo spec
//   5. Close without saving
//
// IMPORTANT: Do not change CutContour spec, bleed, or PDF settings.
// ============================================================

(function () {

    var MM             = 2.834645669;   // points per mm
    var BLEED_MM       = 15;
    var CORNER_MM      = 5;
    var STROKE_PT      = 0.25;
    var PRESET_MAIN    = "Grootformaat op 100% 05-2019";
    var PRESET_FALLBACK = "[PDF/X-4:2008]";
    var CONFIG_PATH    = "/tmp/print-batch-job.json";
    var RESULT_PATH    = "/tmp/print-batch-result.json";

    // ---- Read batch config ----
    var configFile = new File(CONFIG_PATH);
    if (!configFile.exists) {
        writeResult({ success: false, error: "Batch config not found: " + CONFIG_PATH });
        return;
    }

    configFile.open("r");
    var configRaw = configFile.read();
    configFile.close();

    var config;
    try {
        config = eval("(" + configRaw + ")");
    } catch (e) {
        writeResult({ success: false, error: "Cannot parse batch config: " + e.message });
        return;
    }

    if (!config.jobs || config.jobs.length === 0) {
        writeResult({ success: false, error: "No jobs in batch config" });
        return;
    }

    // ---- Process each job ----
    var errors = [];
    for (var i = 0; i < config.jobs.length; i++) {
        var job = config.jobs[i];
        try {
            processJob(job);
        } catch (e) {
            errors.push(job.sizeKey + ": " + e.message);
        }
    }

    // Only write result file if there were errors (success is inferred from PDF existence)
    if (errors.length > 0) {
        writeResult({ success: false, error: errors.join("; ") });
    }


    // ==============================================================
    // processJob — creates one document, places image, adds
    //              CutContour, exports PDF, closes.
    // ==============================================================
    function processJob(job) {
        if (!job.designPath || !job.outPath || !job.widthMM || !job.heightMM) {
            throw new Error("Missing required fields in job");
        }

        var imgFile = new File(job.designPath);
        if (!imgFile.exists) {
            throw new Error("Design image not found: " + job.designPath);
        }

        var outFile  = new File(job.outPath);
        var artW_pt  = (job.widthMM  + 2 * BLEED_MM) * MM;
        var artH_pt  = (job.heightMM + 2 * BLEED_MM) * MM;

        // ---- Create document ----
        var preset          = new DocumentPreset();
        preset.width        = artW_pt;
        preset.height       = artH_pt;
        preset.units        = RulerUnits.Millimeters;
        preset.colorMode    = DocumentColorSpace.CMYK;
        preset.numArtboards = 1;
        preset.title        = outFile.name;

        var doc = app.documents.addDocument("Print", preset);
        app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

        try {
            // ---- Layers: CutContour on top, Design at bottom ----
            var cutLayer    = doc.layers.add();
            cutLayer.name   = "CutContour";

            var designLayer = doc.layers.add();
            designLayer.name = "Design";
            designLayer.move(doc, ElementPlacement.PLACEATEND);

            // ---- Place design image ----
            doc.activeLayer = designLayer;

            var placed;
            try {
                placed = designLayer.placedItems.add();
                placed.file = imgFile;
            } catch (e) {
                throw new Error("Cannot place image: " + e.message);
            }

            // Scale to cover artboard
            var natW   = placed.width  || 1;
            var natH   = placed.height || 1;
            var scaleX = (artW_pt / natW) * 100;
            var scaleY = (artH_pt / natH) * 100;
            placed.resize(Math.max(scaleX, scaleY), Math.max(scaleX, scaleY));

            // Embed
            try { placed.embed(); } catch (e) { /* leave as linked */ }

            // Center
            var gb    = placed.geometricBounds; // [top, left, bottom, right]
            var itemW = gb[3] - gb[1];
            var itemH = gb[0] - gb[2];
            placed.position = [(artW_pt - itemW) / 2, (artH_pt + itemH) / 2];

            // ---- CutContour spot color ----
            var spot      = getOrCreateSpot(doc, "CutContour", 0, 100, 0, 0);
            var spotColor = new SpotColor();
            spotColor.spot = spot;
            spotColor.tint = 100;

            // ---- Draw rounded rect on CutContour layer ----
            doc.activeLayer = cutLayer;

            var inset_pt  = BLEED_MM  * MM;
            var radius_pt = CORNER_MM * MM;
            var ab        = doc.artboards[0].artboardRect; // [left, top, right, bottom]

            var rTop    = ab[1] - inset_pt;
            var rLeft   = ab[0] + inset_pt;
            var rWidth  = (ab[2] - ab[0]) - 2 * inset_pt;
            var rHeight = (ab[1] - ab[3]) - 2 * inset_pt;

            var cutPath = cutLayer.pathItems.roundedRectangle(
                rTop, rLeft, rWidth, rHeight, radius_pt, radius_pt
            );

            cutPath.filled          = false;
            cutPath.stroked         = true;
            cutPath.strokeColor     = spotColor;
            cutPath.strokeWidth     = STROKE_PT;
            cutPath.strokeOverprint = true;  // CRITICAL

            // ---- Export PDF ----
            savePDF(doc, outFile);

        } finally {
            try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}
        }
    }


    // ==============================================================
    // savePDF
    // ==============================================================
    function savePDF(doc, destFile) {
        // Try custom Probo preset first
        var opts = new PDFSaveOptions();
        opts.viewAfterSaving     = false;
        opts.preserveEditability = false;
        opts.pDFPreset           = PRESET_MAIN;
        try {
            doc.saveAs(destFile, opts);
            return;
        } catch (e) { /* preset not installed */ }

        // Fallback: PDF/X-4
        opts = new PDFSaveOptions();
        opts.viewAfterSaving     = false;
        opts.preserveEditability = false;
        opts.pDFPreset           = PRESET_FALLBACK;
        try {
            doc.saveAs(destFile, opts);
            return;
        } catch (e) { /* also not available */ }

        // Last resort: hardcoded Probo-compliant settings
        opts = new PDFSaveOptions();
        opts.compatibility                        = PDFCompatibility.ACROBAT7;
        opts.colorConversionID                    = ColorConversion.None;
        opts.colorDestinationID                   = ColorDestination.None;
        opts.colorProfileID                       = ColorProfile.EmbedProfile;
        opts.colorDownsamplingMethod              = DownsampleMethod.BICUBIC;
        opts.colorDownsampling                    = 150;
        opts.colorDownsamplingImageThreshold      = 225;
        opts.grayscaleDownsamplingMethod          = DownsampleMethod.BICUBIC;
        opts.grayscaleDownsampling                = 150;
        opts.grayscaleDownsamplingImageThreshold  = 225;
        opts.monochromeDownsamplingMethod         = DownsampleMethod.BICUBIC;
        opts.monochromeDownsampling               = 150;
        opts.monochromeDownsamplingImageThreshold = 225;
        opts.compressArt                          = true;
        opts.generateThumbnails                   = false;
        opts.preserveEditability                  = false;
        opts.viewAfterSaving                      = false;
        doc.saveAs(destFile, opts);
    }


    // ==============================================================
    // getOrCreateSpot
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
    // writeResult — only called on fatal/batch-level errors
    // ==============================================================
    function writeResult(obj) {
        var f = new File(RESULT_PATH);
        f.open("w");
        f.write(JSON.stringify(obj));
        f.close();
    }

})();
