import re

from django.db.models import (
    Count, Value, IntegerField, FloatField, ExpressionWrapper,
    Exists, OuterRef, Subquery, Prefetch,
)
from django.db.models.functions import Length, Coalesce, Cast

from structure.models import Structure, StructureExtraProteins, StructureAuxiliarySmallMolecule
from interaction.models import StructureLigandInteraction, ResidueFragmentInteraction
from protein.models import Gene, IdentifiedSites
from common.models import WebLink


#####################
# Structure Browser #
#####################

# ── stabilising-agent classification ───────────────────────────────────────
FUSION_RE = (
    r".*thase.*|PGS|BRIL|.*Lysozyme|.*b562.*|TrxA|Flavodoxin|Rubredoxin|"
    r"Sialidase|.*Thioredoxin.*|Endolysin|.*cytochrome.*|.*DARPin.*"
)
ANTIBODY_RE = (
    r".*bod.*|.*Ab.*|.*scFv.*|.*Fab.*|.*activity.*|.*RAMP.*|.*GRK.*|"
    r"Unidentified peptide|.*CD4.*|.*IgG.*|.*NB.*|.*Fv.*"
)
fusion_pat = re.compile(FUSION_RE, re.I)
antibody_pat = re.compile(ANTIBODY_RE, re.I)

APO_LIGAND_NAME = "Apo (no ligand)"
SIGNAL_PROTEIN_CATEGORIES = {"G alpha", "Arrestin"}


# ── subquery: distinct annotated-ligand count per structure ────────────────
def _num_annotated_ligands_subquery():
    return (
        StructureLigandInteraction.objects
        .filter(structure=OuterRef("pk"), annotated=True)
        .values("structure")
        .annotate(c=Count("ligand", distinct=True))
        .values("c")
    )


# ── subquery: residue-fragment-interaction count per structure ─────────────
def _num_interactions_subquery():
    return (
        ResidueFragmentInteraction.objects
        .filter(structure_ligand_pair__structure=OuterRef("pk"))
        .exclude(interaction_type__slug="acc")
        .values("structure_ligand_pair__structure")
        .annotate(c=Count("id"))
        .values("c")
    )


def _yes_no(value):
    return "Yes" if value else "No"


def _signal_protein(structure):
    """The structure's G alpha or arrestin chain, None if it has neither."""
    return next((ep for ep in structure.prefetched_extras if ep.category in SIGNAL_PROTEIN_CATEGORIES), None)


def _signal_protein_subtype(signal_protein):
    """Display name of the signalling protein; G proteins are shown with a Greek alpha."""
    name = signal_protein.display_name
    return f"α{name[1:]}" if name.startswith("G") else name


def _structure_ligands(structure):
    """(ids, names, types, roles) of the structure's ligands. "Apo (no ligand)" entries are left out, so apo
    structures have no ligands (the serializer shows them as apo)."""
    ids = []
    names = []
    types = []
    roles = []
    for interaction in structure.prefetched_ligands:
        ligand = interaction.ligand
        if not ligand or ligand.name == APO_LIGAND_NAME:
            continue
        ids.append(ligand.id)
        names.append(ligand.name)
        types.append(ligand.ligand_type.name if ligand.ligand_type else None)
        roles.append(interaction.ligand_role.name if interaction.ligand_role else None)
    return ids, names, types, roles


def _endogenous_ligands(receptor):
    """(ids, names, types) of the receptor's endogenous ligands, each ligand once."""
    ids = [] 
    names = []
    types = []
    for endogenous in receptor.endogenous_gtp_set.all():
        ligand = endogenous.ligand
        if not ligand or ligand.id in ids:
            continue
        ids.append(ligand.id)
        names.append(ligand.name)
        types.append(ligand.ligand_type.name if ligand.ligand_type else None)
    return ids, names, types


def _auxiliary_small_molecules(structure):
    """(names, types, functions) of the structure's auxiliary small molecules; names are unique and in order."""
    names = []
    types = []
    functions = []
    for molecule in structure.prefetched_aux_small_molecules:
        title = molecule.title or molecule.name
        if title and title not in names:
            names.append(title)
            types.append(molecule.type if molecule.type else None)
            functions.append(molecule.function if molecule.function else None)
    return names, types, functions


#------------#
# Main Query #
#------------#
def StructureBrowserTableRows():
    """Rows for table_provider.GpcrStructureBrowserTable, one per experimental structure.

    Names that may contain HTML (protein_name, receptor_family, signal_protein_subtype, ligand_names,
    endo_ligand_names) are returned as HTML; the build command splits them into plain text and formatting.
    """
    structures = (
        Structure.objects
        .filter(structure_type__origin='experiment')
        .select_related(
            "state", "structure_type", "pdb_code",
            "publication__web_link__web_resource",
            "protein_conformation__protein__species",
            "protein_conformation__protein__parent",
            "protein_conformation__protein__family__parent__parent__parent",
        )
        .prefetch_related(
            Prefetch(
                "protein_conformation__protein__parent__genes",
                queryset=Gene.objects.filter(position=0),
                to_attr="filtered_genes",
            ),
            Prefetch(
                "extra_proteins",
                queryset=StructureExtraProteins.objects.select_related("wt_protein__family__parent"),
                to_attr="prefetched_extras",
            ),
            Prefetch(
                "ligands",
                queryset=StructureLigandInteraction.objects.select_related(
                    "ligand", "ligand_role", "ligand__ligand_type"),
                to_attr="prefetched_ligands",
            ),
            Prefetch(
                "auxiliary_small_molecules",
                queryset=StructureAuxiliarySmallMolecule.objects.all(),
                to_attr="prefetched_aux_small_molecules",
            ),
            Prefetch(
                "protein_conformation__protein__parent__web_links",
                queryset=WebLink.objects.filter(web_resource__slug="gtop"),
                to_attr="prefetched_gtop_links",
            ),
            "stabilizing_agents",
            "protein_conformation__protein__parent__endogenous_gtp_set__ligand__ligand_type",
        )
        .annotate(
            coverage_pct=ExpressionWrapper(
                Cast(Count("protein_conformation__residue", distinct=True), FloatField()) * 100.0 /
                Coalesce(Length("protein_conformation__protein__parent__sequence"), Value(1.0)),
                output_field=IntegerField(),
            ),
            has_sodium_site=Exists(
                IdentifiedSites.objects.filter(
                    protein_conformation=OuterRef("protein_conformation_id"),
                    site__slug="sodium_pocket")
            ),
            has_ligand_interactions=Exists(
                ResidueFragmentInteraction.objects.filter(structure_ligand_pair__structure=OuterRef("pk"))
            ),
            num_annotated_ligands=Coalesce(
                Subquery(_num_annotated_ligands_subquery(), output_field=IntegerField()), 0),
            num_interactions=Coalesce(
                Subquery(_num_interactions_subquery(), output_field=IntegerField()), 0),
        )
    )

    rows = []
    for s in structures:
        protein = s.protein_conformation.protein  # the construct
        receptor = protein.parent                 # the wild-type receptor
        pdb_code = s.pdb_code.index if s.pdb_code else None
        gene = receptor.filtered_genes[0] if receptor.filtered_genes else None
        gtop_link = next(iter(receptor.prefetched_gtop_links), None)
        web_link = s.publication.web_link if s.publication else None
        signal_protein = _signal_protein(s)

        agent_names = [agent.name for agent in s.stabilizing_agents.all()]
        ligand_ids, ligand_names, ligand_types, ligand_roles = _structure_ligands(s)
        if len(ligand_ids) != len(ligand_names) or len(ligand_ids) != len(ligand_types) or len(ligand_ids) != len(ligand_roles):
            raise ValueError("Inconsistent lengths in structure ligands")
        endo_ids, endo_names, endo_types = _endogenous_ligands(receptor)
        if len(endo_ids) != len(endo_names) or len(endo_ids) != len(endo_types):
            raise ValueError("Inconsistent lengths in endogenous ligands")
        aux_names, aux_types, aux_functions = _auxiliary_small_molecules(s)
        if len(aux_names) != len(aux_types) or len(aux_names) != len(aux_functions):
            raise ValueError("Inconsistent lengths in auxiliary small molecules")

        # Regex to add a space after the slash in signal protein notes, so that the table can break lines there.
        # Eg. "A34B/S43K/D678F" becomes "A34B / S43K / D678F"
        aa_slash_re = re.compile(r"([A-Z][0-9]{1,4}[A-Z])/")

        rows.append({
            ## Structure
            'structure_id': s.id,
            'pdb_code': pdb_code,
            'method': s.structure_type.type_short(),
            'refined_structure': f"{pdb_code.upper()}_refined" if s.refined and pdb_code else None,
            'resolution': float(s.resolution) if s.resolution is not None else None,
            'representative': s.representative,
            'preferred_chain': s.preferred_chain or None,
            'state': s.state.name if s.state else None,
            'gprot_bound_likeness': float(s.gprot_bound_likeness) if s.gprot_bound_likeness is not None else None,
            'coverage': int(s.coverage_pct) if s.coverage_pct is not None else None,

            ## Receptor
            'uniprot_entry_name': receptor.entry_name,
            'uniprot_accession': receptor.accession,
            'uniprot_name': receptor.entry_name.split('_')[0].upper(),
            'protein_name': receptor.name.replace("receptor", "").replace("-adrenoceptor", "").strip(),
            'iuphar_index': gtop_link.index if gtop_link and gtop_link.index else None,
            'gene_name': gene.name if gene else None,
            'gene_entrez_id': str(gene.entrez_id) if gene and gene.entrez_id is not None else None,
            'receptor_family': protein.family.parent.short(),
            'receptor_class': protein.family.parent.parent.parent.shorter(),
            'species_common_name': protein.species.common_name,

            ## Signalling protein
            'signal_protein_family': (signal_protein.wt_protein.family.parent.name
                                      if signal_protein and signal_protein.wt_protein else None),
            'signal_protein_subtype': _signal_protein_subtype(signal_protein) if signal_protein else None,
            'signal_protein_entry_name': (signal_protein.wt_protein.entry_name
                                          if signal_protein and signal_protein.wt_protein else None),
            'signal_protein_note': (aa_slash_re.sub("\\1 / ", signal_protein.note) or None) if signal_protein else None, #add space to allow breaks in table
            'signal_protein_pcntseq': signal_protein.wt_coverage if signal_protein else None,

            ## Structure ligands (position matched lists of ids, names, types and roles)
            'ligand_ids': ligand_ids,
            'ligand_names': ligand_names,
            'ligand_type': ligand_types,
            'ligand_role': ligand_roles,

            ## Auxiliary proteins and small molecules
            'fusion': [name for name in agent_names if fusion_pat.match(name)],
            'antibody': [name for name in agent_names if antibody_pat.match(name)],
            ## Position matched lists of auxiliary molecule names, types and functions
            'auxiliary_molecule': aux_names,
            'auxiliary_molecule_type': aux_types,
            'auxiliary_molecule_function': aux_functions,

            ## Natural ligands (position matched lists of ids, names, types)
            'endo_ligand_ids': endo_ids,
            'endo_ligand_names': endo_names,
            'endo_ligand_type': endo_types,

            ## Sodium ion sites
            'sodium_site': _yes_no(s.has_sodium_site),
            'sodium': _yes_no(s.sodium),

            ## Reference
            'authors': s.publication.authors if s.publication and s.publication.authors else None,
            'reference_index': web_link.index if web_link and web_link.web_resource else None,
            'reference_web_resource': web_link.web_resource.slug if web_link and web_link.web_resource else None,
            'publication_date': s.publication_date,

            ## Ligand interactions
            'has_ligand_interactions': bool(s.has_ligand_interactions),
            'num_annotated_ligands': s.num_annotated_ligands,
            'num_interactions': s.num_interactions,
        })

    return rows
