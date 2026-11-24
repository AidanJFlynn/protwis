import { SelectionActionButton } from "./selectionactionbutton.js";

/**
 * Sends the selected items to the sequence alignment workflow, through a conversion view that turns them into their
 * receptors. Subclasses set ID_FIELD, SUBTYPE (the selection subtype of each item) and CONVERT_URL.
 * Relies on the global ClearSelection and AddToSelection functions (browser_functions.js).
 */
class AlignSequencesButton extends SelectionActionButton {

    static SUBTYPE = null;
    static CONVERT_URL = null;

    constructor(tableManagerReference) {
        super(tableManagerReference, "Align sequences");
    }

    _onClick() {
        const { SUBTYPE, CONVERT_URL } = this.constructor;
        ClearSelection("targets");
        this.selectedIds().forEach((id) => AddToSelection("targets", SUBTYPE, id));
        window.location.href = CONVERT_URL;
    }
}

/**
 * Aligns the receptors of the selected experimental structures (checkbox data: pdb_code).
 */
class AlignStructureSequencesButton extends AlignSequencesButton {
    static ID_FIELD = "pdb_code";
    static SUBTYPE = "structure";
    static CONVERT_URL = "/structure/selection_convert";
}

/**
 * Aligns the receptors of the selected models (checkbox data: selection_id, "<entry name>_<state name>").
 */
class AlignModelSequencesButton extends AlignSequencesButton {
    static ID_FIELD = "selection_id";
    static SUBTYPE = "structure_model";
    static CONVERT_URL = "/structure/selection_convert_model";
}

export { AlignSequencesButton, AlignStructureSequencesButton, AlignModelSequencesButton };
