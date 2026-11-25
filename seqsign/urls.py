from django.urls import path, re_path

from seqsign import views

urlpatterns = [
    path('', (views.PosTargetSelection.as_view()), name='pgselection'),
    re_path(r'^segmentselectionsignature', views.SegmentSelectionSignature.as_view(), name='segmentselectionsignature'),
    re_path(r'^render_signature_match_scores/(?P<cutoff>[\d]+)', views.render_signature_match_scores, name='render_signature_match_scores'),
    re_path(r'render_signature_match_excel', views.render_signature_match_excel, name=''),
    re_path(r'^render_signature_excel', views.render_signature_excel, name='render_signature_excel'),
    re_path(r'^render_signature', views.render_signature, name='rendersignature'),
    re_path(r'render_positive', views.render_reordered, {'group' : 'positive'}, name='render-reordered'),
    re_path(r'render_negative', views.render_reordered, {'group' : 'negative'}, name='render-reordered'),
    re_path(r'savepos', views.preserve_targets, name='ngselection'),
    re_path(r'negativegroupselection', views.NegTargetSelection.as_view(), name='ngselection'),
]
