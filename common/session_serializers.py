import pickle


class PickleSerializer:
    """Pickle-based session serializer.

    Django 5.0 removed django.contrib.sessions.serializers.PickleSerializer.
    The session stores SimpleSelection objects wrapping live model instances
    (plus trees, signatures and uploaded files), which JSONSerializer cannot
    handle. Pickled sessions are only as safe as SECRET_KEY.
    """

    protocol = pickle.HIGHEST_PROTOCOL

    def dumps(self, obj):
        return pickle.dumps(obj, self.protocol)

    def loads(self, data):
        return pickle.loads(data)
