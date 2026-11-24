import { SelectionActionButton } from "./selectionactionbutton.js";

/**
 * Downloads the selected items. Subclasses set TEXT (the button label), MAX (the most items per download, or null for
 * no limit) and implement _download.
 * Relies on the global showAlert function (gpcrdb.js).
 */
class DownloadSelectedButton extends SelectionActionButton {

    static TEXT = "Download";
    static MAX = null;

    constructor(tableManagerReference) {
        // new.target.TEXT reads the static TEXT property of whichever child class was actually instantiated with new
        super(tableManagerReference, new.target.TEXT);
    }

    _onClick() {
        const max = this.constructor.MAX;
        const items = this.selectedItems();
        if (max && items.length > max) {
            showAlert(`Maximum number of selected entries is ${max}`, "warning");
            return;
        }
        this._download(items);
    }

    /**
     * Starts the download, implemented by subclasses.
     * @param {Object[]} items - Checkbox data of the selected items.
     */
    _download(items) {
        throw new Error("_download must be implemented by the button class");
    }
}

/**
 * Downloads the PDB files of the selected experimental structures (checkbox data: pdb_code).
 * Relies on the global ClearSelection and AddToSelection functions (browser_functions.js).
 */
class DownloadStructuresButton extends DownloadSelectedButton {

    static ID_FIELD = "pdb_code";
    static TEXT = "Download PDBs";
    static MAX = 100;

    _download() {
        ClearSelection("targets");
        AddToSelection("targets", "structure_many", this.selectedIds().join(","));
        window.location.href = "/structure/pdb_download";
    }
}

/**
 * Downloads the selected models as a zip (checkbox data: model_id, the StructureModel primary key).
 */
class DownloadModelsButton extends DownloadSelectedButton {

    static TEXT = "Download models";

    _download(items) {
        window.location.href = "/structure/hommod_download?ids=" + items.map((item) => item.model_id).join(",");
    }
}

export { DownloadSelectedButton, DownloadStructuresButton, DownloadModelsButton };
