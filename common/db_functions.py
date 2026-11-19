from django.contrib.postgres.fields import JSONField
from django.db.models import CharField, Func, TextField
from django.db.models.lookups import Transform

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


class JsonAsTextTransform(Transform):
    """
    Casts a jsonb column to text so it can be searched as a string, e.g.
        Model.objects.filter(ligands__astext__icontains="abc")
        Model.objects.filter(ligands__astext__nfkc__icontains="abc")

    The text is the JSON serialisation (e.g. '["a", "b"]'), so quotes and brackets are part of it.
    Implemented as a transform (not an annotation) because Django 2.2 cannot put expressions in a Q object.
    Registered on the postgres JSONField below; takes priority over key transforms, so a JSON key
    called "astext" cannot be accessed with the key__ syntax.
    """

    lookup_name = "astext"
    output_field = TextField()

    def as_sql(self, compiler, connection):
        lhs, params = compiler.compile(self.lhs)
        return "(%s)::text" % lhs, params


CharField.register_lookup(NFKCTransform)
TextField.register_lookup(NFKCTransform)
JSONField.register_lookup(JsonAsTextTransform)
