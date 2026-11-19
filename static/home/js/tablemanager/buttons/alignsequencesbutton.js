import { SelectionActionButton } from "./selectionactionbutton.js";

/**
 * Sends the selected structures to the sequence alignment workflow.
 * Relies on the global ClearSelection and AddToSelection functions (browser_functions.js).
 */
class AlignSequencesButton extends SelectionActionButton {

    constructor(tableManagerReference) {
        super(tableManagerReference, "Align sequences");
    }

    _onClick() {
        ClearSelection("targets");
        this.selectedPdbCodes().forEach((pdbCode) => AddToSelection("targets", "structure", pdbCode));
        window.location.href = "/structure/selection_convert";
    }
}

export { AlignSequencesButton };
