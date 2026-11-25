from django.urls import re_path

from family import views


urlpatterns = [
    re_path(r'^(?P<slug>[-\w]+)/$', views.detail, name='detail'),
]