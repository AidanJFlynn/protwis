# local settings
# override these settings by copying and editing this file to protwis/settings_local.py

# Site specific constants
SITE_NAME = 'gpcr' # used for site specific files
SITE_TITLE = 'GPCRdb' # for display in templates
DATA_DIR = '/protwis/data/protwis/' + SITE_NAME
BUILD_CACHE_DIR = DATA_DIR + '/cache'
DEFAULT_NUMBERING_SCHEME = 'gpcrdb'
DEFAULT_PROTEIN_STATE = 'inactive'
REFERENCE_POSITIONS = {'TM1': '1x50', 'ICL1': '12x50', 'TM2': '2x50', 'ECL1': '23x50', 'TM3': '3x50', 'ICL2': '34x50',
    'TM4': '4x50', 'ECL2': '45x50', 'TM5': '5x50', 'TM6': '6x50', 'TM7': '7x50', 'H8': '8x50',
    'D1S1': 'D1S1x50', 'D1T1': 'D1T1x50', 'D1S2': 'D1S2x50', 'D1e1': 'D1e1x50'}
DOCUMENTATION_URL = 'https://docs.gpcrdb.org/'

# Analytics
GOOGLE_ANALYTICS_KEY = False

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'protwis',
        'USER': 'protwis',
        'PASSWORD': 'protwis',
        'HOST': 'localhost',
    }
}

# Toggle "hub" function => this will add HUB hostnames to the menu system
HUB_ENABLED = True

# Quick-start development settings - unsuitable for production

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = '-eqrx61@n*z3y1mc1w_@x1+yo(@^!k7i-vjaz0tx1$902a!4mu'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

ALLOWED_HOSTS = ['*']

# HTTPS behind the nginx proxy
# nginx must set (overwrite) the header: proxy_set_header X-Forwarded-Proto $scheme;
# and Django must only be reachable through nginx, or clients could spoof it.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# Only send session/CSRF cookies over HTTPS. Do not use these settings for a
# site served over plain HTTP: sessions and POSTs would stop working.
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
# HTTP->HTTPS redirects and HSTS are left to nginx (SECURE_SSL_REDIRECT would
# loop if nginx does not forward X-Forwarded-Proto).
