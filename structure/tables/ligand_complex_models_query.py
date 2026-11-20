#Base imports
from collections import defaultdict

#Django Framework imports
from django.db.models import Exists, OuterRef, Prefetch, Subquery
from django.db.models.functions import Coalesce

#GPCRdb imports
from common.definitions import G_PROTEIN_DISPLAY_NAME, ARRESTIN_DISPLAY_NAME
from drugs.models import Drugs
from interaction.models import StructureLigandInteraction
from ligand.functions import standardize_smiles
from ligand.models import Endogenous_GTP, LigandPeptideStructure
from protein.models import Gene, ProteinFamilyClassification
from structure.models import Structure, StructureModelScores, StructureRFAAScores


##########################
# Ligand Complex Models  #
##########################

EXPERIMENTAL_STRUCTURE_TYPES = ['x-ray-diffraction', 'electron-crystallography', 'electron-microscopy']


# ── subquery: receptor gene, prioritising the lowest entrez_id ──
def _receptor_gene(field):
    return Subquery(
        Gene.objects.filter(proteins=OuterRef('protein_conformation__protein__pk')).order_by('entrez_id').values(field)[:1]
    )


# ── subquery: an experimental structure of the same receptor holds one of the model's ligands ──
def _experimental_structure_exists():
    return Exists(
        StructureLigandInteraction.objects.filter(
            structure__structure_type__slug__in=EXPERIMENTAL_STRUCTURE_TYPES,
            structure__protein_conformation__protein__parent__entry_name=OuterRef('protein_conformation__protein__entry_name'),
            ligand__in=Subquery(
                LigandPeptideStructure.objects.filter(structure=OuterRef('pk')).values('ligand')
            )
        )
    )


def _model_structures():
    """Model structures that have a ligand and no experimental counterpart.

    structure_type__origin="model", excluding af-signprot-only rows and models superseded by an experimental
    PDB of the same receptor and ligand.
    """
    structures = Structure.objects.filter(
        structure_type__origin="model",
    ).exclude(
        structure_type__slug__in=['af-signprot']
    ).select_related(
        "state",
        "structure_type",
        "pdb_code",
        "protein_conformation__protein__family__parent__parent__parent",
        "protein_conformation__protein__species",
        "protein_conformation__protein__parent__family",
        "signprot_complex__protein__family__parent__parent__parent",
    ).prefetch_related(
        Prefetch("structuremodelscores_set", queryset=StructureModelScores.objects.all(), to_attr='prefetch_model_scores'),
        Prefetch("structurerfaascores_set", queryset=StructureRFAAScores.objects.all(), to_attr='prefetch_rfaa_scores'),
        Prefetch(
            "ligandpeptidestructure_set",
            queryset=LigandPeptideStructure.objects.select_related("ligand", "ligand__ligand_type"),
            to_attr="prefetch_ligands"
        ),
    ).annotate(
        gene_name=_receptor_gene('name'),
        gene_entrez_id=_receptor_gene('entrez_id'),
        experimental_pdb_exists=_experimental_structure_exists(),
    ).exclude(
        experimental_pdb_exists=True
    )

    # This page is specifically about ligand complexes, so drop models without a ligand
    return [s for s in structures if s.prefetch_ligands]


def _canonical_entry_name(protein):
    """Reference protein entry_name: models sit on the reference protein, experimental structures may sit on a
    PDB-specific construct whose parent is the reference protein."""
    return protein.parent.entry_name if protein.parent else protein.entry_name


def _clinical_status_by_pair(ligand_ids, receptor_ids):
    """Clinical status for each (ligand, receptor) pair, from drugs.Drugs. Pairs without a drug are left out."""
    approved_by_pair = defaultdict(bool)
    for d in Drugs.objects.filter(ligand_id__in=ligand_ids, target_id__in=receptor_ids).values('ligand_id', 'target_id', 'drug_status'):
        pair = (d['ligand_id'], d['target_id'])
        approved_by_pair[pair] = approved_by_pair[pair] or d['drug_status'] == 'Approved'
    return {pair: "Approved drug" if approved else "Agent in trial" for pair, approved in approved_by_pair.items()}


def _pharm_modality_by_pair(ligand_ids, canonical_entry_names):
    """Ligand roles (StructureLigandInteraction.ligand_role) for each (ligand, canonical receptor entry_name) pair,
    joined with ' / '."""
    roles_by_pair = defaultdict(set)
    for r in StructureLigandInteraction.objects.filter(
        ligand_id__in=ligand_ids,
        ligand_role__isnull=False,
    ).annotate(
        canonical_entry_name=Coalesce(
            'structure__protein_conformation__protein__parent__entry_name',
            'structure__protein_conformation__protein__entry_name',
        )
    ).filter(
        canonical_entry_name__in=canonical_entry_names
    ).values('ligand_id', 'canonical_entry_name', 'ligand_role__name'):
        roles_by_pair[(r['ligand_id'], r['canonical_entry_name'])].add(r['ligand_role__name'])
    return {pair: " / ".join(sorted(roles)) for pair, roles in roles_by_pair.items()}


def _primary_classification(family_ids, kind):
    """Primary (order=1) ProteinFamilyClassification `kind` ('modality' or 'chemotype') name per protein family."""
    return {
        r.protein_family_id: getattr(r, kind).name
        for r in ProteinFamilyClassification.objects.filter(
            protein_family_id__in=family_ids, **{f'{kind}_order': 1, f'{kind}__isnull': False}
        ).select_related(kind)
    }


def _mol_modality(ligand_type):
    if not ligand_type:
        return None
    if ligand_type.slug == "small-molecule":
        return "Small mol"
    if ligand_type.slug == "peptide":
        return "Peptide"
    return (ligand_type.name or ligand_type.slug).title()


def _ligand_display_name(name):
    """Short names (e.g. abbreviations) upper case, longer names with a capital first letter."""
    if not name:
        return name
    return name[0].upper() + name[1:] if len(name) >= 6 else name.upper()


def _receptor_display_name(name):
    if not name:
        return name
    if not name.startswith("mGlu"):
        name = name[0].upper() + name[1:]
    return name.replace(" receptor", "").replace("-adrenoceptor", "")


def _ligand_preview(ligand):
    """smiles_for_image used by the client's compound preview, None when no image can be generated
    (no or invalid SMILES, or molecular weight of 800 or more)."""
    if not ligand.smiles:
        return None
    _, smiles_for_image, picture_flag = standardize_smiles(ligand.smiles, getattr(ligand, 'mw', None))
    return smiles_for_image if picture_flag == 'Generate_from_SMILES' else None


def _signal_protein(structure):
    """(family, subtype) display names of the model's signalling protein, (None, None) without one."""
    signprot = structure.signprot_complex
    if not (signprot and signprot.protein and signprot.protein.family and signprot.protein.family.parent):
        return None, None
    sp = signprot.protein
    bucket = sp.family.parent.parent.name if sp.family.parent.parent else None
    subtype_key = sp.entry_name.split('_')[0]
    if bucket == "Arrestin":
        subtype = ARRESTIN_DISPLAY_NAME.get(subtype_key, sp.entry_name)
    else:
        subtype = G_PROTEIN_DISPLAY_NAME.get(subtype_key.upper(), sp.family.name)
    return sp.family.parent.name, subtype


#------------#
# Main Query #
#------------#
def LigandComplexModelsTableRows():
    """Rows for table_provider.LigandComplexModelsTable, one per ligand complex model structure.

    Where a model holds several ligands, the first one is used.
    """
    structures = _model_structures()

    receptor_ids = [s.protein_conformation.protein_id for s in structures]
    ligand_ids = [s.prefetch_ligands[0].ligand_id for s in structures]
    canonical_entry_names = {_canonical_entry_name(s.protein_conformation.protein) for s in structures}
    family_ids = {s.protein_conformation.protein.family_id for s in structures}

    physiological_pairs = set(
        Endogenous_GTP.objects.filter(ligand_id__in=ligand_ids, receptor_id__in=receptor_ids).values_list('ligand_id', 'receptor_id')
    )
    clinical_by_pair = _clinical_status_by_pair(ligand_ids, receptor_ids)
    pharm_modality_by_pair = _pharm_modality_by_pair(ligand_ids, canonical_entry_names)
    receptor_modality = _primary_classification(family_ids, 'modality')
    receptor_chemotype = _primary_classification(family_ids, 'chemotype')

    previews = {}
    rows = []
    for structure in structures:
        protein = structure.protein_conformation.protein
        ligand = structure.prefetch_ligands[0].ligand

        # Same ligand recurs across models, so standardise its SMILES once
        if ligand.id not in previews:
            previews[ligand.id] = _ligand_preview(ligand)

        signal_protein_family, signal_protein_subtype = _signal_protein(structure)

        model_scores = structure.prefetch_model_scores
        structure_type = structure.structure_type.name
        af2_score = model_scores[0].pae_mean if structure_type == "Model (AF2)" and model_scores else None
        boltz2_score = model_scores[0].ligand_plddt if structure_type == "Model (Boltz2)" and model_scores else None
        rfaa_score = structure.prefetch_rfaa_scores[0].plddt_mean if structure.prefetch_rfaa_scores else None

        receptor_class = protein.family.parent.parent.parent.name

        rows.append({
            ## Model
            'structure_id': structure.id,
            'pdb_code': structure.pdb_code.index if structure.pdb_code else None,
            'has_signprot': bool(structure.signprot_complex),

            ## Ligand
            'ligand_id': ligand.id,
            'ligand_name': _ligand_display_name(ligand.name),
            'mol_modality': _mol_modality(ligand.ligand_type),
            'pharm_modality': pharm_modality_by_pair.get((ligand.id, _canonical_entry_name(protein))),
            'physiological': "Yes" if (ligand.id, protein.id) in physiological_pairs else "No",
            'clinical': clinical_by_pair.get((ligand.id, protein.id), "No"),
            'sequence': ligand.sequence or None,
            'smiles_for_image': previews[ligand.id],

            ## Receptor
            'gene_name': structure.gene_name,
            'gene_entrez_id': structure.gene_entrez_id,
            'uniprot_entry_name': protein.entry_name,
            'protein_name': _receptor_display_name(protein.name),
            'receptor_family': protein.family.parent.name,
            'receptor_class': receptor_class[len("Class "):] if receptor_class.startswith("Class ") else receptor_class,
            'receptor_modality': receptor_modality.get(protein.family_id),
            'receptor_chemotype': receptor_chemotype.get(protein.family_id),

            ## Structure
            'state': structure.state.name if structure.state else None,
            'signal_protein_family': signal_protein_family,
            'signal_protein_subtype': signal_protein_subtype,

            ## Ligand model score
            'af2_score': af2_score,
            'boltz2_score': boltz2_score,
            'rfaa_score': rfaa_score,

            ## Date
            'publication_date': structure.publication_date,
        })

    return rows
