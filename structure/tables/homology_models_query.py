from structure.models import StructureModel


##########################
# Homology Model Browser #
##########################

# Display name of each model type (StructureModel.model_type); any other type is a plain AlphaFold2 model
AF_MULTISTATE_MODEL_TYPE = 'AFMS'
AF_MULTISTATE_METHOD = 'AlphaFold2-Multistate'
AF_METHOD = 'AlphaFold2'


def _method(model_type):
    """Display name of the modelling method, as shown by the legacy template."""
    return AF_MULTISTATE_METHOD if model_type == AF_MULTISTATE_MODEL_TYPE else AF_METHOD


#------------#
# Main Query #
#------------#
def HomologyModelsTableRows():
    """Rows for table_provider.HomologyModelsTable, one per receptor model (refined structures excluded).

    Names that may contain HTML (protein_name, receptor_family, receptor_class) are returned as HTML;
    the build command splits them into plain text and formatting.
    """
    models = (
        StructureModel.objects
        .filter(main_template__isnull=True)
        .select_related(
            "state",
            "protein__species",
            "protein__family__parent__parent__parent",
        )
        .prefetch_related("protein__genes")  # Gene is ordered by position, so the first one is the primary gene
    )

    rows = []
    for m in models:
        protein = m.protein
        gene = next(iter(protein.genes.all()), None)

        rows.append({
            ## Model
            'model_id': m.id,
            'version': m.version,
            'state': m.state.name if m.state else None,
            'state_slug': m.state.slug if m.state else None,
            'method': _method(m.model_type),

            ## Receptor
            'uniprot_entry_name': protein.entry_name,
            'uniprot_accession': protein.accession,
            'uniprot_name': protein.entry_short(),
            'gene_name': gene.name if gene else None,
            'gene_entrez_id': str(gene.entrez_id) if gene and gene.entrez_id is not None else None,
            'protein_name': protein.short(),
            'receptor_family': protein.family.parent.short(),
            'receptor_class': protein.family.parent.parent.parent.short(),
            'species_common_name': protein.species.common_name if protein.species else None,
        })

    return rows
