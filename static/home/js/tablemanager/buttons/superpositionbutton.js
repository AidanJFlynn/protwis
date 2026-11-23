import { SelectionActionButton } from "./selectionactionbutton.js";

/**
 * Sends the selected items to the superposition workflow.
 *
 * The superposition workflow can return to the table to pick its reference or targets, signalled by the URL hash
 * (#keepselectionreference / #keepselectiontargets); the button then adds the selection to that part of the workflow.
 * Otherwise it opens a modal listing the selected items, where clicking one makes it the reference and the
 * others the targets. The modal is built on each click from MODAL_COLUMNS, headed by the table's column titles;
 * the page only needs to load modal.css for its styling.
 *
 * Subclasses set ID_FIELD, REFERENCE_SUBTYPE and TARGETS_SUBTYPE (the selection subtypes the workflow expects),
 * MODAL_COLUMNS and NOUN (the plural name of the items, used in the modal).
 *
 * Relies on the global ClearSelection, AddToSelection and showAlert functions (browser_functions.js, gpcrdb.js).
 */
class SuperpositionButton extends SelectionActionButton {

    static MAX_SUPERPOSE = 50;
    static WORKFLOW_URL = "/structure/superposition_workflow_index#keepselection";
    static MODAL_ID = "tablemanager-superposition-modal";

    static REFERENCE_SUBTYPE = null;
    static TARGETS_SUBTYPE = null;
    // json ids of the modal's columns, after its checkbox column
    static MODAL_COLUMNS = [];
    static NOUN = "items";

    mode

    constructor(tableManagerReference) {
        const hash = window.location.hash;
        const mode = hash === "#keepselectionreference" ? "reference"
                   : hash === "#keepselectiontargets" ? "targets"
                   : "default";
        const text = mode === "reference" ? "Add reference to superposition"
                   : mode === "targets" ? "Add targets to superposition"
                   : "Superposition";
        super(tableManagerReference, text);
        this.mode = mode;
    }

    _onClick() {
        const ids = this.selectedIds();
        const { REFERENCE_SUBTYPE: referenceSubtype, TARGETS_SUBTYPE: targetsSubtype } = this.constructor;
        if (ids.length > SuperpositionButton.MAX_SUPERPOSE) {
            showAlert(`Maximum number of selected entries is ${SuperpositionButton.MAX_SUPERPOSE}`, "warning");
            return;
        }

        if (this.mode === "reference") {
            if (ids.length !== 1) {
                showAlert("Please select exactly one entry as reference", "danger");
                return;
            }
            AddToSelection("reference", referenceSubtype, ids[0]);
            window.location.href = SuperpositionButton.WORKFLOW_URL;
        } else if (this.mode === "targets") {
            AddToSelection("targets", targetsSubtype, ids.join(","));
            window.location.href = SuperpositionButton.WORKFLOW_URL;
        } else {
            this._openModal();
        }
    }

    /**
     * Lists the selected items; clicking one makes it the reference and the others the targets.
     */
    async _openModal() {
        const {
            ID_FIELD: idField,
            REFERENCE_SUBTYPE: referenceSubtype,
            TARGETS_SUBTYPE: targetsSubtype,
            MODAL_COLUMNS: modalColumns,
        } = this.constructor;
        const table = this.tableManagerReference;
        let rows;
        try {
            rows = await table.dataSource.getRowsById(table.state.activeCheckBoxes.keys());
        } catch (error) {
            console.error(`Fetching the selected ${this.constructor.NOUN} failed:`, error);
            showAlert(`Could not load the selected ${this.constructor.NOUN}`, "danger");
            return;
        }

        ClearSelection("targets");
        ClearSelection("reference");

        const { modal, tbody } = this._buildModal(modalColumns);

        const ids = rows.map((rowData) => rowData.checkbox.data[idField]);
        rows.forEach((rowData, index) => {
            const tr = document.createElement("tr");
            const checkboxCell = document.createElement("td");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkboxCell.appendChild(checkbox);
            tr.appendChild(checkboxCell);
            for (const jsonId of modalColumns) {
                const td = document.createElement("td");
                td.textContent = this._cellText(rowData, jsonId) || table.nullValuePlaceholder;
                tr.appendChild(td);
            }
            tr.addEventListener("click", () => {
                checkbox.checked = true;
                const reference = ids[index];
                const targets = ids.filter((id) => id !== reference);
                AddToSelection("reference", referenceSubtype, reference);
                AddToSelection("targets", targetsSubtype, targets.join(","));
                window.location.href = SuperpositionButton.WORKFLOW_URL;
            });
            tbody.appendChild(tr);
        });

        document.body.appendChild(modal);
        modal.style.display = "block";
    }

    /**
     * Builds the modal listing the selected items (styled by modal.css), replacing any modal from an earlier click.
     * The header shows the table's titles of the modal columns. The modal is removed when closed, either with its
     * close button or by clicking the backdrop.
     * @param {string[]} modalColumns - json ids of the columns listed after the checkbox column.
     * @returns {{modal: HTMLElement, tbody: HTMLElement}} The (not yet attached) modal and its table body.
     */
    _buildModal(modalColumns) {
        document.getElementById(SuperpositionButton.MODAL_ID)?.remove();

        const modal = document.createElement("div");
        modal.id = SuperpositionButton.MODAL_ID;
        modal.className = "modal";
        modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

        const content = document.createElement("div");
        content.className = "modal-content";
        modal.appendChild(content);

        const close = document.createElement("button");
        close.className = "close";
        close.style.cssText = "float:right;display:inline;";
        close.setAttribute("aria-label", "Close");
        close.textContent = "×";
        close.addEventListener("click", () => modal.remove());

        const heading = document.createElement("h3");
        heading.textContent = "Pick reference from selection";
        const description = document.createElement("p");
        description.textContent = `Superposes the ${this.constructor.NOUN} selected in the browser to the reference clicked in this table`;
        content.append(close, heading, description, document.createElement("br"));

        const modalTable = document.createElement("table");
        modalTable.id = "superposition_modal_table"; // row hover and pointer styling in modal.css
        modalTable.className = "display compact";
        modalTable.style.width = "100%";
        const headerRow = modalTable.createTHead().insertRow();
        headerRow.appendChild(document.createElement("th")); // checkbox column
        const columns = this.tableManagerReference.columns;
        for (const jsonId of modalColumns) {
            const th = document.createElement("th");
            const column = columns.find((col) => col.json_id === jsonId);
            // Titles may contain HTML entities or markup (e.g. "Res (&Aring;)"); show them as the table header does
            th.innerHTML = column?.title || column?.exportHeaderOverride || jsonId;
            headerRow.appendChild(th);
        }
        const tbody = modalTable.createTBody();
        content.appendChild(modalTable);

        return { modal, tbody };
    }
}

/**
 * Superposes the selected experimental structures (checkbox data: pdb_code).
 */
class SuperposeStructuresButton extends SuperpositionButton {
    static ID_FIELD = "pdb_code";
    static REFERENCE_SUBTYPE = "structure";
    static TARGETS_SUBTYPE = "structure_many";
    static MODAL_COLUMNS = ["pdb", "uniprot", "gene", "protein", "receptor_family", "receptor_class",
                            "species_common_name", "state", "publication_date"];
    static NOUN = "structures";
}

/**
 * Superposes the selected models (checkbox data: selection_id, "<entry name>_<state name>").
 */
class SuperposeModelsButton extends SuperpositionButton {
    static ID_FIELD = "selection_id";
    static REFERENCE_SUBTYPE = "structure_model";
    static TARGETS_SUBTYPE = "structure_model_many";
    static MODAL_COLUMNS = ["uniprot", "gene", "protein", "receptor_family", "receptor_class",
                            "species_common_name", "version", "state", "method"];
    static NOUN = "models";
}

export { SuperpositionButton, SuperposeStructuresButton, SuperposeModelsButton };
