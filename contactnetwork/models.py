from structure.models import Structure

from django.db import models
import numpy as np
import statistics

from structure.models import Structure
import time
from scipy.stats import circmean, circstd
import re
from collections import Counter

distance_scaling_factor = 10000

class InteractingResiduePair(models.Model):
    referenced_structure = models.ForeignKey('structure.Structure', on_delete=models.CASCADE)
    res1 = models.ForeignKey('residue.Residue', related_name='residue1', on_delete=models.CASCADE)
    res2 = models.ForeignKey('residue.Residue', related_name='residue2', on_delete=models.CASCADE)


    @classmethod
    def truncate(cls):
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('TRUNCATE TABLE "{0}" RESTART IDENTITY CASCADE'.format(cls._meta.db_table))

    def __str__(self):
        return '<{}-{}-{}>'.format(self.res1, self.res2, self.referenced_structure)

    class Meta():
        db_table = 'interacting_residue_pair'


class Interaction(models.Model):
    interacting_pair = models.ForeignKey('contactnetwork.InteractingResiduePair', on_delete=models.CASCADE)
    interaction_type = models.CharField(max_length=100)
    specific_type = models.CharField(max_length=100, null=True)

    # interaction_level -> 0 - normal definition, 1 - loosened definition
    interaction_level = models.IntegerField(null=False, default=0)
    atomname_residue1 = models.CharField(max_length=10, null=True, db_index=True)
    atomname_residue2 = models.CharField(max_length=10, null=True, db_index=True)

    @classmethod
    def truncate(cls):
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('TRUNCATE TABLE "{0}" RESTART IDENTITY CASCADE'.format(cls._meta.db_table))

    class Meta():
        db_table = 'interaction'


class InteractingPeptideResiduePair(models.Model):
    peptide_amino_acid_three_letter = models.CharField(max_length=3)
    peptide_amino_acid = models.CharField(max_length=1)
    peptide_sequence_number = models.IntegerField(null=False)
    peptide = models.ForeignKey('ligand.LigandPeptideStructure', related_name='peptide', on_delete=models.CASCADE)
    receptor_residue = models.ForeignKey('residue.Residue', related_name='receptor_residue', on_delete=models.CASCADE)

    def __str__(self):
        return '<{}{}-{}>'.format(self.peptide_amino_acid_three_letter, self.peptide_sequence_number, self.receptor_residue)

    class Meta():
        db_table = 'interacting_peptide_residue_pair'


class InteractionPeptide(models.Model):
    interacting_peptide_pair = models.ForeignKey('contactnetwork.InteractingPeptideResiduePair', related_name='pair', on_delete=models.CASCADE)
    peptide_atom = models.CharField(max_length=10)
    receptor_atom = models.CharField(max_length=10)
    interaction_type = models.CharField(max_length=100)
    specific_type = models.CharField(max_length=100, null=True)
    interaction_level = models.IntegerField()

    def __str__(self):
        return '<{}-{}>'

    class Meta():
        db_table = 'interaction_peptide'


class ConsensusInteraction(models.Model):
    gn1 = models.ForeignKey('residue.ResidueGenericNumber', on_delete=models.CASCADE, related_name='GN_1')
    gn2 = models.ForeignKey('residue.ResidueGenericNumber', on_delete=models.CASCADE, related_name='GN_2')
    protein_class = models.ForeignKey('protein.ProteinFamily', on_delete=models.CASCADE)
    state = models.ForeignKey('protein.ProteinState', on_delete=models.CASCADE)
    frequency = models.DecimalField(max_digits=5, decimal_places=2)
    structures = models.ManyToManyField('structure.Structure')
    proteins = models.ManyToManyField('protein.Protein')
    state_specific = models.BooleanField(default=False)

    class Meta():
        unique_together = ('gn1', 'gn2','protein_class','state')

class Distance(models.Model):
    structure = models.ForeignKey('structure.Structure', related_name='distances', on_delete=models.CASCADE, null=True)
    res1 = models.ForeignKey('residue.Residue', related_name='distance_residue1', on_delete=models.CASCADE, null=True)
    res2 = models.ForeignKey('residue.Residue', related_name='distance_residue2', on_delete=models.CASCADE, null=True)
    gn1 = models.CharField(max_length=100, null=True)
    gn2 = models.CharField(max_length=100, null=True)
    gns_pair = models.CharField(db_index=True, max_length=100, null=True)
    distance = models.IntegerField(null=True)
    distance_cb = models.IntegerField(null=True)
    distance_helix_center = models.IntegerField(null=True)

    @classmethod
    def truncate(cls):
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute('TRUNCATE TABLE "{0}" RESTART IDENTITY CASCADE'.format(cls._meta.db_table))

    class Meta():
        db_table = 'distance'

def get_distance_averages(pdbs,s_lookup, interaction_keys,normalized = False, standard_deviation = False, split_by_amino_acid = False):
    ## Returned dataset is in ClassA GNs...
    matrix = {}
    group_distances = {}

    if len(pdbs)==1:
        # Never get SD when only looking at a single pdb...
        standard_deviation = False

    ds = list(Distance.objects.filter(structure__pdb_code__index__in=[ pdb.upper() for pdb in pdbs], gns_pair__in=interaction_keys) \
                         .values('gns_pair','distance','res1__amino_acid','res2__amino_acid','structure__pk'))
    if not normalized:
        for d in ds:
            if split_by_amino_acid:
                key = '{}{}{}'.format(d['gns_pair'],d['res1__amino_acid'],d['res2__amino_acid']).replace("_",",")
            else:
                key = d['gns_pair']
            if key not in matrix:
                matrix[key] = []
            matrix[key].append(d['distance'])

        # Calculate the average of averages
        for key,dists in matrix.items():
            if standard_deviation and len(pdbs)>1:
                if len(dists)==1:
                    stdevdists = 0
                else:
                    stdevdists = statistics.stdev(dists)
                group_distances[key] = stdevdists/distance_scaling_factor
            else:
                group_distances[key] = sum(dists)/len(dists)/distance_scaling_factor
    else:
        # NORMALIZE CODE
        for d in ds:
            if split_by_amino_acid:
                key = '{}{}{}'.format(d['gns_pair'],d['res1__amino_acid'],d['res2__amino_acid']).replace("_",",")
            else:
                key = d['gns_pair']
            dist = d['distance']
            pf = s_lookup[d['structure__pk']][2] # get the "receptor" level of the structure to group these regardless of species

            if key not in matrix:
                matrix[key] = {}
            if pf not in matrix[key]:
                matrix[key][pf] = []
            matrix[key][pf].append(dist)

        # Calculate the average of averages
        for key,pfs in matrix.items():
            # if key=='3x50_5x50':
            #     print(pfs)
            means = [sum(dists)/len(dists) for pf,dists in pfs.items() ]
            if standard_deviation and len(pdbs)>1:
                if len(means)==1:
                    stdevofmeans = 0
                else:
                    # stdevofmeans = np.std(means, ddof=1)
                    stdevofmeans = statistics.stdev(means)

                group_distances[key] = stdevofmeans/distance_scaling_factor
            else:
                meanofmeans = sum(means)/len(means)
                group_distances[key] = meanofmeans/distance_scaling_factor

    return group_distances

class ResidueAngle(models.Model):
    residue             = models.ForeignKey('residue.Residue', on_delete=models.CASCADE)
    structure           = models.ForeignKey('structure.Structure', on_delete=models.CASCADE)
    a_angle             = models.FloatField(default=0, null=True)
    b_angle             = models.FloatField(default=0, null=True)
    outer_angle         = models.FloatField(default=0, null=True)
    hse                 = models.IntegerField(default=0, null=True)
    sasa                = models.FloatField(default=0, null=True)
    rsa                 = models.FloatField(default=0, null=True)
    phi                 = models.FloatField(default=0, null=True)
    psi                 = models.FloatField(default=0, null=True)
    tau_angle           = models.FloatField(default=0, null=True)
    theta               = models.FloatField(default=0, null=True)
    tau                 = models.FloatField(default=0, null=True)
    rotation_angle      = models.FloatField(default=0, null=True)
    core_distance       = models.FloatField(default=0, null=True)
    midplane_distance   = models.FloatField(default=0, null=True)
    mid_distance        = models.FloatField(default=0, null=True)
    ss_dssp             = models.CharField(max_length=1, null=True)
    ss_stride           = models.CharField(max_length=1, null=True)
    chi1                = models.FloatField(default=0, null=True)
    chi2                = models.FloatField(default=0, null=True)
    chi3                = models.FloatField(default=0, null=True)
    chi4                = models.FloatField(default=0, null=True)
    chi5                = models.FloatField(default=0, null=True)
    missing_atoms       = models.IntegerField(default=0, null=True)

    class Meta():
        db_table = 'residue_angles'
        unique_together = ("residue", "structure")

def get_snake_plot_distance_lookup(protein):
    """Look up per-residue midplane_distance for a protein's snake plot TM alignment.

    Returns {sequence_number: {'best_midplane':, 'avg_midplane':}}, keyed by the protein's own
    (wild-type) sequence_number. Values are joined across the protein's experimental structures
    by generic number rather than sequence_number: ResidueAngle.residue is FK'd to each
    structure's own protein_conformation, whose sequence_numbers can be offset from wild type
    (e.g. 6KUX/6KUY for ada2a_human are off by 15), while generic numbers stay correct.
    """
    from residue.models import Residue

    structures = list(Structure.objects.filter(protein_conformation__protein__parent=protein,
                                               structure_type__origin='experiment').order_by('resolution'))
    if not structures:
        return {}

    gn_to_sequence_number = dict(Residue.objects.filter(
            protein_conformation__protein=protein, generic_number__isnull=False
        ).values_list('generic_number_id', 'sequence_number'))

    best_structure_id = structures[0].pk
    by_sequence_number = {}
    for structure_id, generic_number_id, midplane_distance in ResidueAngle.objects.filter(
                structure__in=structures, residue__generic_number__isnull=False
            ).values_list('structure_id', 'residue__generic_number_id', 'midplane_distance'):
        sequence_number = gn_to_sequence_number.get(generic_number_id)
        if sequence_number is None:
            continue
        by_sequence_number.setdefault(sequence_number, {})[structure_id] = midplane_distance

    lookup = {}
    for sequence_number, by_structure in by_sequence_number.items():
        midplane_values = [v for v in by_structure.values() if v is not None]
        lookup[sequence_number] = {
            'best_midplane': by_structure.get(best_structure_id),
            'avg_midplane': sum(midplane_values) / len(midplane_values) if midplane_values else None,
        }
    return lookup

def get_angle_averages(pdbs,s_lookup,normalized = False, standard_deviation = False, split_by_amino_acid = False, forced_class_a = False):
    start_time = time.time()
    pdbs_upper = [pdb.upper() for pdb in pdbs]
    if forced_class_a:
        generic_label = 'residue__generic_number__label'
    else:
        generic_label = 'residue__display_generic_number__label'

    # Deduce class
    gpcr_class = Structure.objects.filter(pdb_code__index__in=pdbs_upper
                ).values_list('protein_conformation__protein__parent__family__parent__parent__parent__slug', flat=True).distinct()
    if len(gpcr_class)>1:
        print('ERROR mix of classes!', gpcr_class)
    else:
        gpcr_class = gpcr_class[0]

    if len(pdbs)==1:
        # Never get SD when only looking at a single pdb...
        standard_deviation = False

    if not s_lookup:
        # Get the list of unique protein_families among pdbs
        structures = Structure.objects.filter(pdb_code__index__in=pdbs_upper
             ).select_related('protein_conformation__protein'
             ).values('pk','pdb_code__index',
                    'protein_conformation__protein__parent__entry_name',
                    'protein_conformation__protein__parent__name',
                    'protein_conformation__protein__entry_name')
        pfs = set()
        s_lookup = {}
        for s in structures:
            protein, pdb_name,pf  = [s['protein_conformation__protein__parent__entry_name'],s['protein_conformation__protein__entry_name'],s['protein_conformation__protein__parent__name']]
            s_lookup[s['pk']] = [protein, pdb_name,pf]
            pfs |= {pf}
    group_angles = {}

    ds = ResidueAngle.objects.filter(structure__pdb_code__index__in=pdbs_upper) \
                        .exclude(residue__generic_number=None) \
                        .values_list(generic_label,'structure__pk','residue__amino_acid','core_distance','a_angle','outer_angle','tau','phi','psi', 'sasa', 'rsa','theta','hse', 'tau_angle', 'rotation_angle') \
                        .order_by(generic_label,'residue__amino_acid')
                        #'core_distance','a_angle','outer_angle','tau','phi','psi', 'sasa', 'rsa','theta','hse'
    custom_angles = ['a_angle', 'outer_angle', 'phi', 'psi', 'theta', 'tau','tau_angle','rotation_angle']
    index_names = {0:'core_distance',1:'a_angle',2:'outer_angle',3:'tau',4:'phi',5:'psi',6: 'sasa',7: 'rsa',8:'theta',9:'hse', 10:'tau_angle',11:'rotation_angle'}
    # First bin all those belonging to same receptor
    matrix = {}
    matrix_normalized = {}
    prev_key = ''
    for d in ds:
        d = list(d)
        if not forced_class_a:
            d[0] = re.sub(r'\.[\d]+', '', d[0])
        gn = d[0]
        aa = d[2]

        if split_by_amino_acid:
            key = "{},{}".format(gn,aa)
        else:
            key = gn

        vals = d[3:]

        if normalized:
            pf = s_lookup[d[1]][2] # get the "receptor" level of the structure to group these regardless of species
            if key != prev_key:
                matrix_normalized[key] = {}
                matrix[key] = []
                prev_key = key
            if pf not in matrix_normalized[key]:
                matrix_normalized[key][pf] = []
            matrix_normalized[key][pf].append(vals)
        else:
            if key != prev_key:
                matrix[key] = []
                prev_key = key
            matrix[key].append(vals)

    # Calculate the average of averages
    if normalized:
        for key,pfs in matrix_normalized.items():
            means = []
            for pf,dists in pfs.items():
                if len(dists)==1:
                    means.append(dists[0])
                else:
                    grouped = list(zip(*dists))
                    mean_dists = []
                    for i,L in enumerate(grouped):
                        l = list(filter(None.__ne__, list(L)))
                        if len(l)>1:
                            if index_names[i] in custom_angles:
                                mean_dists.append(radial_average(l))
                            else:
                                mean_dists.append(round(sum(l)/len(l),2))
                        elif len(l)==1:
                            mean_dists.append(round(l[0],2))
                        else:
                            mean_dists.append(None)
                    means.append(mean_dists)
            matrix[key] = means

    for key,vals in matrix.items():
        grouped = list(zip(*vals))
        group_angles[key] = []
        for i,L in enumerate(grouped):
            #remove none
            l = list(filter(None, list(L)))
            if standard_deviation:
                if len(l)>1:
                    if index_names[i] in custom_angles:
                        group_angles[key].append(radial_stddev(l))
                        # print(key,index_names[i],l,radial_stddev(l),radial_average(l))
                    else:
                        group_angles[key].append(round(np.std(l, ddof=1),2))
                elif len(l)==1:
                    group_angles[key].append(0)
                else:
                    group_angles[key].append('')
            else:
                if len(l)>1:
                    if index_names[i] in custom_angles:
                        group_angles[key].append(radial_average(l))
                    else:
                        group_angles[key].append(round(sum(l)/len(l),2))
                elif len(l)==1:
                    group_angles[key].append(round(l[0],2))
                else:
                    group_angles[key].append('')

    return group_angles

def radial_average(L):
    # r = round(math.degrees(cmath.phase(sum(cmath.rect(1, math.radians(float(d))) for d in L)/len(L))),2)
    scipy = circmean(L, -180, 180)
    return scipy

def radial_stddev(L):
    scipy = circstd(L, 360,0)
    return scipy

def get_all_angles(pdbs,pfs,normalized,forced_class_a = False):
    pdbs_upper = [pdb.upper() for pdb in pdbs]
    custom_angles = ['a_angle', 'outer_angle', 'phi', 'psi', 'theta', 'tau','tau_angle', 'rotation_angle']
    index_names = {0:'core_distance',1:'a_angle',2:'outer_angle',3:'tau',4:'phi',5:'psi',6: 'sasa',7: 'rsa',8:'theta',9:'hse', 10:'ss_dssp', 11:'tau_angle', 12:'rotation_angle'}
    all_angles = {}
    if forced_class_a:
        generic_label = 'residue__generic_number__label'
    else:
        generic_label = 'residue__display_generic_number__label'
    print("new test",forced_class_a,generic_label)
    if normalized:
        ds = list(ResidueAngle.objects.filter(structure__pdb_code__index__in=pdbs_upper) \
            .exclude(residue__generic_number=None) \
            .values_list(generic_label,'structure__protein_conformation__protein__parent__family__slug','core_distance','a_angle','outer_angle','tau','phi','psi', 'sasa', 'rsa','theta','hse','ss_dssp','tau_angle', 'rotation_angle'))
        for d in ds:
            d = list(d)
            if not forced_class_a:
                d[0] = re.sub(r'\.[\d]+', '', d[0])
            if d[0] not in all_angles:
                all_angles[d[0]] = {}
                for pf in pfs:
                    all_angles[d[0]][pf] = []
            all_angles[d[0]][d[1]].append(d)

        for gn, pfs in all_angles.items():
            for pf,Ls in pfs.items():
                if Ls and len(Ls)>0:
                    if len(Ls)==1:
                        new_pf = Ls[0]
                    else:
                        grouped = list(zip(*Ls))
                        new_pf = [Ls[0][0],Ls[0][1]]
                        for i,L in enumerate(grouped[2:]):
                            l = [x for x in L if x is not None]
                            # If after filtering there is just one, then use that number.
                            if len(l)==1:
                                new_pf.append(l[0])
                                continue
                            # if nothing is left, then put in nothing..
                            elif len(l)==0:
                                new_pf.append(0)
                                continue

                            # if there is something and it's an angle type, take the mean of the values in circular space
                            if index_names[i] in custom_angles:
                                new_pf.append(radial_average(l))
                            # if it's the categorical then use the following code
                            elif i==10:
                                most_freq_dssp = Counter(l).most_common()
                                # if there are several possibitlies
                                if len(most_freq_dssp)>1:
                                    test = 0
                                    # Make a list with the most occuring possibilties
                                    possible = []
                                    for dssp in most_freq_dssp:
                                        if dssp[1]>=test:
                                            possible.append(dssp[0])
                                            test = dssp[1]
                                    # If only one, use that..
                                    if len(possible)==1:
                                        new_pf.append(possible[0])
                                    elif 'H' in possible: #If H is in the possibile, use H
                                        new_pf.append('H')
                                    else:
                                        # Remove - if it's not the only option, then pick the first element.
                                        if '-' in possible:
                                            possible.remove('-')
                                        new_pf.append(possible[0])
                                else:
                                    new_pf.append(most_freq_dssp[0][0])
                            else:
                                new_pf.append(round(sum(l)/len(l),2))
                    all_angles[gn][pf]=new_pf
    else:
        ds = list(ResidueAngle.objects.filter(structure__pdb_code__index__in=pdbs) \
            .exclude(residue__generic_number=None) \
            .values_list(generic_label,'structure__pdb_code__index','core_distance','a_angle','outer_angle','tau','phi','psi', 'sasa', 'rsa','theta','hse','ss_dssp','tau_angle','rotation_angle'))
        for d in ds:
            d = list(d)
            if not forced_class_a:
                d[0] = re.sub(r'\.[\d]+', '', d[0])
            if d[0] not in all_angles:
                all_angles[d[0]] = {}
                for pdb in pdbs:
                    all_angles[d[0]][pdb] = []
            all_angles[d[0]][d[1]] = d

    return all_angles
