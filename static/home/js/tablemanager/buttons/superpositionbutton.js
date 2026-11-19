import { SelectionActionButton } from "./selectionactionbutton.js";

/**
 * Sends the selected structures to the superposition workflow.
 *
 * The superposition workflow can return to the table to pick its reference or targets, signalled by the URL hash
 * (#keepselectionreference / #keepselectiontargets); the button then adds the selection to that part of the workflow.
 * Otherwise it opens a modal listing the selected structures, where clicking one makes it the reference and the
 * others the targets. The modal markup (#superposition-modal, #superposition_modal_table, #close_superposition_modal)
 * lives in the page template.
 *
 * Relies on the global ClearSelection, AddToSelection and showAlert functions (browser_functions.js, gpcrdb.js).
 */
class SuperpositionButton extends SelectionActionButton {

    static MAX_SUPERPOSE = 50;
    static WORKFLOW_URL = "/structure/superposition_workflow_index#keepselection";
    // json ids of the modal's columns, after its checkbox column
    static MODAL_COLUMNS = ["pdb", "uniprot", "gene", "protein", "receptor_family", "receptor_class",
                            "species_common_name", "state", "publication_date"];

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
        const pdbCodes = this.selectedPdbCodes();
        if (pdbCodes.length > SuperpositionButton.MAX_SUPERPOSE) {
            showAlert(`Maximum number of selected entries is ${SuperpositionButton.MAX_SUPERPOSE}`, "warning");
            return;
        }

        if (this.mode === "reference") {
            if (pdbCodes.length !== 1) {
                showAlert("Please select exactly one entry as reference", "danger");
                return;
            }
            AddToSelection("reference", "structure", pdbCodes[0]);
            window.location.href = SuperpositionButton.WORKFLOW_URL;
        } else if (this.mode === "targets") {
            AddToSelection("targets", "structure_many", pdbCodes.join(","));
            window.location.href = SuperpositionButton.WORKFLOW_URL;
        } else {
            this._openModal();
        }
    }

    /**
     * Lists the selected structures; clicking one makes it the reference and the others the targets.
     */
    async _openModal() {
        const table = this.tableManagerReference;
        let rows;
        try {
            rows = await table.dataSource.getRowsById(table.state.activeCheckBoxes.keys());
        } catch (error) {
            console.error("Fetching the selected structures failed:", error);
            showAlert("Could not load the selected structures", "danger");
            return;
        }

        ClearSelection("targets");
        ClearSelection("reference");

        const modal = document.getElementById("superposition-modal");
        const tbody = document.querySelector("#superposition_modal_table tbody");
        tbody.replaceChildren();

        const pdbCodes = rows.map((rowData) => rowData.checkbox.data.pdb_code);
        rows.forEach((rowData, index) => {
            const tr = document.createElement("tr");
            const checkboxCell = document.createElement("td");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkboxCell.appendChild(checkbox);
            tr.appendChild(checkboxCell);
            for (const jsonId of SuperpositionButton.MODAL_COLUMNS) {
                const td = document.createElement("td");
                td.textContent = this._cellText(rowData, jsonId) || table.nullValuePlaceholder;
                tr.appendChild(td);
            }
            tr.addEventListener("click", () => {
                checkbox.checked = true;
                const reference = pdbCodes[index];
                const targets = pdbCodes.filter((pdbCode) => pdbCode !== reference);
                AddToSelection("reference", "structure", reference);
                AddToSelection("targets", "structure_many", targets.join(","));
                window.location.href = SuperpositionButton.WORKFLOW_URL;
            });
            tbody.appendChild(tr);
        });

        modal.style.display = "block";
        document.getElementById("close_superposition_modal").onclick = () => modal.style.display = "none";
        window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
    }
}

export { SuperpositionButton };
