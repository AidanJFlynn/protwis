/**
 * Base class for buttons that act on the items selected through the table's checkbox column.
 * The button is disabled until at least one row is selected. Subclasses set button_config.text and implement _onClick.
 *
 * Buttons that send selection ids to a GPCRdb workflow set the static ID_FIELD to the checkbox data field holding
 * the id (e.g. pdb_code, see GpcrStructureBrowserSerializer.CHECKBOX_DATA_FIELDS), and read the ids with selectedIds.
 */
class SelectionActionButton {

    // Checkbox data field holding an item's selection id, set by subclasses that use selectedIds
    static ID_FIELD = null;

    button_config
    tableManagerReference
    buttonApi = null

    /**
     * @param {Object} tableManagerReference - The TableManager instance that owns the table.
     * @param {string} text - The button label.
     */
    constructor(tableManagerReference, text) {
        this.tableManagerReference = tableManagerReference;
        this.button_config = {
            text: text,
            enabled: false,
            action: (e, dt, node, config, cb) => { this._onClick(e, dt, node, config, cb) },
        };
    }

    /**
     * Adds the button to the DataTable button bar and keeps it enabled only while rows are selected.
     * @param {number} index - Position at which the button is inserted into the button bar.
     */
    attach(index) {
        this.buttonApi = this.tableManagerReference.dataTableReference.button().add(index, this.button_config);
        this.tableManagerReference.eventPubSub.subscribe('checkboxStateChanged', () => {
            this.buttonApi.enable(this.selectedItems().length > 0);
        });
    }

    /**
     * @returns {Object[]} Checkbox data of the selected items.
     */
    selectedItems() {
        const activeCheckboxes = this.tableManagerReference.state.activeCheckBoxes;
        return activeCheckboxes ? [...activeCheckboxes.values()].map((checkbox) => checkbox.data) : [];
    }

    /**
     * @returns {string[]} Selection ids (the checkbox data field named by the static ID_FIELD) of the selected items.
     */
    selectedIds() {
        const idField = this.constructor.ID_FIELD;
        if (!idField) {
            throw new Error(`${this.constructor.name} does not set ID_FIELD`);
        }
        return this.selectedItems().map((item) => item[idField]);
    }

    /**
     * Plain text of a row's cell, as its column's data type reads it (link text, formatted names, ...).
     * @param {Object} rowData - Row data keyed by column json_id.
     * @param {string} jsonId - The column's json_id.
     * @returns {string} The text, or an empty string if the cell has no value.
     */
    _cellText(rowData, jsonId) {
        const value = rowData[jsonId];
        if (value === null || value === undefined) {
            return "";
        }
        const type = this.tableManagerReference.columns.find((col) => col.json_id === jsonId)?.type;
        return (type ? type.plainText(value) : String(value)) || "";
    }

    /**
     * Click handler, implemented by subclasses.
     */
    _onClick(e, dt, node, config, cb) {
        throw new Error("_onClick must be implemented by the button class");
    }
}

export { SelectionActionButton };
