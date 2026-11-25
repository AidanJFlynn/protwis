from django.db.models import JSONField
from django.db.models import CharField, TextField
from django.db.models.lookups import Lookup, Transform

class NFKCTransform(Transform):
    """
    Field transform usable in lookups, e.g.
        Model.objects.filter(name__nfkc__icontains="abc")
        Model.objects.filter(name__nfkc__in=["abc", "def"])

    Registered on CharField and TextField below (Django 2.2 compatible).
    """

    lookup_name = "nfkc"
    function = "NORMALIZE"
    template = "%(function)s(%(expressions)s, NFKC)"


class JsonArrayElementLookup(Lookup):
    """
    Base for lookups matching jsonb arrays that hold at least one element meeting `condition`.

    Elements are compared as text (jsonb_array_elements_text). Values that are not arrays (null, scalars,
    objects) never match. Subclasses set `condition`, SQL with one %s for the value and {element} for the
    element text, and may override `rhs_param`. With `normalize`, the element text is NFKC normalised first;
    the caller should normalise the value. Implemented as lookups (not annotations) because Django 2.2 cannot
    put expressions in a Q object.
    """

    prepare_rhs = False  # keep the value as given; JSONField would wrap it as a JSON value
    condition = None
    normalize = False

    def rhs_param(self):
        return self.rhs

    def as_sql(self, compiler, connection):
        lhs, lhs_params = self.process_lhs(compiler, connection)
        element = "NORMALIZE(e.v, NFKC)" if self.normalize else "e.v"
        # CASE guards jsonb_array_elements_text, which raises an error on non-array values
        sql = ("CASE WHEN jsonb_typeof({lhs}) = 'array' THEN EXISTS ("
               "SELECT 1 FROM jsonb_array_elements_text({lhs}) AS e(v) WHERE {condition}"
               ") ELSE false END").format(lhs=lhs, condition=self.condition.format(element=element))
        return sql, list(lhs_params) * 2 + [self.rhs_param()]


class JsonArrayElementIn(JsonArrayElementLookup):
    """
    An element equals one of the given values (case-sensitive), e.g.
        Model.objects.filter(ligand_roles__elementin=["Agonist", "Antagonist"])
    The values must be a non-empty list.
    """

    lookup_name = "elementin"
    condition = "{element} = ANY(%s)"

    def rhs_param(self):
        return list(self.rhs)


class JsonArrayElementIContains(JsonArrayElementLookup):
    """
    An element contains the given text, case-insensitively, e.g.
        Model.objects.filter(ligand_roles__elementicontains="agon")
    The text is matched literally (no LIKE wildcards), and never across two elements or JSON syntax.
    """

    lookup_name = "elementicontains"
    condition = "strpos(UPPER({element}), UPPER(%s)) > 0"

    def rhs_param(self):
        return str(self.rhs)


class JsonArrayElementInNFKC(JsonArrayElementIn):
    """As `elementin`, comparing the NFKC normalised element text, e.g. ligand_names__nfkcelementin=["PIP3"]."""

    lookup_name = "nfkcelementin"
    normalize = True


class JsonArrayElementIContainsNFKC(JsonArrayElementIContains):
    """As `elementicontains`, searching the NFKC normalised element text, e.g. ligand_names__nfkcelementicontains="pip3"."""

    lookup_name = "nfkcelementicontains"
    normalize = True


CharField.register_lookup(NFKCTransform)
TextField.register_lookup(NFKCTransform)
for lookup in (JsonArrayElementIn, JsonArrayElementInNFKC, JsonArrayElementIContains, JsonArrayElementIContainsNFKC):
    JSONField.register_lookup(lookup)
