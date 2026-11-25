from django.urls import path, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage
from django.views.generic.base import RedirectView
from home import views

urlpatterns = [
    path('', views.index, name='index'),
    # url(
    #     r'^favicon.ico$',
    #     RedirectView.as_view(
    #         url=staticfiles_storage.url('home/images/favicon_dev.ico'),
    #         permanent=False),
    #     name="favicon"
    # ),
    re_path(r'^citations', views.citations_json, name='citation'),
    re_path(r'^cite_us/(?P<site>[-\w]+)/$', views.cite_us, name='citation'),
]
