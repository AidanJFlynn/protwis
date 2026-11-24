import { SelectionActionButton } from "./selectionactionbutton.js";

/**
 * Base for buttons that copy one value per selected structure to the clipboard, one per line.
 *
 * Values are read from the checkbox data when it carries the field (instant, no request). Otherwise they are read from
 * the table's row data, as the plain text of the given column, which needs the rows to be fetched (a request on
 * server side tables), so the table does not need the field added to its checkbox data.
 * WARNING: Copying after an await can be refused by some browsers, because the click gesture may have expired,
 * to be completely sure the copy is successful, the desired values should be in the checkbox data, or the table should be client side.
 * Only use the fallback for large values such as long sequences, where the checkbox data would be too large.
 * Relies on the global showAlert function (gpcrdb.js).
 */
class CopySelectedButton extends SelectionActionButton {

    /**
     * @param {Object} tableManagerReference - The TableManager instance that owns the table.
     * @param {string} text - The button label.
     * @param {string} checkboxField - Checkbox data field to copy.
     * @param {string} columnJsonId - json_id of the column to copy when the checkbox data lacks the field.
     * @param {string} label - Plural name of the copied values, used in alerts.
     */
    constructor(tableManagerReference, text, checkboxField, columnJsonId, label) {
        super(tableManagerReference, text);
        this.checkboxField = checkboxField;
        this.columnJsonId = columnJsonId;
        this.label = label;
    }

    async _onClick() {
        let values;
        try {
            values = await this._selectedValues();
        } catch (error) {
            console.error("Fetching the selected structures failed:", error);
            showAlert("Could not load the selected structures", "danger");
            return;
        }

        values = values.filter((value) => value);
        if (values.length === 0) {
            showAlert(`No ${this.label} available for the selected structures`, "warning");
            return;
        }
        try {
            await navigator.clipboard.writeText(values.join("\n"));
            showAlert(`${this.label} copied to clipboard!`, "success");
        } catch (error) {
            showAlert(`Could not copy ${this.label} to the clipboard`, "danger");
        }
    }

    /**
     * @returns {Promise<string[]>} One value per selected structure, from the checkbox data if every selected
     *   structure's checkbox data has the field, otherwise from the column's cells.
     */
    async _selectedValues() {
        const structures = this.selectedItems();
        if (structures.every((structure) => this.checkboxField in structure)) {
            return structures.map((structure) => structure[this.checkboxField]);
        }

        const table = this.tableManagerReference;
        const rows = await table.dataSource.getRowsById(table.state.activeCheckBoxes.keys());
        return rows.map((rowData) => this._cellText(rowData, this.columnJsonId));
    }
}

class CopyUniprotButton extends CopySelectedButton {
    constructor(tableManagerReference) {
        super(tableManagerReference, "Copy UniProt IDs", "uniprot_entry_name", "uniprot", "UniProt IDs");
    }
}

class CopyPdbButton extends CopySelectedButton {
    constructor(tableManagerReference) {
        super(tableManagerReference, "Copy PDB IDs", "pdb_code", "pdb", "PDB IDs");
    }
}

export { CopyUniprotButton, CopyPdbButton };
