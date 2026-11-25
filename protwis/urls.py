from django.urls import include, path, re_path
from django.contrib import admin
from django.conf import settings
from protwis import views
from django.views.generic import TemplateView

from classification import views as classification_views


urlpatterns = [
    path('', include('home.urls')),
    path('services/', include('api.urls')),
    re_path(r'^admin/', admin.site.urls),
    path('common/', include('common.urls')),
    path('protein/', include('protein.urls')),
    path('family/', include('family.urls')),
    path('mapper/', include('mapper.urls')),
    path('mutations/', include('mutation.urls')),
    path('news/', include('news.urls')),
    path('interaction/', include('interaction.urls')),
    path('residue/', include('residue.urls')),
    path('alignment/', include('alignment.urls')),
    path('similaritysearch/', include('similaritysearch.urls')),
    path('pages/', include('pages.urls')),
    path('phylogenetic_trees/', include('phylogenetic_trees.urls')),
    path('similaritymatrix/', include('similaritymatrix.urls')),
    path('structure/',include('structure.urls')),
    path('construct/',include('construct.urls')),
    path('sitesearch/',include('sitesearch.urls')),
    path('drugs/',include('drugs.urls')),
    re_path(r'^allgpcrs[/]?$', classification_views.GPCRList.as_view(), name='classification-gpcr-list'),
    path('classification/', include('classification.urls')),
    path('signprot/',include('signprot.urls')),
    path('biased_signalling/', include('ligand.urls')), # Remapping this url to the ligand
    path('ligand/',include('ligand.urls')),
    path('mutational_landscape/',include('mutational_landscape.urls')),
    path('contactnetwork/', include('contactnetwork.urls')),
    path('structure_comparison/', include('contactnetwork.urls')), # Remapping this url to the contact network
    path('seqsign/', include('seqsign.urls')),
    path('hotspots/', include('hotspots.urls')),
    path('table_provider/', include('table_provider.urls')),
    re_path("robots.txt", TemplateView.as_view(template_name="common/robots.txt", content_type="text/plain")),
]

handler404 = views.error404
handler500 = views.error500

if settings.DEBUG:
    urlpatterns.append(path('__debug__/', include('debug_toolbar.urls')))
