class ShowRepresentatives {

    // json_id of the boolean-like column flagging the representative structures
    static COLUMN_JSON_ID = 'representative';
    static ON_TOOLTIP = 'Limit table to showing only the representative structures';
    static OFF_TOOLTIP = 'Show all structures';
    static BUTTON_TEXT_ON = 'Show Representatives Only';
    static BUTTON_TEXT_OFF = 'Show All Structures';

    button_config
    tableManagerReference
    buttonNode = null
    representativesOnly = false

    /**
     * Creates the Show Representatives toggle button configuration, starting in the "On" state (filter off).
     * @param {Object} tableManagerReference - The TableManager instance that owns the table.
     */
    constructor(tableManagerReference) {
        this.tableManagerReference = tableManagerReference;
        this.button_config = {
            text: ShowRepresentatives.BUTTON_TEXT_ON,
            className: 'toggle_on',
            titleAttr: ShowRepresentatives.ON_TOOLTIP,
        }

        this.button_config.action = (e, dt, node, config, cb) => { this._actionHandler(node) };
    }

    /**
     * Adds the toggle button to the DataTable button bar and subscribes to "filtersCleared" so the toggle resets
     * when Clear Filters is used.
     * @param {number} index - Position at which the button is inserted into the button bar.
     */
    attach(index) {
        this.tableManagerReference.dataTableReference.button().add(index, this.button_config);

        // Reset the toggle to its initial "On" state (filter off) when Clear Filters clears all column searches
        this.tableManagerReference.eventPubSub.subscribe('filtersCleared', () => {
            this.representativesOnly = false;
            this._renderState();
        });
    }

    /**
     * Toggles the representative filter on the representative column and updates the button to match.
     * @param {HTMLElement} node - The button element that was clicked.
     */
    _actionHandler(node) {
        this.buttonNode = node;
        this.representativesOnly = !this.representativesOnly;

        const column = this.tableManagerReference.columns.find((x) => x.json_id == ShowRepresentatives.COLUMN_JSON_ID);
        // Filter on: hide rows where the representative flag is not "true". Filter off: no terms.
        const terms = this.representativesOnly ? [{ value: 'true', contains: false }] : [];
        this.tableManagerReference.dataSource.applyColumnFilter(column, { type: 'text', terms: terms });

        this._renderState();
    }

    /**
     * Updates the button to show the action it offers next. Does nothing until the button has been clicked, while the
     * initial state is still showing.
     */
    _renderState() {
        if (!this.buttonNode) return; // Never clicked, so the initial "On" state is still showing

        const $node = $(this.buttonNode);
        $node.toggleClass('toggle_on', !this.representativesOnly);
        $node.toggleClass('toggle_off', this.representativesOnly);
        $node.attr('title', this.representativesOnly ? ShowRepresentatives.OFF_TOOLTIP : ShowRepresentatives.ON_TOOLTIP);
        $node.text(this.representativesOnly ? ShowRepresentatives.BUTTON_TEXT_OFF : ShowRepresentatives.BUTTON_TEXT_ON);
    }
}

export { ShowRepresentatives };
