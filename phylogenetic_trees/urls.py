from django.urls import re_path
from phylogenetic_trees import views


urlpatterns = [
   # url(r'^referenceselection', views.ReferenceSelection.as_view(), name='referenceselection'),
    re_path(r'^targetselection', views.TargetSelection.as_view(), name='targetselection'),
    re_path(r'^segmentselection', views.SegmentSelection.as_view(), name='segmentselection'),
    re_path(r'^treesettings', views.TreeSettings.as_view(), name='treesettings'),
    re_path(r'^signatureselection', views.signature_selection, name='sig_selection'),
    re_path(r'^render_v3', views.render_tree_v3, name='render_v3'),
    # url(r'^render_v2', views.render_tree_v2, name='render_v2'),
    # url(r'^render', views.render_tree, name='render'),
    re_path(r'^showrings', views.modify_tree, name='render'),
    re_path(r'^get_buttons', views.get_buttons, name='render'),

]
