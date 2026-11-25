from django.urls import path, re_path

from residue import views


urlpatterns = [
    re_path(r'^targetselection', views.TargetSelection.as_view(), name='targetselection'),
    path('residuetable', views.ResidueTablesSelection.as_view(), name='residuetableselect'),
    path('residuetable_gprot', views.ResidueGprotSelection.as_view(), name='residuetableselect_gprot'),
    path('residuetable_arrestin', views.ResidueArrestinSelection.as_view(), name='residuetableselect_arrestin'),
    re_path(r'^residuetabledisplay', views.ResidueTablesDisplay.as_view(), name='residuetable'),
    re_path(r'^residuetableexcel', views.render_residue_table_excel, name='residuetableexcel'),
    path('residuefunctionbrowser', views.ResidueFunctionBrowser.as_view(), name='residue_function_browser'),
]
