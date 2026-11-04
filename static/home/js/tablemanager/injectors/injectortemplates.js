class InjectorTemplates {

    static addInfoIconLink(cellElementArray, href, tooltipText="") {
        let anchor = document.createElement('a');
        anchor.href = href;
        anchor.target = "_blank";

        let span = document.createElement('span');
        span.className = "glyphicon glyphicon-info-sign";
        
        anchor.appendChild(span);
        anchor.title = tooltipText;

        cellElementArray.push(anchor);
        
        return cellElementArray;
    }

    static addChemicalStructureImagePopOver(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference, configuration) {
        
        const noImageUrl = configuration.noImageUrl
        const ligand_smiles_json_id = configuration.ligand_smiles_json_id 
        const ligand_sequence_json_id = configuration.ligand_sequence_json_id 
        const ligand_type_json_id = configuration.ligand_type_json_id 
        const ligand_image_url_json_id = configuration.ligand_image_url_json_id 

        if (ligand_smiles_json_id === undefined || ligand_sequence_json_id === undefined || ligand_type_json_id === undefined) {
            console.error("Missing required configuration keys for structure popover injector. Please provide ligand_smiles_json_id, ligand_sequence_json_id, and ligand_type_json_id.");
            return;
        }

        if (!noImageUrl) {
            console.error("No image URL provided for missing structure.");
            return;
        }

        if (typeof PeptideLayoutEngine === undefined) {
            console.error("PeptideLayoutEngine is not defined. Please ensure that PeptideLayoutEngine.js is loaded.");
            return;
        }

        if (typeof OCL === undefined) {
            console.error("OCL is not defined. Please ensure that openchemlib-full.js is loaded.");
            return;
        }

        [ligand_smiles_json_id, ligand_sequence_json_id, ligand_type_json_id].forEach((key) => {
            if (!(key in rowData)) {
                console.warn(`AJAX data has no key ${key} for data.`);
            }
        })

        const smiles = rowData[ligand_smiles_json_id] 
        const ligandType = rowData[ligand_type_json_id] 
        const sequence = rowData[ligand_sequence_json_id]
        const imageUrl = rowData[ligand_image_url_json_id];        
        
        const xOffset = 30, yOffset = -10; // Original yOffset makes it appear slightly above cursor line.

        function isStandardPeptideSequence(seqStr) {
            if (!seqStr) return false;
            return /^[ABCDEFGHIKLMNOPQRSTUVWXYZ\s]+$/i.test(seqStr);
        }

        function calculateAndSetPosition(e, $tooltip) {
            if (!$tooltip || !$tooltip.length) return;

            const tooltipWidth = $tooltip.outerWidth();
            const tooltipHeight = $tooltip.outerHeight();
            const windowWidth = $(window).width();
            const windowHeight = $(window).height();
            // e.pageX/pageY are document coordinates.
            // e.clientX/clientY are viewport coordinates.

            let newLeft = e.pageX + xOffset;
            // Original logic for yOffset: e.pageY - yOffset means e.pageY - (-10) = e.pageY + 10
            // So the top of the tooltip is 10px BELOW the mouse y-coordinate.
            let newTop = e.pageY - yOffset;

            // Check right boundary (using clientX for viewport-relative check)
            if (e.clientX + xOffset + tooltipWidth > windowWidth) {
                newLeft = e.pageX - tooltipWidth - xOffset; // Place to the left of cursor
            }

            // Check bottom boundary (using clientY for viewport-relative check)
            // e.clientY - yOffset + tooltipHeight: e.clientY - (-10) + tooltipHeight = e.clientY + 10 + tooltipHeight
            if (e.clientY - yOffset + tooltipHeight > windowHeight) {
                // Place above the cursor.
                // newTop becomes: e.pageY (cursor) + yOffset (push up by 10) - tooltipHeight
                newTop = e.pageY + yOffset - tooltipHeight;
            }

            // Prevent tooltip from going off the top or left of the document after adjustments
            // (though less likely with this logic, good for robustness)
            if (newLeft < $(window).scrollLeft()) {
                newLeft = $(window).scrollLeft();
            }
            if (newTop < $(window).scrollTop()) {
                newTop = $(window).scrollTop();
            }

            $tooltip.css({ top: newTop + "px", left: newLeft + "px" });
        }

        function mouseEnterHandler(e) {
            let tooltipHtml = "";

            const pictureSource = smiles ? "Generate_from_SMILES" : imageUrl ? imageUrl : "Not_available";

            if (ligandType === 'peptide') {
                if (isStandardPeptideSequence(sequence) && typeof PeptideLayoutEngine !== 'undefined') {
                    try {
                        const peptideDrawer = new PeptideLayoutEngine({
                            residueRadius: 16, overlapAmount: 6, padding: 10,
                            fontSize: 12, residuesPerRow: 10, maxLength: 50,
                            rowSpacingFactor: 1.5
                        });
                        const cleanedSequence = sequence.replace(/\s+/g, '').toUpperCase();
                        if (cleanedSequence) {
                            const svgElement = peptideDrawer.generateSvgElement(cleanedSequence);
                            if (svgElement) {
                                tooltipHtml = svgElement.outerHTML;
                            } else {
                                console.warn("PeptideLayoutEngine.generateSvgElement returned null for sequence:", cleanedSequence);
                                tooltipHtml = `<img style="max-width: 200px; height: auto" src="${noImageUrl}" alt="Preview not available" />`;
                            }
                        } else {
                            console.warn("Peptide sequence became empty after cleaning:", sequence);
                            tooltipHtml = `<img style="max-width: 200px; height: auto" src="${noImageUrl}" alt="Preview not available" />`;
                        }
                    } catch(err) {
                        console.error("PeptideLayoutEngine error in tooltip:", err, "Original sequence:", sequence);
                        tooltipHtml = `<img style="max-width: 200px; height: auto" src="${noImageUrl}" alt="Preview not available" />`;
                    }
                } else {
                    // Fallback for non-standard peptide or missing engine
                    if (sequence && !isStandardPeptideSequence(sequence)) {
                        console.log("Tooltip: Peptide sequence non-standard, falling back. Sequence:", sequence);
                    } else if (!sequence) {
                        console.log("Tooltip: Peptide sequence data attribute is missing or empty.");
                    } else if (typeof PeptideLayoutEngine === 'undefined') {
                        console.warn("Tooltip: PeptideLayoutEngine library not found for peptide rendering.");
                    }
                    tooltipHtml = `<img style="max-width: 200px; height: auto" src="${noImageUrl}" alt="Preview not available" />`;
                }
            } else { // Not 'peptide', so treat as small molecule or other
                if (pictureSource === "Generate_from_SMILES" && smiles && typeof OCL !== 'undefined') {
                    // Explicit request to generate from SMILES (similar to v2.0's primary SMILES condition)
                    try {
                        let mol = OCL.Molecule.fromSmiles(smiles);
                        mol.inventCoordinates();
                        const svgSize = 200;
                        const svgOptions = {
                            autoCrop: true, noStereoProblem: true,
                            suppressChiralText: true, suppressCIPParity: true, suppressESR: true,
                        };
                        tooltipHtml = mol.toSVG(svgSize, svgSize, null, svgOptions);
                    } catch (err) {
                        console.error("OCL error in tooltip (explicit SMILES gen):", err, "SMILES:", smiles);
                        tooltipHtml = `<img style="max-width: 200px; height: auto" src="${noImageUrl}" alt="Preview not available" />`; // Changed from "Invalid SMILES" div to image
                    }
                } else if (pictureSource && pictureSource !== "Not_available" && pictureSource !== "Generate_from_SMILES") {
                    // If pictureSource is a valid image URL (not "Generate_from_SMILES" or "Not_available")
                    tooltipHtml = `<img style="max-width: 200px; height: auto" src="${pictureSource}" alt="Ligand preview" />`;
                } else {
                    // Final fallback:
                    // This will be hit if:
                    // 1. pictureSource was "Not_available"
                    // 2. pictureSource was undefined (neither data-picture nor rel was set)
                    // 3. pictureSource was "Generate_from_SMILES" but SMILES was missing or OCL was undefined.
                    if (smiles && pictureSource === "Generate_from_SMILES" && typeof OCL === 'undefined') {
                        console.warn("Tooltip: SMILES present and Generate_from_SMILES requested, but OCL library not found.");
                    } else if (smiles && pictureSource === "Generate_from_SMILES" && !smiles) {
                        console.warn("Tooltip: Generate_from_SMILES requested, but no SMILES data found.");
                    }
                    tooltipHtml = `<img style="max-width: 200px; height: auto" src="${noImageUrl}" alt="Preview not available" />`;
                }
            }

            // Create the tooltip, but don't show it yet
            let tooltip = document.createElement("p");
            tooltip.classList.add("tooltip-struct");
            tooltip.innerHTML = tooltipHtml;
            document.body.append(tooltip);
            const $tooltipInstance = $(".tooltip-struct");

            // Calculate position (this function now handles viewport collision)
            // Note: For accurate dimensions, the tooltip must be in the DOM.
            // If its content is dynamic and affects size significantly, you might need to
            // make it visible but off-screen (e.g., left: -9999px) to measure, then position.
            // However, with max-width:200px on images, current approach should be mostly fine.
            calculateAndSetPosition(e, $tooltipInstance);

            $tooltipInstance.fadeIn("fast");

        }
        
        const mouseLeaveHandler = function(e) {
            document.querySelector(".tooltip-struct").remove();
        }

        
        const mouseMoveHandler = function(e) {
            // Update position on mouse move, also handling viewport collision
            calculateAndSetPosition(e, $(".tooltip-struct"));
        };

        // Attach event listeners to the cell
        cell.addEventListener('mouseenter', mouseEnterHandler)
        cell.addEventListener('mouseleave', mouseLeaveHandler)
        cell.addEventListener('mousemove', mouseMoveHandler);

    }
}

export { InjectorTemplates }