import re

from django.contrib.postgres.fields import JSONField
from django.core.exceptions import FieldDoesNotExist, ImproperlyConfigured
from django.db import models
from rest_framework import serializers

from common.models import WebResource, WebLink
from table_provider.models import GpcrStructureBrowserTable, GpcrStructureStatisticsTable, HomologyModelsTable, LigandComplexModelsTable, PdbTable, PhysiologicalLigandsTable

# Server-side filter datatype for each model field class; checked in order.
MODEL_FIELD_DATATYPES = (
    (models.BooleanField, 'boolean'),
    ((models.IntegerField, models.FloatField, models.DecimalField), 'numeric'),
    (models.DateField, 'date'),
    ((models.CharField, models.TextField), 'text'),
    (JSONField, 'json'),
)


class DataTablesSerializerMixin:
    """Server-side column metadata for TableManager tables.

    Meta.model: the model the table is read from; filter datatypes are derived from its field types.
    Meta.datatypes: explicit datatypes, only for fields with no model column (e.g. checkbox).
    Meta.serializer_method_to_filter_field_map: database source for each SerializerMethodField.
    """

    @classmethod
    def source_mapping(cls):
        """Map each serializer field name to the database field used to filter and order it."""
        method_sources = getattr(cls.Meta, 'serializer_method_to_filter_field_map', {})
        mapping = {}
        for name, field in cls._declared_fields.items():
            if isinstance(field, serializers.SerializerMethodField):
                if name not in method_sources:
                    raise ImproperlyConfigured(
                        f"{cls.__name__}.{name}: SerializerMethodFields need a database source in "
                        "Meta.serializer_method_to_filter_field_map")
                mapping[name] = method_sources[name]
            else:
                mapping[name] = field.source or name
        return mapping

    @classmethod
    def column_datatypes(cls):
        """Map each serializer field name to its server-side filter datatype ('text', 'numeric', 'boolean', 'date', 'checkbox')."""
        explicit = getattr(cls.Meta, 'datatypes', {})
        result = {}
        for name, source in cls.source_mapping().items():
            if name in explicit:
                result[name] = explicit[name]
                continue
            try:
                model_field = cls.Meta.model._meta.get_field(source)
            except FieldDoesNotExist:
                raise ImproperlyConfigured(
                    f"{cls.__name__}.{name}: no field '{source}' on {cls.Meta.model.__name__}; declare its datatype in Meta.datatypes")
            for field_types, datatype in MODEL_FIELD_DATATYPES:
                if isinstance(model_field, field_types):
                    result[name] = datatype
                    break
            else:
                raise ImproperlyConfigured(
                    f"{cls.__name__}.{name}: unsupported model field type {type(model_field).__name__}; declare its datatype in Meta.datatypes")
        return result

    def serialize_column(self, name, instances):
        """Render a single column for many rows, as [{name: value}, ...], without serializing the other columns."""
        field = self.fields[name]
        return [{name: field.to_representation(instance)} for instance in instances]

    def _web_resource(self, slug):
        # Cached per serializer instance; with many=True one instance serialises every row
        cache = self.__dict__.setdefault('_web_resources', {})
        if slug not in cache:
            cache[slug] = WebResource.objects.get(slug=slug)
        return cache[slug]

    def anchor(self, content, href, passenger_content=None):
        """Build the anchor object rendered by the client's weblinktext type.

        Content can be either a string or an dictionary with content and formatting properties. 
        Dictionary content is used as-is, with formatting applied on the client side. 
        Plain text content containing HTML is returned as {anchor_html, anchor_href}, otherwise as {anchor_content, anchor_href}.
        If passenger_content is given, the return is {anchor_html, anchor_href, anchor_content} even if content contains HTML.
        This allows plain text content to be sent when the HTML content is a small icon and the client needs a text label for filtering or exporting.
        """
        if not content:
            return None
        if not isinstance(content, dict):
            # Simple Regex to check if the content contains HTML tags or HTML entities (character based, not numeric)
            if re.search(r'<[a-zA-Z][^>]*>', str(content)) or re.search(r'&[a-zA-Z]{2,25};', str(content)):
                if passenger_content is not None:
                    return {'anchor_html': content, 'anchor_href': href, 'anchor_content': passenger_content}
                return {'anchor_html': content, 'anchor_href': href}
        return {'anchor_content': content, 'anchor_href': href}

    def weblink_anchor(self, content, index, slug):
        """Build a weblinktext object whose href is the WebResource `slug` link for `index`."""
        if not content:
            return None
        href = str(WebLink(index=index, web_resource=self._web_resource(slug))) if index else None
        return self.anchor(content, href)

    def string_with_optional_formatting(self, content, formatting):
        if len(formatting) > 0:
            return dict(content=content, formatting=formatting)
        return content


class GpcrStatisticsSummarySerializer(DataTablesSerializerMixin, serializers.Serializer):
    """Serializer to generate JSON for the structure statistics data for GPCRs stored in the gpcr_structure_statistics database table."""

    uniprot = serializers.SerializerMethodField()
    protein_name = serializers.SerializerMethodField()
    receptor_family = serializers.SerializerMethodField()
    receptor_class = serializers.ReadOnlyField(read_only=True, )
    gene = serializers.SerializerMethodField()
    species_common_name = serializers.CharField(read_only=True)

    # Structure counts by state
    st_inact_c = serializers.ReadOnlyField(read_only=True)
    st_interm_c = serializers.ReadOnlyField(read_only=True)
    st_act_c = serializers.ReadOnlyField(read_only=True)

    # Best resolution by state (null when no structure of that state exists; the client chooses the placeholder via nullValuePlaceholder)
    best_res_inact = serializers.ReadOnlyField(read_only=True)
    best_res_interm = serializers.ReadOnlyField(read_only=True)
    best_res_act = serializers.ReadOnlyField(read_only=True)

    # Transducer / extra-protein counts (map to annotated names)
    transd_gio_c = serializers.ReadOnlyField(read_only=True)
    transd_gq11_c = serializers.ReadOnlyField(read_only=True)
    transd_g1213_c = serializers.ReadOnlyField(read_only=True)
    transd_arrest_c = serializers.ReadOnlyField(read_only=True)
    transd_grks_c = serializers.ReadOnlyField(read_only=True)

    # Ligand type counts
    ligand_types_smmol_c = serializers.ReadOnlyField(read_only=True)
    ligand_types_pep_c = serializers.ReadOnlyField(read_only=True)

    # Modality group counts (map to annotated names)
    limodgrp_stim_c = serializers.ReadOnlyField(read_only=True)
    limodgrp_inhib_c = serializers.ReadOnlyField(read_only=True)
    limodgrp_unk_c = serializers.ReadOnlyField(read_only=True)

    # Individual modality counts
    limod_apo_c = serializers.ReadOnlyField(read_only=True)
    limod_ag_c = serializers.ReadOnlyField(read_only=True)
    limod_ag_partial_c = serializers.ReadOnlyField(read_only=True)
    limod_allo_antag_c = serializers.ReadOnlyField(read_only=True)
    limod_antag_c = serializers.ReadOnlyField(read_only=True)
    limod_inv_ag_c = serializers.ReadOnlyField(read_only=True)
    limod_nam_c = serializers.ReadOnlyField(read_only=True)
    limod_pam_c = serializers.ReadOnlyField(read_only=True)
    limod_unk_c = serializers.ReadOnlyField(read_only=True)

    class Meta:
        model = GpcrStructureStatisticsTable
        serializer_method_to_filter_field_map = {
            'uniprot': 'uniprot_entry_name', 'gene': 'gene_name', 'protein_name': 'protein_name', 'receptor_family': 'receptor_family',
        }

    def get_uniprot(self, obj):
        uniprot_name = obj.uniprot_entry_name.split("_")[0] if "_" in obj.uniprot_entry_name else obj.uniprot_entry_name
        return self.weblink_anchor(uniprot_name, obj.uniprot_accession, 'uniprot')

    def get_gene(self, obj):
        return self.weblink_anchor(obj.gene_name, obj.gene_entrez_id, 'entrez_gene')

    def get_protein_name(self, obj):
        return self.string_with_optional_formatting(obj.protein_name, obj.protein_name_formatting)

    def get_receptor_family(self, obj):
        return self.string_with_optional_formatting(obj.receptor_family, obj.receptor_family_formatting)


class PdbStructureSummarySerializer(DataTablesSerializerMixin, serializers.Serializer):
    """Serializer to generate JSON for the PDB structure data stored in the table_pdb_data database table."""

    checkbox = serializers.SerializerMethodField()
    uniprot = serializers.SerializerMethodField()
    protein_name_short = serializers.SerializerMethodField()
    receptor_family_short = serializers.SerializerMethodField()
    receptor_class_code = serializers.ReadOnlyField(read_only=True, )
    gene = serializers.SerializerMethodField()
    fraction_of_wt_seq = serializers.ReadOnlyField(read_only=True)
    closest_to_human = serializers.ReadOnlyField(read_only=True)
    species_common_name = serializers.CharField(read_only=True)
    identity_to_human = serializers.ReadOnlyField(read_only=True)

    structure_type = serializers.ReadOnlyField(read_only=True)
    pdb_id = serializers.SerializerMethodField()

    # Resolution (null when not available; the client chooses the placeholder via nullValuePlaceholder)
    resolution = serializers.ReadOnlyField(read_only=True)
    resolution_best = serializers.ReadOnlyField(read_only=True)
    state = serializers.ReadOnlyField(read_only=True)
    query_effector = serializers.ReadOnlyField(read_only=True)

    gprot_bound_likeness = serializers.ReadOnlyField(read_only=True)
    tm6_angle = serializers.ReadOnlyField(read_only=True)

    signal_protein = serializers.ReadOnlyField(read_only=True)
    signal_protein_subtype = serializers.SerializerMethodField()
    signal_protein_note = serializers.ReadOnlyField(read_only=True)
    signal_protein_pcntseq = serializers.ReadOnlyField(read_only=True)

    fusion = serializers.ReadOnlyField(read_only=True)
    antibody = serializers.ReadOnlyField(read_only=True)

    ligand = serializers.SerializerMethodField()
    ligand_role = serializers.SerializerMethodField()

    class Meta:
        model = PdbTable
        datatypes = {'checkbox': 'checkbox'}
        serializer_method_to_filter_field_map = {
           'checkbox': 'checkbox', 'uniprot': 'uniprot_entry_name', 'gene': 'gene_name', 'pdb_id': 'pdb_id', 
           'ligand': 'ligand_names', 'ligand_role': 'ligand_roles', 'protein_name_short': 'protein_name_short', 
           'receptor_family_short': 'receptor_family_short', 'signal_protein_subtype': 'signal_protein_subtype',
        }

    def get_checkbox(self, obj):
        return {'row_id': obj.id, 'data': {'pdb_id': obj.pdb_id, 'protein_name_short': obj.protein_name_short}}

    def get_uniprot(self, obj):
        uniprot_name = obj.uniprot_entry_name.split("_")[0] if "_" in obj.uniprot_entry_name else obj.uniprot_entry_name
        return self.weblink_anchor(uniprot_name, obj.uniprot_accession, 'uniprot')

    def get_protein_name_short(self, obj):
        return self.string_with_optional_formatting(obj.protein_name_short, obj.protein_name_short_formatting)

    def get_receptor_family_short(self, obj):
        return self.string_with_optional_formatting(obj.receptor_family_short, obj.receptor_family_short_formatting)

    def get_signal_protein_subtype(self, obj):
        return self.string_with_optional_formatting(obj.signal_protein_subtype, obj.signal_protein_subtype_formatting)

    def get_gene(self, obj):
        return self.weblink_anchor(obj.gene_name, obj.gene_entrez_id, 'entrez_gene')

    def get_pdb_id(self, obj):
        if obj.structure_type_origin == 'experiment':
            return self.weblink_anchor(obj.pdb_id, obj.pdb_id, 'pdb')
        else:
            return self.weblink_anchor(obj.pdb_id, None, 'pdb')
    
    def get_ligand(self, obj):
        #Currently only the first ligand is displayed in the table, so we return only the first ligand and its formatting. 
        # If there are no ligands, None is returned. If there is no formatting for the first ligand, only the ligand content is returned as a string
        first_ligand = obj.ligand_names[0] if obj.ligand_names and len(obj.ligand_names) > 0 else None
        first_ligand_formatting = obj.ligand_names_formatting[0] if obj.ligand_names_formatting else []
        if first_ligand:
            return self.string_with_optional_formatting(first_ligand, first_ligand_formatting)
        return None

    def get_ligand_role(self, obj):
        #Currently only the first ligand is displayed in the table, so we return only the first ligand/role
        first_ligand_role = obj.ligand_roles[0] if obj.ligand_roles and len(obj.ligand_roles) > 0 else None
        return first_ligand_role if first_ligand_role else None


class PhysiologicalLigandsSerializer(DataTablesSerializerMixin, serializers.Serializer):
    """Serializer to generate JSON for the physiological ligand data stored in the table_physiological_ligands database table."""

    # Receptor
    receptor_class = serializers.ReadOnlyField(read_only=True)
    receptor_family = serializers.ReadOnlyField(read_only=True)
    uniprot = serializers.SerializerMethodField()
    protein = serializers.SerializerMethodField()
    gene = serializers.SerializerMethodField()
    species_common_name = serializers.ReadOnlyField(read_only=True)

    # Ligand
    ligand = serializers.SerializerMethodField()
    gtp_ligand = serializers.SerializerMethodField()
    gtp_classification = serializers.ReadOnlyField(read_only=True)
    potency_ranking = serializers.ReadOnlyField(read_only=True)
    ligand_type = serializers.ReadOnlyField(read_only=True)
    smiles = serializers.ReadOnlyField(read_only=True)
    inchikey = serializers.ReadOnlyField(read_only=True)

    # Compound preview data for the ligand column
    sequence = serializers.ReadOnlyField(read_only=True)
    smiles_for_image = serializers.ReadOnlyField(read_only=True)

    # Structures, each a list; model_structure_type and model_has_signprot are parallel to structure_model (model icon, signalling protein flag)
    structure_model = serializers.SerializerMethodField()
    model_structure_type = serializers.ReadOnlyField(source='model_structure_types', read_only=True)
    model_has_signprot = serializers.ReadOnlyField(read_only=True)
    structure_exp = serializers.SerializerMethodField()

    # Potency (null when not measured; the client chooses the placeholder via nullValuePlaceholder)
    pec50_min = serializers.ReadOnlyField(read_only=True)
    pec50_mid = serializers.ReadOnlyField(read_only=True)
    pec50_max = serializers.ReadOnlyField(read_only=True)
    pki_min = serializers.ReadOnlyField(read_only=True)
    pki_mid = serializers.ReadOnlyField(read_only=True)
    pki_max = serializers.ReadOnlyField(read_only=True)

    references = serializers.ReadOnlyField(read_only=True)

    class Meta:
        model = PhysiologicalLigandsTable
        serializer_method_to_filter_field_map = {
            'uniprot': 'uniprot_name', 'protein': 'protein_name', 'gene': 'gene_name', 'ligand': 'ligand_name',
            'gtp_ligand': 'gtp_ligand_index', 'structure_model': 'model_id_codes',
            'structure_exp': 'exp_pdb_codes',
        }

    def get_uniprot(self, obj):
        uniprot_name = obj.uniprot_entry_name.split("_")[0] if "_" in obj.uniprot_entry_name else obj.uniprot_entry_name
        return self.weblink_anchor(uniprot_name, obj.uniprot_accession, 'uniprot')

    def get_protein(self, obj):
        # HTML name displayed, plain name carried for filtering, ordering and export
        return self.anchor(self.string_with_optional_formatting(obj.protein_name, obj.protein_name_formatting), f'/protein/{obj.uniprot_entry_name}', obj.protein_name)

    def get_gene(self, obj):
        return self.weblink_anchor(obj.gene_name, obj.gene_entrez_id, 'entrez_gene')

    def get_ligand(self, obj):
        return self.anchor(self.string_with_optional_formatting(obj.ligand_name, obj.ligand_name_formatting), f'/ligand/{obj.ligand_id}/group', obj.ligand_name)

    def get_gtp_ligand(self, obj):
        return self.weblink_anchor(obj.gtp_ligand_index, obj.gtp_ligand_index, 'gtoplig')

    def get_structure_model(self, obj):
        without_signprot = '<img width="14px" height="20px" class="model-link" src="/static/home/images/gpcr_structure_logo.png">'
        with_signprot = '<img width="14px" height="20px" class="model-link" src="/static/home/images/model-surface.png">'        
        return [self.anchor(with_signprot if has_signprot else without_signprot, #Icon for model with or without signalling protein, with the same href
                            f'/structure/ligand_complex_models/{code}', #Href for the model page
                            code #The plain text code for filtering and exporting, even though the icon is HTML
                            ) 
                            for code, has_signprot in zip(obj.model_id_codes, obj.model_has_signprot)
               ]

    def get_structure_exp(self, obj):
        return [self.anchor(code, f'/structure/{code}') for code in obj.exp_pdb_codes]


class LigandComplexModelsSerializer(DataTablesSerializerMixin, serializers.Serializer):
    """Serializer to generate JSON for the ligand complex model data stored in the table_ligand_complex_models database table."""

    # Model
    checkbox = serializers.SerializerMethodField()
    model = serializers.SerializerMethodField()

    # Ligand
    ligand = serializers.SerializerMethodField()
    mol_modality = serializers.ReadOnlyField(read_only=True)
    pharm_modality = serializers.ReadOnlyField(read_only=True)
    physiological = serializers.ReadOnlyField(read_only=True)
    clinical = serializers.ReadOnlyField(read_only=True)

    # Compound preview data for the ligand column
    sequence = serializers.ReadOnlyField(read_only=True)
    smiles_for_image = serializers.ReadOnlyField(read_only=True)

    # Receptor
    gene = serializers.SerializerMethodField()
    protein = serializers.SerializerMethodField()
    receptor_family = serializers.ReadOnlyField(read_only=True)
    receptor_class = serializers.ReadOnlyField(read_only=True)
    receptor_modality = serializers.ReadOnlyField(read_only=True)
    receptor_chemotype = serializers.ReadOnlyField(read_only=True)

    # Structure
    state = serializers.ReadOnlyField(read_only=True)
    signal_protein_family = serializers.ReadOnlyField(read_only=True)
    signal_protein_subtype = serializers.ReadOnlyField(read_only=True)

    # Ligand model scores (null when not available; the client chooses the placeholder via nullValuePlaceholder)
    af2_score = serializers.ReadOnlyField(read_only=True)
    boltz2_score = serializers.ReadOnlyField(read_only=True)
    rfaa_score = serializers.ReadOnlyField(read_only=True)

    publication_date = serializers.ReadOnlyField(read_only=True)

    class Meta:
        model = LigandComplexModelsTable
        datatypes = {'checkbox': 'checkbox'}
        serializer_method_to_filter_field_map = {
            'checkbox': 'checkbox', 'model': 'pdb_code', 'ligand': 'ligand_name', 'gene': 'gene_name', 'protein': 'protein_name',
        }

    def get_checkbox(self, obj):
        return {'row_id': obj.id, 'data': {'structure_id': obj.structure_id, 'pdb_code': obj.pdb_code}}

    def get_model(self, obj):
        # Same icons as PhysiologicalLigandsSerializer.get_structure_model
        icon = 'model-surface.png' if obj.has_signprot else 'gpcr_structure_logo.png'
        return self.anchor(f'<img width="14px" height="20px" class="model-link" src="/static/home/images/{icon}">',
                           f'/structure/ligand_complex_models/{obj.pdb_code}',
                           obj.pdb_code  # Plain text code for filtering and exporting, the icon is HTML
                           ) if obj.pdb_code else None

    def get_ligand(self, obj):
        # HTML name displayed, plain name carried for filtering, ordering and export
        return self.anchor(self.string_with_optional_formatting(obj.ligand_name, obj.ligand_name_formatting), f'/ligand/{obj.ligand_id}/group', obj.ligand_name)

    def get_gene(self, obj):
        return self.weblink_anchor(obj.gene_name, obj.gene_entrez_id, 'entrez_gene')

    def get_protein(self, obj):
        return self.anchor(self.string_with_optional_formatting(obj.protein_name, obj.protein_name_formatting), f'/protein/{obj.uniprot_entry_name}', obj.protein_name)


class GpcrStructureBrowserSerializer(DataTablesSerializerMixin, serializers.Serializer):
    """Serializer to generate JSON for the structure browser data stored in the table_gpcr_structure_browser database table."""

    # Fields copied into each checkbox, read by the page's selection workflows (alignment, download, superposition,
    # copying ids). Anything else about the selected rows is fetched with dataSource.getRowsById.
    CHECKBOX_DATA_FIELDS = ('pdb_code', 'uniprot_entry_name')

    # Shown in the ligand column of structures with no ligands
    APO_LIGAND_NAME = 'Apo (no ligand)'

    checkbox = serializers.SerializerMethodField()

    # Receptor
    gpcrdb = serializers.SerializerMethodField()
    uniprot = serializers.SerializerMethodField()
    gene = serializers.SerializerMethodField()
    protein = serializers.SerializerMethodField()
    receptor_family = serializers.SerializerMethodField()
    receptor_class = serializers.ReadOnlyField(read_only=True)
    species_common_name = serializers.ReadOnlyField(read_only=True)

    # Structure (null values: the client chooses the placeholder via nullValuePlaceholder)
    method = serializers.ReadOnlyField(read_only=True)
    pdb = serializers.SerializerMethodField()
    refined_structure = serializers.SerializerMethodField()
    resolution = serializers.ReadOnlyField(read_only=True)
    representative = serializers.ReadOnlyField(read_only=True)
    preferred_chain = serializers.ReadOnlyField(read_only=True)
    coverage = serializers.ReadOnlyField(read_only=True)

    # Receptor state
    state = serializers.ReadOnlyField(read_only=True)
    gprot_bound_likeness = serializers.ReadOnlyField(read_only=True)

    # Signalling protein
    signal_protein_family = serializers.ReadOnlyField(read_only=True)
    signal_protein_subtype = serializers.SerializerMethodField()
    signal_protein_note = serializers.ReadOnlyField(read_only=True)
    signal_protein_pcntseq = serializers.ReadOnlyField(read_only=True)

    # Structure ligands
    ligand = serializers.SerializerMethodField()
    ligand_type = serializers.ReadOnlyField(read_only=True)
    ligand_role = serializers.ReadOnlyField(read_only=True)

    # Auxiliary proteins and small molecules
    fusion = serializers.ReadOnlyField(read_only=True)
    antibody = serializers.ReadOnlyField(read_only=True)
    auxiliary_molecule = serializers.ReadOnlyField(read_only=True)
    auxiliary_molecule_type = serializers.ReadOnlyField(read_only=True)
    auxiliary_molecule_function = serializers.ReadOnlyField(read_only=True)

    # Natural ligands
    endo_ligand = serializers.SerializerMethodField()
    endo_ligand_type = serializers.ReadOnlyField(read_only=True)

    # Sodium ion sites
    sodium_site = serializers.ReadOnlyField(read_only=True)
    sodium = serializers.ReadOnlyField(read_only=True)

    # Reference
    authors = serializers.ReadOnlyField(read_only=True)
    reference = serializers.SerializerMethodField()
    publication_date = serializers.ReadOnlyField(read_only=True)

    class Meta:
        model = GpcrStructureBrowserTable
        datatypes = {'checkbox': 'checkbox'}
        serializer_method_to_filter_field_map = {
            'checkbox': 'checkbox', 'gpcrdb': 'uniprot_entry_name', 'uniprot': 'uniprot_name', 'gene': 'gene_name',
            'protein': 'protein_name', 'receptor_family': 'receptor_family', 'pdb': 'pdb_code',
            'refined_structure': 'refined_structure', 'signal_protein_subtype': 'signal_protein_subtype',
            'ligand': 'ligand_names', 'endo_ligand': 'endo_ligand_names', 'reference': 'reference_index',
        }

    def get_checkbox(self, obj):
        return {'row_id': obj.id, 'data': {field: getattr(obj, field) for field in self.CHECKBOX_DATA_FIELDS}}

    def get_gpcrdb(self, obj):
        # GPCRdb logo linking to the receptor page; the entry name is carried for filtering and export
        return self.anchor('<img class="gpcrdb-link" src="/static/home/logo/gpcr/main.png" width="12" height="12" alt="GPCRdb">',
                           f'/protein/{obj.uniprot_entry_name}', obj.uniprot_entry_name)

    def get_uniprot(self, obj):
        return self.weblink_anchor(obj.uniprot_name, obj.uniprot_accession, 'uniprot')

    def get_gene(self, obj):
        return self.weblink_anchor(obj.gene_name, obj.gene_entrez_id, 'entrez_gene')

    def get_protein(self, obj):
        # Links to the Guide to Pharmacology (IUPHAR) page; plain text when the receptor has no GtoPdb id
        name = self.string_with_optional_formatting(obj.protein_name, obj.protein_name_formatting or [])
        return self.weblink_anchor(name, obj.iuphar_index, 'gtop') if obj.protein_name else None

    def get_receptor_family(self, obj):
        return self.string_with_optional_formatting(obj.receptor_family, obj.receptor_family_formatting or [])

    def get_pdb(self, obj):
        return self.anchor(obj.pdb_code, f'/structure/{obj.pdb_code}')

    def get_refined_structure(self, obj):
        if not obj.refined_structure:
            return None
        return self.anchor(obj.refined_structure, f'/structure/refined/{obj.pdb_code.upper()}')

    def get_signal_protein_subtype(self, obj):
        if not obj.signal_protein_subtype:
            return None
        subtype = self.string_with_optional_formatting(obj.signal_protein_subtype, obj.signal_protein_subtype_formatting or [])
        href = f'/signprot/{obj.signal_protein_entry_name}/' if obj.signal_protein_entry_name else None
        return self.anchor(subtype, href)

    def _ligand_links(self, ids, names, formatting):
        """weblinktextlist links for parallel ligand id/name/formatting lists; ligands without an id are not linked."""
        formatting = formatting or []
        links = []
        for index, (ligand_id, name) in enumerate(zip(ids, names)):
            name_formatting = formatting[index] if index < len(formatting) else []
            link = self.anchor(self.string_with_optional_formatting(name, name_formatting),
                               f'/ligand/{ligand_id}/info' if ligand_id is not None else None)
            if link:
                links.append(link)
        return links

    def get_ligand(self, obj):
        # Structures without ligands are apo; shown as an unlinked "Apo (no ligand)" entry
        links = self._ligand_links(obj.ligand_ids, obj.ligand_names, obj.ligand_names_formatting)
        return links or [self.anchor(self.APO_LIGAND_NAME, None)]

    def get_endo_ligand(self, obj):
        return self._ligand_links(obj.endo_ligand_ids, obj.endo_ligand_names, obj.endo_ligand_names_formatting)

    def get_reference(self, obj):
        if not obj.reference_index or not obj.reference_web_resource:
            return None
        return self.weblink_anchor(obj.reference_index, obj.reference_index, obj.reference_web_resource)


class HomologyModelsSerializer(DataTablesSerializerMixin, serializers.Serializer):
    """Serializer to generate JSON for the receptor model data stored in the table_homology_models database table."""

    # Paper describing each modelling method (HomologyModelsTable.method)
    METHOD_DOIS = {
        'AlphaFold2': 'https://doi.org/10.1038/s41586-021-03819-2',
        'AlphaFold2-Multistate': 'https://doi.org/10.1002/prot.26382',
    }

    checkbox = serializers.SerializerMethodField()

    # Model
    model = serializers.SerializerMethodField()
    version = serializers.ReadOnlyField(read_only=True)
    state = serializers.ReadOnlyField(read_only=True)
    method = serializers.SerializerMethodField()

    # Receptor
    uniprot = serializers.SerializerMethodField()
    gene = serializers.SerializerMethodField()
    protein = serializers.SerializerMethodField()
    receptor_family = serializers.SerializerMethodField()
    receptor_class = serializers.SerializerMethodField()
    species_common_name = serializers.ReadOnlyField(read_only=True)

    class Meta:
        model = HomologyModelsTable
        datatypes = {'checkbox': 'checkbox'}
        serializer_method_to_filter_field_map = {
            'checkbox': 'checkbox', 'model': 'uniprot_entry_name', 'method': 'method', 'uniprot': 'uniprot_name',
            'gene': 'gene_name', 'protein': 'protein_name', 'receptor_family': 'receptor_family',
            'receptor_class': 'receptor_class',
        }

    def get_checkbox(self, obj):
        # model_id for the model download; selection_id (<entry name>_<state name>) for the 'structure_model'
        # selections read by the alignment and superposition workflows
        return {'row_id': obj.id, 'data': {'model_id': obj.model_id,
                                           'selection_id': f'{obj.uniprot_entry_name}_{obj.state}'}}

    def get_model(self, obj):
        # Model icon linking to the model page; the entry name is carried for filtering and export
        return self.anchor('<img width="14px" height="20px" class="model-link" src="/static/home/images/gpcr_structure_logo.png">',
                           f'/structure/structure_models/receptor/{obj.uniprot_entry_name}_{obj.state_slug}',
                           obj.uniprot_entry_name)

    def get_method(self, obj):
        return self.anchor(obj.method, self.METHOD_DOIS.get(obj.method)) if obj.method else None

    def get_uniprot(self, obj):
        return self.weblink_anchor(obj.uniprot_name, obj.uniprot_accession, 'uniprot')

    def get_gene(self, obj):
        return self.weblink_anchor(obj.gene_name, obj.gene_entrez_id, 'entrez_gene')

    def get_protein(self, obj):
        name = self.string_with_optional_formatting(obj.protein_name, obj.protein_name_formatting or [])
        return self.anchor(name, f'/protein/{obj.uniprot_entry_name}', obj.protein_name) if obj.protein_name else None

    def get_receptor_family(self, obj):
        return self.string_with_optional_formatting(obj.receptor_family, obj.receptor_family_formatting or [])

    def get_receptor_class(self, obj):
        return self.string_with_optional_formatting(obj.receptor_class, obj.receptor_class_formatting or [])


# Serializer behind each table name used in the configuration files (<table_name>__<variant>.json)
TABLE_SERIALIZERS = {
    'structure_browser_table': GpcrStructureBrowserSerializer,
    'pdb_data_table': PdbStructureSummarySerializer,
    'structure_statistics_table_gpcr': GpcrStatisticsSummarySerializer,
    'physiological_ligands_table': PhysiologicalLigandsSerializer,
    'ligand_complex_models_table': LigandComplexModelsSerializer,
    'homology_models_table': HomologyModelsSerializer,
}
