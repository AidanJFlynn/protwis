#Base imports
import math
import re
from itertools import zip_longest

#Django Framework imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models import BooleanField, Exists, OuterRef, Subquery, TextField

#GPCRdb imports
from common.models import WebResource, WebLink
from interaction.models import StructureLigandInteraction
from ligand.functions import standardize_smiles
from ligand.models import Endogenous_GTP, LigandID, LigandPeptideStructure
from protein.models import Gene
from signprot.models import SignprotComplex
from structure.models import StructureType


#########################
# Physiological Ligands #
#########################

EXPERIMENTAL_STRUCTURE_TYPES = ['x-ray-diffraction', 'electron-crystallography', 'electron-microscopy']

# ── subquery: array of `field` over the structures, ordered by PDB code so that arrays of different fields line up ──
def _structure_array(structures, field, base_field=None):
    base_field = base_field or TextField()
    return Subquery(
        structures.order_by().values('ligand').annotate(
            aggregated=ArrayAgg(field, ordering='structure__pdb_code__index')
        ).values('aggregated'),
        output_field=ArrayField(base_field),
    )

# ── subquery: all experimental structures of the ligand bound to the receptor ──
def _experimental_structures(field):
    return _structure_array(
        StructureLigandInteraction.objects.filter(
            structure__structure_type__slug__in=EXPERIMENTAL_STRUCTURE_TYPES,
            ligand=OuterRef('ligand'),
            structure__protein_conformation__protein__parent__pk=OuterRef('receptor'),
        ), field)

# ── subquery: all peptide/model structures of the ligand bound to the receptor ──
def _model_structures(field):
    return _structure_array(
        LigandPeptideStructure.objects.filter(
            ligand=OuterRef('ligand'),
            structure__protein_conformation__protein=OuterRef('receptor'),
        ), field)

# ── subquery: flags, ordered as _model_structures, whether each model structure has a signalling protein entry ──
def _model_structures_has_signprot():
    return _structure_array(
        LigandPeptideStructure.objects.filter(
            ligand=OuterRef('ligand'),
            structure__protein_conformation__protein=OuterRef('receptor'),
        ), Exists(SignprotComplex.objects.filter(structure=OuterRef('structure'))), BooleanField())

# ── subquery: receptor gene, preferring the primary gene (position 0) ──
def _receptor_gene(field):
    return Subquery(
        Gene.objects.filter(proteins=OuterRef('receptor')).order_by('position', 'entrez_id').values(field)[:1]
    )

def _gtp_ligand_index():
    return Subquery(
        LigandID.objects.filter(ligand=OuterRef('ligand'), web_resource__slug='gtoplig').values('index')[:1]
    )

def _to_float(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(number) else number

def _split_range(value):
    """Splits a 'min | mid | max' string (e.g. Endogenous_GTP.pec50) into three floats, None where missing."""
    parts = value.split(' | ') if value else []
    parts += [None] * (3 - len(parts))
    return [_to_float(part) for part in parts[:3]]

def _short_family_name(name):
    """Family name without its trailing ' receptor(s)', e.g. 'Opioid receptors' -> 'Opioid'."""
    return re.sub(r' receptors?$', '', name) if name else name

def _ligand_preview(smiles):
    """smiles_for_image used by the client's compound preview, None when no image can be generated
    (no or invalid SMILES, or molecular weight of 800 or more)."""
    if smiles and smiles != "-":
        _, smiles_for_image, picture_flag = standardize_smiles(smiles, None)
        if picture_flag == 'Generate_from_SMILES':
            return smiles_for_image
    return None

def _split_structures(data, model_structure_types):
    """All structures of a pair as (experimental PDB codes, model PDB codes, structure types of the models).

    Experimental and model structures are merged and classified by structure type origin, so
    models (AF2, Boltz2, RFAA, ...) land in the model lists whichever table they came from.
    """
    structures = {}
    for codes, types, has_signprot in ((data['exp_pdb_codes'], data['exp_structure_types'], None),
                                       (data['model_id_codes'], data['model_types'], data['model_has_signprot'])):
        for code, structure_type, signprot in zip_longest(codes or [], types or [], has_signprot or []):
            structures.setdefault(code, {'type': structure_type, 'has_signprot': signprot})

    exp_codes = [code for code, details in structures.items() if details['type'] not in model_structure_types]
    models = [(code, details['type'], details['has_signprot']) for code, details in structures.items() if details['type'] in model_structure_types]
    return exp_codes, [code for code, _, _ in models], [structure_type for _, structure_type, _ in models], [signprot for _, _, signprot in models]

def _publications_by_pair():
    """Publications for each (ligand, receptor) pair, ordered by year.

    As on the legacy page, publications without a web link or year are left out.
    """
    pubmed_websource = WebResource.objects.get(slug="pubmed")
    doi_websource = WebResource.objects.get(slug="doi")

    rows = Endogenous_GTP.objects.filter(
        publication__web_link__isnull=False,
        publication__year__isnull=False,
    ).values(
        "ligand",
        "receptor",
        "publication__authors",
        "publication__year",
        "publication__title",
        "publication__journal__name",
        "publication__reference",
        "publication__web_link__index",
    ).distinct()

    publications = {}
    for row in rows:
        index = row['publication__web_link__index']
        if not index:
            continue
        if index.isdigit():
            href = str(WebLink(index=index, web_resource=pubmed_websource))
        elif index.startswith('10.'):
            href = str(WebLink(index=index, web_resource=doi_websource))
        else:
            href = None

        publications.setdefault((row['ligand'], row['receptor']), []).append({
            'authors': row['publication__authors'],
            'year': row['publication__year'],
            'title': row['publication__title'],
            'journal': row['publication__journal__name'],
            'reference': row['publication__reference'],
            'web_link_index': index,
            'href': href,
        })

    for references in publications.values():
        references.sort(key=lambda reference: reference['year'])
    return publications

#------------#
# Main Query #
#------------#
def PhysiologicalLigandsTableRows():
    """Rows for table_provider.PhysiologicalLigandsTable, one per (ligand, receptor) pair.

    Covers Endogenous_GTP entries whose ligand has a Guide to Pharmacology ID. Where a pair has several
    Endogenous_GTP entries, the first (lowest pk) is used. All experimental and model structures of the pair
    are listed, as JSON lists of PDB codes.
    """
    queryset = Endogenous_GTP.objects.annotate(
        gtp_ligand_index=_gtp_ligand_index(),
        gene_name=_receptor_gene('name'),
        gene_entrez_id=_receptor_gene('entrez_id'),
        exp_pdb_codes=_experimental_structures('structure__pdb_code__index'),
        exp_structure_types=_experimental_structures('structure__structure_type__slug'),
        model_id_codes=_model_structures('structure__pdb_code__index'),
        model_types=_model_structures('structure__structure_type__slug'),
        model_has_signprot=_model_structures_has_signprot(),
    ).filter(
        gtp_ligand_index__isnull=False,
    ).order_by('pk').values(
        "ligand",
        "receptor",
        "receptor__family__parent__parent__parent__name",
        "receptor__family__parent__name",
        "receptor__entry_name",
        "receptor__accession",
        "receptor__name",
        "receptor__species__common_name",
        "gene_name",
        "gene_entrez_id",
        "ligand__name",
        "ligand__ligand_type__name",
        "ligand__smiles",
        "ligand__inchikey",
        "ligand__sequence",
        "gtp_ligand_index",
        "endogenous_status",
        "potency_ranking",
        "pec50",
        "pKi",
        "exp_pdb_codes",
        "exp_structure_types",
        "model_id_codes",
        "model_types",
        "model_has_signprot",
    )

    # Model structures (AF2, Boltz2, RFAA, ...) are shown in the Model column, everything else in the Exp column
    model_structure_types = set(StructureType.objects.filter(origin='model').values_list('slug', flat=True))

    publications = _publications_by_pair()
    previews = {}
    rows = []
    seen_pairs = set()
    for data in queryset:
        pair = (data['ligand'], data['receptor'])
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)

        # Same ligand recurs for many receptors, so standardise its SMILES once
        if data['ligand'] not in previews:
            previews[data['ligand']] = _ligand_preview(data['ligand__smiles'])
        smiles_for_image = previews[data['ligand']]

        pec50_min, pec50_mid, pec50_max = _split_range(data['pec50'])
        pki_min, pki_mid, pki_max = _split_range(data['pKi'])

        exp_pdb_codes, model_pdb_codes, model_structure_type_slugs, model_has_signprot = _split_structures(data, model_structure_types)
        receptor_class = data['receptor__family__parent__parent__parent__name']
        ligand_type = data['ligand__ligand_type__name']

        rows.append({
            ## Receptor
            'receptor_class': receptor_class.replace('Class ', '') if receptor_class else None,
            'receptor_family': _short_family_name(data['receptor__family__parent__name']),
            'uniprot_entry_name': data['receptor__entry_name'],
            'uniprot_accession': data['receptor__accession'],
            'uniprot_name': data['receptor__entry_name'].split('_')[0].upper(),
            'protein_name': data['receptor__name'].replace(" receptor", "").replace("-adrenoceptor", ""),
            'gene_name': data['gene_name'],
            'gene_entrez_id': data['gene_entrez_id'],
            'species_common_name': data['receptor__species__common_name'],

            ## Ligand
            'ligand_id': data['ligand'],
            'ligand_name': data['ligand__name'],
            'gtp_ligand_index': data['gtp_ligand_index'],
            'gtp_classification': data['endogenous_status'].title() if data['endogenous_status'] else None,
            'potency_ranking': int(data['potency_ranking']) if data['potency_ranking'] is not None else None,
            'ligand_type': ligand_type.replace('-', ' ').capitalize() if ligand_type else None,
            'smiles': data['ligand__smiles'] or None,
            'inchikey': data['ligand__inchikey'] or None,
            'sequence': data['ligand__sequence'] or None,
            'smiles_for_image': smiles_for_image,

            ## Structure
            'exp_pdb_codes': exp_pdb_codes,
            'model_id_codes': model_pdb_codes,
            'model_structure_types': model_structure_type_slugs,
            'model_has_signprot': model_has_signprot,

            ## Potency
            'pec50_min': pec50_min,
            'pec50_mid': pec50_mid,
            'pec50_max': pec50_max,
            'pki_min': pki_min,
            'pki_mid': pki_mid,
            'pki_max': pki_max,

            'references': publications.get(pair, []),
        })

    return rows
