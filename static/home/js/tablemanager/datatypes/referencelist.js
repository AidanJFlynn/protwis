// This class represents the "referencelist" data type used in the table manager.
// The cell shows the number of references as a link, which opens a modal listing the full citations. The data for this
// data type is expected to be an array of reference objects in the format
// {authors, year, title, journal, reference, web_link_index, href}, where web_link_index is a PubMed ID or a DOI and
// href links to it (null when neither applies).
// Ordering uses the number of references; search and export use the reference identifiers joined together.

import { DataTypeBase } from "./datatypebase.js";

const IDENTIFIER_SEPARATOR = "; ";

// The modal is a native <dialog> attached to the document body, shared by every reference list cell as only one can be
// open at a time. showModal() gives it a backdrop, closes it on Escape and keeps focus inside it.
let referenceModal = null;

/**
 * Returns the shared reference modal, creating it and its close handlers on first use.
 * @returns {HTMLDialogElement} The modal element.
 */
function getReferenceModal() {
    if (referenceModal === null) {
        referenceModal = document.createElement("dialog");
        referenceModal.classList.add("tm-reference-modal");

        const header = document.createElement("div");
        header.classList.add("tm-reference-modal-header");
        const title = document.createElement("h4");
        title.classList.add("tm-reference-modal-title");
        const closeButton = document.createElement("button");
        closeButton.setAttribute("type", "button");
        closeButton.setAttribute("aria-label", "Close");
        closeButton.classList.add("tm-reference-modal-close");
        closeButton.innerHTML = "&times;";
        closeButton.addEventListener("click", () => referenceModal.close());
        header.append(title, closeButton);

        const body = document.createElement("div");
        body.classList.add("tm-reference-modal-body");

        referenceModal.append(header, body);
        // A click on the backdrop targets the dialog itself, while clicks on its content target the children
        referenceModal.addEventListener("click", (e) => {
            if (e.target === referenceModal) {
                referenceModal.close();
            }
        });
        document.body.appendChild(referenceModal);
    }
    return referenceModal;
}

/**
 * Data type for columns holding a list of literature references. Cell data is an array of reference objects. The cell
 * shows the number of references as a link that opens a modal with the full citations, ordered as supplied. No filter
 * control is built. Extends DataTypeBase.
 * @extends DataTypeBase
 */
class ReferenceList extends DataTypeBase {

    /**
     * Renders a reference list. For the display type, null or empty lists show the nullValuePlaceholder, otherwise a
     * "N refs" link (see eventHookup). The sort and type types return the number of references, so the column orders
     * numerically. The filter type returns the reference identifiers joined, so searching for a PMID or DOI finds the row.
     * @param {Array<Object>|null|undefined} data - The cell data.
     * @param {string} type - The DataTables render type: "display", "filter", "sort" or "type".
     * @param {*} row - The full row data.
     * @param {Object} meta - The DataTables cell metadata.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string|number} The rendered value for the render type.
     */
    dataTableRenderer(data, type, row, meta, tableManagerReference) {
        const references = this._references(data);
        if (type === "sort" || type === "type") {
            return references.length;
        }
        if (type !== "display") {
            return this._identifiers(references); // Search return
        }
        if (references.length === 0) {
            return tableManagerReference.nullValuePlaceholder;
        }

        const link = document.createElement("a");
        link.setAttribute("href", "#");
        link.classList.add("tm-reference-list-link");
        link.textContent = `${references.length} ${references.length === 1 ? "ref" : "refs"}`;
        return link.outerHTML;
    }

    /**
     * Opens the reference modal when the cell's "N refs" link is clicked.
     * @param {HTMLElement} cell - The rendered table cell.
     * @param {*} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {number} rowIndex - The index of the row.
     * @param {number} colIndex - The index of the column.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     */
    eventHookup(cell, cellData, rowData, rowIndex, colIndex, tableManagerReference) {
        const link = cell.querySelector(".tm-reference-list-link");
        if (!link) {
            return;
        }

        link.addEventListener("click", (e) => {
            e.preventDefault();
            // Stops the click from reaching row click handlers, e.g. row selection
            e.stopPropagation();

            const modal = getReferenceModal();
            modal.querySelector(".tm-reference-modal-title").textContent = this.column.title || "References";
            modal.querySelector(".tm-reference-modal-body")
                .replaceChildren(...this._references(cellData).map((reference) => this._citation(reference)));
            modal.showModal();
            modal.querySelector(".tm-reference-modal-body").scrollTop = 0;
        });
    }

    /**
     * Exports the reference identifiers joined, rather than the "N refs" link text.
     * @param {Array<Object>|null|undefined} cellData - The cell data.
     * @param {*} rowData - The full row data.
     * @param {Object} tableManagerReference - The table manager that owns the table.
     * @returns {string} The reference identifiers joined.
     */
    exportValue(cellData, rowData, tableManagerReference) {
        return this._identifiers(this._references(cellData));
    }

    /**
     * Builds the citation element for one reference, in the format used by the legacy endogenous ligands page:
     * "Authors. (Year)", the title, then "Journal, Reference [PMID: id]" with the identifier linked.
     * @param {{authors?: string, year?: number, title?: string, journal?: string, reference?: string,
     *          web_link_index?: string, href?: string|null}} reference - The reference.
     * @returns {HTMLDivElement} The citation element.
     */
    _citation(reference) {
        const citation = document.createElement("div");
        citation.classList.add("tm-reference");

        const heading = document.createElement("b");
        heading.textContent = `${reference.authors ?? ""}. (${reference.year ?? ""})`;
        const title = document.createElement("div");
        title.textContent = reference.title ? `${reference.title}.` : "";

        const source = document.createElement("div");
        const journal = document.createElement("i");
        journal.textContent = reference.journal ?? "";
        const volume = document.createElement("b");
        volume.textContent = reference.reference ?? "";
        source.append(journal, ", ", volume);

        const index = reference.web_link_index;
        if (index) {
            const identifier = reference.href ? document.createElement("a") : document.createElement("span");
            if (reference.href) {
                identifier.setAttribute("href", reference.href);
                identifier.setAttribute("target", "_blank");
            }
            identifier.textContent = index;
            source.append(` [${this._identifierLabel(index)}: `, identifier, "]");
        }

        citation.append(heading, title, source);
        return citation;
    }

    /**
     * Returns the label for a reference identifier: "PMID" for a PubMed ID, "DOI" for a DOI.
     * @param {string} index - The reference identifier.
     * @returns {string} The label.
     */
    _identifierLabel(index) {
        return /^\d+$/.test(index) ? "PMID" : index.startsWith("10.") ? "DOI" : "ID";
    }

    /**
     * Returns the reference identifiers joined, skipping references without one.
     * @param {Array<Object>} references - The references.
     * @returns {string} The identifiers joined, or an empty string if there are none.
     */
    _identifiers(references) {
        return references.map((reference) => reference.web_link_index).filter((index) => index).join(IDENTIFIER_SEPARATOR);
    }

    /**
     * Returns the references in the cell data, skipping empty entries.
     * @param {Array|null|undefined} data - The cell data.
     * @returns {Array<Object>} The reference objects, or an empty array if the data is not a list.
     */
    _references(data) {
        return Array.isArray(data) ? data.filter((reference) => reference) : [];
    }
}

export { ReferenceList };
