import { SelectionActionButton } from "./selectionactionbutton.js";

/**
 * Sends the selected structures to the PDB download workflow.
 * Relies on the global ClearSelection, AddToSelection and showAlert functions (browser_functions.js, gpcrdb.js).
 */
class DownloadPdbsButton extends SelectionActionButton {

    static MAX_DOWNLOAD = 100;

    constructor(tableManagerReference) {
        super(tableManagerReference, "Download PDBs");
    }

    _onClick() {
        const pdbCodes = this.selectedPdbCodes();
        if (pdbCodes.length > DownloadPdbsButton.MAX_DOWNLOAD) {
            showAlert(`Maximum number of selected entries is ${DownloadPdbsButton.MAX_DOWNLOAD}`, "warning");
            return;
        }
        ClearSelection("targets");
        AddToSelection("targets", "structure_many", pdbCodes.join(","));
        window.location.href = "/structure/pdb_download";
    }
}

export { DownloadPdbsButton };
